import { ModelGateway, INTELLIGENCE_MODEL_CONFIG } from '../ai/model-gateway';
import { OpenRouterAdapter } from '../ai/openrouter-adapter';
import { ToolRegistry, globalToolRegistry } from '../tools';
import '../providers';
import { ObjectiveRouter } from './objective-router';
import { DeepResearchOrchestrator } from './deep-research-orchestrator';
import { BriefingSynthesizer } from './briefing-synthesizer';
import { AgenticChatOrchestrator } from './agentic-chat-orchestrator';
import { IntelligenceResponse, StructuredCard, SuggestedAction } from '../core/intelligence-result';
import { ExecutionEvent } from './research-executor';
import { SpecElicitationState, createInitialElicitationState, mergeAccumulatedSpecs, AccumulatedSpecs } from '../core/conversation-state';
import { SpecElicitationResponse } from '../core/sourcing-intent';
import { AttachmentAnalysisSummary } from '../core/attachment-analysis';
import { INTELLIGENCE_SYSTEM_PROMPT } from '../ai/system-prompts';
import { ChatMessage } from '../ai/types';

export interface ProcessRequest {
  query: string;
  sessionId: string;
  buyerId: string;
  workspaceId?: string;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
  elicitationState?: SpecElicitationState;
  attachmentAnalysis?: AttachmentAnalysisSummary;
  onProgress?: (event: ExecutionEvent) => void;
}

export class IntelligenceEngine {
  private modelGateway: ModelGateway;
  private toolRegistry: ToolRegistry;
  private router: ObjectiveRouter;
  private orchestrator: DeepResearchOrchestrator;
  private briefingSynthesizer: BriefingSynthesizer;
  private agenticOrchestrator: AgenticChatOrchestrator;

  constructor(modelGateway?: ModelGateway, toolRegistry?: ToolRegistry) {
    this.modelGateway = modelGateway || new OpenRouterAdapter();
    this.toolRegistry = toolRegistry || globalToolRegistry;
    this.router = new ObjectiveRouter(this.modelGateway);
    this.orchestrator = new DeepResearchOrchestrator(this.toolRegistry, this.modelGateway);
    this.briefingSynthesizer = new BriefingSynthesizer();
    this.agenticOrchestrator = new AgenticChatOrchestrator(this.modelGateway, this.toolRegistry);
  }

  async process(
    request: ProcessRequest
  ): Promise<IntelligenceResponse & { nextElicitationState?: SpecElicitationState }> {
    const { query, sessionId, buyerId, workspaceId, onProgress } = request;
    const wsId = workspaceId || `ws_${Date.now()}`;

    // 1. Initialize or restore multi-turn elicitation state
    let currentState: SpecElicitationState =
      request.elicitationState || createInitialElicitationState(sessionId);

    // If multimodal analysis extracted specifications, seamlessly merge into current state
    if (request.attachmentAnalysis?.extractedSpecs) {
      const es = request.attachmentAnalysis.extractedSpecs;
      const initialFromAttachment: Partial<AccumulatedSpecs> = {};
      if (es.productName && !currentState.accumulatedSpecs.product) initialFromAttachment.product = es.productName;
      if (es.category && !currentState.accumulatedSpecs.category) initialFromAttachment.category = es.category;
      if (es.quantity && !currentState.accumulatedSpecs.quantity) {
        const parsedQ = typeof es.quantity === 'number' ? es.quantity : Number(String(es.quantity).replace(/[^\d.]/g, ''));
        if (!isNaN(parsedQ) && parsedQ > 0) initialFromAttachment.quantity = parsedQ;
      }
      if (es.unit && !currentState.accumulatedSpecs.unit) initialFromAttachment.unit = es.unit;
      if (es.materialGrade && !currentState.accumulatedSpecs.materialGrade) initialFromAttachment.materialGrade = es.materialGrade;
      if (es.dimensions && !currentState.accumulatedSpecs.dimensions) initialFromAttachment.dimensions = es.dimensions;
      if (es.packaging && !currentState.accumulatedSpecs.packaging) initialFromAttachment.packaging = es.packaging;
      if (es.certifications && es.certifications.length > 0) {
        initialFromAttachment.certifications = es.certifications;
      }
      if (request.attachmentAnalysis.observations && request.attachmentAnalysis.observations.length > 0) {
        const obsNote = `Visual / document observations: ${request.attachmentAnalysis.observations.join('; ')}`;
        initialFromAttachment.additionalNotes = currentState.accumulatedSpecs.additionalNotes
          ? `${currentState.accumulatedSpecs.additionalNotes}\n${obsNote}`
          : obsNote;
      }

      currentState = {
        ...currentState,
        accumulatedSpecs: mergeAccumulatedSpecs(currentState.accumulatedSpecs, initialFromAttachment),
      };
    }

    onProgress?.({
      type: 'research_status',
      state: 'understanding',
      progressPercent: 10,
      message: request.attachmentAnalysis?.filesProcessed?.length
        ? `Integrating extracted specifications from ${request.attachmentAnalysis.filesProcessed.join(', ')}...`
        : 'Analyzing your sourcing requirements and specifications...',
    });

    // 2. Classify buyer conversational intent
    const intent = await this.router.classifyIntent(
      query,
      request.conversationHistory,
      currentState.accumulatedSpecs
    );

    // A. Active Research Q&A, Brainstorming, or Follow-up Intelligence Mode
    if (intent === 'market_research_qa' || intent === 'sourcing_brainstorm_advisory' || intent === 'brief_followup_qa') {
      const agenticResult = await this.agenticOrchestrator.run({
        query,
        sessionId,
        buyerId,
        workspaceId: wsId,
        conversationHistory: request.conversationHistory,
        accumulatedSpecs: currentState.accumulatedSpecs,
        intent,
        onProgress,
      });

      return {
        sessionId,
        messageId: `msg_${Date.now()}`,
        content: agenticResult.content,
        state: 'completed',
        cards: agenticResult.cards,
        evidence: agenticResult.evidence,
        calculations: agenticResult.calculations,
        dataGaps: [],
        suggestedActions: agenticResult.suggestedActions,
        nextElicitationState: currentState,
      };
    }

    // B. Multi-turn Spec Elicitation: Dialog-driven progressive intake
    const elicitResult: SpecElicitationResponse = await this.router.elicitNextSpec(
      query,
      currentState,
      request.conversationHistory,
      request.attachmentAnalysis
    );

    const updatedState: SpecElicitationState = {
      ...currentState,
      currentStage: elicitResult.stage,
      accumulatedSpecs: elicitResult.updatedSpecs,
      completedStages: elicitResult.cardData.completedStages,
      turnCount: currentState.turnCount + 1,
    };

    // If intake parameters are still being refined and briefing not confirmed, return conversational response
    if (!elicitResult.isResearchReady && intent !== 'brief_confirmation') {
      onProgress?.({
        type: 'research_status',
        state: 'intake',
        progressPercent: 100,
        message: 'Refining sourcing parameters...',
      });

      return {
        sessionId,
        messageId: `msg_${Date.now()}`,
        content: elicitResult.agentQuestion,
        state: 'intake',
        cards: [],
        evidence: [],
        calculations: [],
        dataGaps: [],
        suggestedActions: (() => {
          const acts: SuggestedAction[] = elicitResult.suggestedOptions.map((opt, i) => ({
            id: `elicit_opt_${i}`,
            label: opt.label,
            prompt: opt.value,
            actionType: 'provide_parameter' as const,
          }));
          const currentProd = elicitResult.updatedSpecs.product || currentState.accumulatedSpecs.product;
          if (currentProd) {
            acts.push({
              id: 'act_reference_images',
              label: '📷 Provide reference image',
              prompt: '__OPEN_IMAGE_SEARCH__',
              actionType: 'custom_query' as const,
            });
          }
          return acts;
        })(),
        nextElicitationState: updatedState,
      };
    }

    // C. Buyer Confirmed / Research Ready -> Launch Full Executive Briefing
    onProgress?.({
      type: 'research_status',
      state: 'planning',
      progressPercent: 20,
      message: `Conducting deep multi-source research for ${elicitResult.updatedSpecs.product || currentState.accumulatedSpecs.product || 'your product'}...`,
    });

    const specs = elicitResult.updatedSpecs.product ? elicitResult.updatedSpecs : currentState.accumulatedSpecs;
    const context = { buyerId, sessionId, workspaceId: wsId };

    const research = await this.orchestrator.execute(specs, context, onProgress);

    // 5. Synthesize Executive Sourcing Briefing
    const briefingCard = this.briefingSynthesizer.synthesizeBriefingCard(specs, research);
    const suggestedActions = this.briefingSynthesizer.generateSuggestedActions(specs, research);
    const rfqReadiness = this.briefingSynthesizer.calculateRFQReadiness(specs, research);

    // 6. Formulate Conversational Strategic Analyst Summary
    onProgress?.({
      type: 'research_status',
      state: 'synthesizing',
      progressPercent: 95,
      message: 'Synthesizing strategic executive briefing...',
    });

    let analystText = '';
    const topOrigin = briefingCard.data.recommendedOrigins[0] || { rank: 1, country: 'China', effectiveDuty: '28.4% (Sec 301 + MFN)', advantage: 'Pearl River Delta tooling agility', leadTimeDays: '14 - 25 days' };
    const originsListStr = briefingCard.data.recommendedOrigins.map((o: any) => `  * #${o.rank} ${o.country}: ${o.effectiveDuty} — ${o.advantage} (Lead time: ${o.leadTimeDays})`).join('\n');
    const compListStr = briefingCard.data.complianceChecklist.slice(0, 3).map((c: any) => c.item).join(', ');

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: INTELLIGENCE_SYSTEM_PROMPT },
        ...(request.conversationHistory || []).slice(-4).map((h) => ({ role: h.role, content: h.content })),
        {
          role: 'user',
          content: `${query}

[SYNCHRONIZED EXECUTIVE SOURCING BRIEFING DATA]:
- Product: ${briefingCard.data.productProfile.name} (HS: ${briefingCard.data.productProfile.hsCode})
- Destination: ${specs.destination}
- Target Volume: ${briefingCard.data.productProfile.orderQuantity}
- Top Recommended Origin: #${topOrigin.rank} ${topOrigin.country} (Duty: ${topOrigin.effectiveDuty})
- Sourcing Ranking & Multi-Country Corridors:
${originsListStr}
- Modeled Landed Cost: $${briefingCard.data.landedCostTable?.totalLandedPerUnitUSD} USD/${specs.unit || 'unit'} (Base FOB: $${briefingCard.data.landedCostTable?.basePriceUSD}, Freight: $${briefingCard.data.landedCostTable?.freightUSD}, Duty: $${briefingCard.data.landedCostTable?.dutyUSD} [${briefingCard.data.landedCostTable?.dutyLabel || ''}])
- Mandatory Compliance: ${compListStr}

INSTRUCTIONS:
Provide an authoritative executive summary and strategic sourcing recommendations strictly grounded in the verified data above.
Structure your analysis into clear, professional sections:
1. "### 1. Primary Sourcing Recommendation: #${topOrigin.rank} ${topOrigin.country} (${topOrigin.effectiveDuty})"
   - Detail strategic agility, tariff position, and total landed cost benchmark ($${briefingCard.data.landedCostTable?.totalLandedPerUnitUSD} USD/${specs.unit || 'unit'}).
2. "### 2. Origin–Country Recommendations"
   - Present candidate manufacturing origins using clean structured bullet cards matching the styling of the other sections:
     * **#1 [Country]** · **[Duty Rate]** · *[Lead Time]*: [Strategic trade-offs & tooling agility]
     * **#2 [Country]** · **[Duty Rate]** · *[Lead Time]*: [Strategic trade-offs & tooling agility]
   - DO NOT output unformatted pipe tables or raw table delimiters. Use formatted bullet points with bold subheadings for each origin so it renders consistently and elegantly like the other briefing sections.
3. "### 3. Key Compliance Mandates"
   - Outline critical testing standards, product safety certifications, and customs clearance paperwork.
4. "### 4. Procurement Next Steps"
   - Conclude with clear guidance for the buyer to review the detailed briefing cards below and click "Launch rfq with brief".
Keep the analysis razor-sharp and professional. Note that the full Executive Sourcing Briefing research table is displayed directly below your summary.`,
        },
      ];

      const resp = await this.modelGateway.chat({
        model: INTELLIGENCE_MODEL_CONFIG.briefingModel,
        messages,
        temperature: 0.2,
      });
      analystText = resp.content;
    } catch {
      analystText =
        `### Strategic Sourcing Summary & Recommendations: **${specs.product}** → **${specs.destination}**\n\n` +
        `#### 1. Primary Sourcing Recommendation: **#${topOrigin.rank} ${topOrigin.country}** (${topOrigin.effectiveDuty})\n` +
        `- **Strategic Agility**: ${topOrigin.advantage}.\n` +
        `- **Cost Benchmark**: Estimated total landed cost of **$${briefingCard.data.landedCostTable?.totalLandedPerUnitUSD} USD/${specs.unit || 'unit'}** (Base FOB ~$${briefingCard.data.landedCostTable?.basePriceUSD} + Freight ~$${briefingCard.data.landedCostTable?.freightUSD} + Customs Duties & Taxes).\n\n` +
        `#### 2. Origin–Country Recommendations:\n` +
        briefingCard.data.recommendedOrigins.map((o: any) => `- **#${o.rank} ${o.country}** (${o.effectiveDuty} · Est. Transit: ${o.leadTimeDays}): ${o.advantage}`).join('\n\n') +
        `\n\n#### 3. Key Compliance Mandates:\n` +
        `- Required Import Verification: **${compListStr || 'Standard Customs Documentation'}**.\n` +
        `- Zero-defect supplier audit and pre-shipment sample inspection recommended prior to mass production.\n\n` +
        `#### 4. Procurement Next Steps:\n` +
        `Review the full **Executive Sourcing Briefing** below. Click **"Launch rfq with brief"** to initiate binding quotations with verified suppliers.`;
    }

    onProgress?.({
      type: 'research_status',
      state: 'completed',
      progressPercent: 100,
      message: 'Procurement research complete.',
    });

    return {
      sessionId,
      messageId: `msg_${Date.now()}`,
      content: analystText,
      state: 'completed',
      cards: [briefingCard],
      evidence: research.accumulatedEvidence,
      calculations: research.accumulatedCalculations,
      dataGaps: research.accumulatedDataGaps,
      suggestedActions,
      rfqReadiness,
      nextElicitationState: {
        ...updatedState,
        currentStage: 'complete',
      },
    };
  }
}

export const intelligenceEngine = new IntelligenceEngine();

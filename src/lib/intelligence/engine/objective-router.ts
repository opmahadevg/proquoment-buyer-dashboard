import { ModelGateway } from '../ai/model-gateway';
import {
  IntelligenceObjective,
  ObjectiveType,
  ResearchDepth,
  EvidenceRequirement,
  ExtractedEntities,
  IntakeAssessment,
  IntakeOption,
  SpecElicitationResponse,
} from '../core/sourcing-intent';
import {
  SpecElicitationState,
  AccumulatedSpecs,
  SpecStage,
  nextStage,
  isResearchReady,
  mergeAccumulatedSpecs,
} from '../core/conversation-state';
import { OBJECTIVE_ROUTER_PROMPT, INTAKE_EVALUATION_PROMPT, SPEC_ELICITOR_PROMPT } from '../ai/system-prompts';
import { AttachmentAnalysisSummary } from '../core/attachment-analysis';
import { generateSmartDefaults, isSuggestRequest } from '@/lib/rfq/ai-suggest-defaults';

export type ConversationalIntent =
  | 'brief_confirmation'
  | 'market_research_qa'
  | 'sourcing_brainstorm_advisory'
  | 'brief_followup_qa'
  | 'spec_intake';

export class ObjectiveRouter {
  constructor(private modelGateway: ModelGateway) {}

  /**
   * Fast, resilient classification of the buyer's conversational intent.
   */
  async classifyIntent(
    userQuery: string,
    history?: { role: string; content: string }[],
    accumulatedSpecs?: AccumulatedSpecs
  ): Promise<ConversationalIntent> {
    const normMsg = userQuery.toLowerCase().trim();

    // 0. Smart Defaults / "Suggest Me" Request during Brief Creation
    if (isSuggestRequest(userQuery)) {
      return 'spec_intake';
    }

    // 1. Brief Confirmation Gate
    const isConfirming = Boolean(
      normMsg.match(/^(prepare|generate|build|create|run|proceed|go ahead|start|yes|ready|looks good|that'?s all|briefing now|prepare briefing|prepare executive sourcing briefing|yes,?\s*prepare)\b/) &&
      !normMsg.match(/\b(not yet|wait|more details|add details|add more|change|how|what|why|who|which|where|when|can we)\b/)
    );
    if (isConfirming) {
      return 'brief_confirmation';
    }

    // 2. Market Research / Trade Data Q&A Gate
    const isTradeResearch = Boolean(
      normMsg.match(/\b(how much|how many|import(ed|s|ing)?|export(ed|s|ing)?|trade volume|trade flow|bilateral|customs|tariff|tariffs|duty|duties|mfn|fta|trade remed(y|ies)|anti-dumping|market share|which country|countries specific|from the world|un comtrade|who are the suppliers|what suppliers|factory capacity|lead time|freight|transit time)\b/i) ||
      (normMsg.includes('?') && normMsg.match(/\b(france|germany|italy|china|india|vietnam|us|usa|europe|volume|share|import|export|duty)\b/i))
    );
    if (isTradeResearch) {
      return 'market_research_qa';
    }

    // 3. Sourcing Brainstorming & Strategic Advisory Gate
    const isBrainstorming = Boolean(
      normMsg.match(/\b(brainstorm|what (is|would be) right to source|recommend|suggest|suggestion|alternative|alternatives|can we use|rpet|recycled|better to source|pros and cons|trade[- ]?off|feasib|which material|how should we|estimate|scenario|optimize)\b/i)
    );
    if (isBrainstorming) {
      return 'sourcing_brainstorm_advisory';
    }

    // 4. Follow-up on generated brief (if history has briefing references)
    const hasPriorBriefing = history?.some((h) =>
      h.content.includes('Executive Sourcing Briefing') ||
      h.content.includes('Recommended Origin') ||
      h.content.includes('Landed Cost')
    );
    if (hasPriorBriefing && normMsg.includes('?')) {
      return 'brief_followup_qa';
    }

    // 5. Default to spec intake if giving parameters or clarifying
    return 'spec_intake';
  }

  /**
   * Evaluates whether the buyer's query and conversation history provide sufficient
   * information (Product + Quantity + Destination) to run full procurement intelligence.
   */
  async evaluateIntake(
    userQuery: string,
    history?: { role: string; content: string }[]
  ): Promise<IntakeAssessment & { entities: ExtractedEntities }> {
    const fullConversation = [...(history || []), { role: 'user', content: userQuery }];

    try {
      const response = await this.modelGateway.chat({
        messages: [
          { role: 'system', content: INTAKE_EVALUATION_PROMPT },
          {
            role: 'user',
            content: `CONVERSATION HISTORY:\n${fullConversation.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}\n\nLATEST USER MESSAGE:\n"${userQuery}"`,
          },
        ],
        temperature: 0.1,
      });

      const cleanJson = response.content.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      const product = parsed.product || this.extractProductName(userQuery, history);
      const quantity = parsed.quantity ? Number(parsed.quantity) : undefined;
      const unit = parsed.unit || undefined;
      const destination = parsed.destination || undefined;
      const candidateOrigins = parsed.candidateOrigins || [];
      const specs = parsed.specs || {};

      const entities: ExtractedEntities = {
        product,
        quantity,
        unit,
        destination,
        candidateOrigins,
        specs,
      };

      const isComplete = Boolean(parsed.isComplete && product && quantity);

      if (isComplete && destination) {
        return {
          isComplete: true,
          missingFields: [],
          buyerMessage: '',
          suggestedOptions: [],
          entities,
        };
      }

      // Incomplete: formulate questions and suggested options
      const missing: ('quantity' | 'destination' | 'specifications')[] = [];
      if (!quantity) missing.push('quantity');
      if (!destination) missing.push('destination');
      if (Object.keys(specs).length === 0) missing.push('specifications');

      const options: IntakeOption[] =
        parsed.suggestedOptions && parsed.suggestedOptions.length > 0
          ? parsed.suggestedOptions
          : this.generateDefaultOptions(product, destination);

      const buyerMessage = parsed.buyerMessage || this.generateIntakeQuestion(product, missing);

      return {
        isComplete: false,
        missingFields: missing,
        buyerMessage,
        suggestedOptions: options,
        entities,
      };
    } catch {
      // Deterministic heuristic fallback
      return this.heuristicIntake(userQuery, history);
    }
  }

  async route(userQuery: string, preExtractedEntities?: ExtractedEntities): Promise<IntelligenceObjective> {
    try {
      const response = await this.modelGateway.chat({
        messages: [
          { role: 'system', content: OBJECTIVE_ROUTER_PROMPT },
          { role: 'user', content: userQuery },
        ],
        temperature: 0.1,
      });

      const cleanJson = response.content.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      const entities: ExtractedEntities = {
        ...(parsed.entities || {}),
        ...(preExtractedEntities || {}),
      };

      return {
        objective: (parsed.objective || 'general_research') as ObjectiveType,
        entities,
        requiredEvidence: (parsed.requiredEvidence || ['product_classification']) as EvidenceRequirement[],
        depth: (parsed.depth || 'standard') as ResearchDepth,
        userQuery,
      };
    } catch {
      return this.heuristicFallback(userQuery, preExtractedEntities);
    }
  }

  private extractProductName(query: string, history?: { role: string; content: string }[]): string {
    const text = [...(history || []).map((h) => h.content), query].join(' ').toLowerCase();

    // Check if query is just a generic greeting
    const cleaned = query.trim().toLowerCase().replace(/[!.,?]/g, '');
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'start', 'help'];
    if (greetings.includes(cleaned)) {
      return '';
    }

    if (
      text.includes('coffee mug') ||
      text.includes('ceramic mug') ||
      text.includes('stoneware mug') ||
      text.includes('coffee cup') ||
      text.includes('ceramic cup') ||
      text.includes('drinkware') ||
      text.includes('travel tumbler') ||
      text.includes('mug') ||
      text.includes('mugs')
    ) {
      return 'Ceramic Coffee Mugs';
    }
    if (text.includes('coffee maker') || text.includes('espresso machine') || text.includes('coffee machine')) {
      return 'Coffee Maker Machines';
    }
    if (text.includes('coffee table')) {
      return 'Coffee Tables';
    }
    if (text.includes('teddy bear') || text.includes('teddy') || text.includes('plush') || text.includes('stuffed toy')) {
      return 'Teddy Bears (Plush Toys)';
    }
    if (text.includes('sodium benzoate') || text.includes('benzoate')) {
      return 'Sodium Benzoate';
    }
    if (text.includes('hospital furniture') || text.includes('hospital bed')) {
      return 'Hospital Furniture';
    }
    if (text.includes('cotton yarn') || text.includes('cotton combed')) {
      return 'Cotton Combed Yarn';
    }

    const stripped = query.replace(/^(i need to source|i want to source|source|find|buy|procure|looking for)\s+/i, '').trim();
    if (stripped.length <= 2 || greetings.includes(stripped.toLowerCase())) {
      return '';
    }
    return stripped;
  }

  private generateDefaultOptions(product?: string, dest?: string): IntakeOption[] {
    const p = (product || '').toLowerCase();
    const d = dest || 'Indonesia';

    if (!p) {
      return [
        { label: 'Teddy Bears (Plush Toys)', value: 'Teddy Bears for Indonesia', field: 'general' },
        { label: 'Sodium Benzoate', value: 'Sodium Benzoate for Indonesia', field: 'general' },
        { label: 'Cotton Combed Yarn', value: 'Cotton Combed Yarn for Indonesia', field: 'general' },
        { label: 'Hospital Furniture', value: 'Hospital Furniture for UAE', field: 'general' },
      ];
    }

    const suggestOption: IntakeOption = {
      label: '✨ Suggest me — standard market defaults',
      value: `Suggest standard market specifications and shipment terms for ${product || 'this product'} to ${d}`,
      field: 'general',
    };

    if (p.includes('teddy') || p.includes('toy') || p.includes('plush')) {
      return [
        suggestOption,
        { label: `5,000 units (${d})`, value: `5,000 units for ${d}, plush polyester 30cm`, field: 'quantity' },
        { label: `10,000 units (${d})`, value: `10,000 units for ${d}, CE / SNI certified`, field: 'quantity' },
        { label: `1 x 40ft Container (~12,000 pcs)`, value: `1 x 40ft container for ${d}`, field: 'quantity' },
        { label: `Trial Order (1,000 pcs)`, value: `Trial batch 1,000 pcs for ${d}`, field: 'quantity' },
      ];
    }

    if (p.includes('benzoate') || p.includes('chemical')) {
      return [
        suggestOption,
        { label: `500 MT (${d})`, value: `500 MT for ${d}, food grade`, field: 'quantity' },
        { label: `100 MT (${d})`, value: `100 MT for ${d}, industrial grade`, field: 'quantity' },
        { label: `1 x 20ft FCL (20 MT)`, value: `20 MT (1 FCL) for ${d}`, field: 'quantity' },
      ];
    }

    return [
      suggestOption,
      { label: `5,000 units for ${d}`, value: `5,000 units for ${d}`, field: 'quantity' },
      { label: `10,000 units for ${d}`, value: `10,000 units for ${d}`, field: 'quantity' },
      { label: `1 x 20ft FCL for ${d}`, value: `1 x 20ft FCL container for ${d}`, field: 'quantity' },
      { label: `Deliver to UAE (Jebel Ali)`, value: `5,000 units for UAE`, field: 'destination' },
    ];
  }

  private generateIntakeQuestion(product: string, missing: string[]): string {
    let msg = `I have noted your sourcing request for **${product}**.\n\n`;
    msg += `To conduct accurate global procurement intelligence — including customs trade volumes, WTO compliance prerequisites, freight modeling, and verified supplier matchmaking — I need a few key parameters:\n\n`;

    if (missing.includes('quantity')) {
      msg += `1. **Target Order Quantity**: What volume do you need? (e.g., *1,000 units trial, 5,000 units, 10,000 pcs, or 1 container*)\n`;
    }
    if (missing.includes('destination')) {
      msg += `2. **Destination Country / Discharge Port**: Where should this order be delivered? (e.g., *Jakarta, Indonesia; Jebel Ali, UAE; Los Angeles, USA*)\n`;
    }
    if (missing.includes('specifications')) {
      msg += `3. **Material / Quality Standards**: Are there specific material grades (e.g. *100% PP cotton, plush fabric*), target dimensions, or safety certifications (e.g. *CE EN 71, ASTM F963, SNI*) required?\n`;
    }

    msg += `\nYou can reply with your details below or click one of the quick options:`;
    return msg;
  }

  private heuristicIntake(
    userQuery: string,
    history?: { role: string; content: string }[]
  ): IntakeAssessment & { entities: ExtractedEntities } {
    const combined = [...(history || []).map((h) => h.content), userQuery].join(' ');
    const lower = combined.toLowerCase();

    // 1. Detect Product
    const product = this.extractProductName(userQuery, history);

    // 2. Detect Quantity
    let quantity: number | undefined;
    let unit: string | undefined;
    const qtyMatch = combined.match(/\b(\d+[\d,.]*)\s*(mt|metric tons?|tons?|units?|pcs|pieces?|kg|containers?|fcl|cbm)\b/i);
    if (qtyMatch) {
      quantity = Number(qtyMatch[1].replace(/,/g, ''));
      unit = qtyMatch[2].toLowerCase();
    }

    // 3. Detect Destination
    let destination: string | undefined;
    if (lower.includes('indonesia') || lower.includes('jakarta')) destination = 'Indonesia';
    else if (lower.includes('uae') || lower.includes('dubai') || lower.includes('jebel ali')) destination = 'UAE';
    else if (lower.includes('vietnam') || lower.includes('ho chi minh')) destination = 'Vietnam';
    else if (lower.includes('usa') || lower.includes('united states') || lower.includes('america')) destination = 'USA';
    else if (lower.includes('india') || lower.includes('nhava sheva') || lower.includes('mumbai')) destination = 'India';

    const entities: ExtractedEntities = {
      product,
      quantity,
      unit,
      destination,
      candidateOrigins: ['China', 'India'],
    };

    const missing: ('quantity' | 'destination' | 'specifications')[] = [];
    if (!quantity) missing.push('quantity');
    if (!destination) missing.push('destination');

    const isComplete = Boolean(product && quantity && destination);

    if (isComplete) {
      return {
        isComplete: true,
        missingFields: [],
        buyerMessage: '',
        suggestedOptions: [],
        entities,
      };
    }

    return {
      isComplete: false,
      missingFields: missing,
      buyerMessage: this.generateIntakeQuestion(product, missing),
      suggestedOptions: this.generateDefaultOptions(product, destination),
      entities,
    };
  }

  private heuristicFallback(query: string, preExtracted?: ExtractedEntities): IntelligenceObjective {
    const q = query.toLowerCase();
    const entities: ExtractedEntities = {
      product: preExtracted?.product || this.extractProductName(query),
      quantity: preExtracted?.quantity,
      unit: preExtracted?.unit,
      destination: preExtracted?.destination || 'Indonesia',
      candidateOrigins: preExtracted?.candidateOrigins || ['China', 'India'],
      ...(preExtracted || {}),
    };

    let objective: ObjectiveType = 'general_research';
    let depth: ResearchDepth = 'standard';
    const evidence: EvidenceRequirement[] = [
      'product_classification',
      'import_demand',
      'import_growth',
      'origin_market_share',
      'observed_price',
      'tariff_duties',
      'compliance_rules',
      'supplier_depth',
      'freight_benchmark',
      'landed_cost',
    ];

    if (q.includes('compare') || q.includes('vs')) {
      objective = 'compare_origins';
      depth = 'deep';
    } else {
      objective = 'make_sourcing_decision';
    }

    return {
      objective,
      entities,
      requiredEvidence: evidence,
      depth,
      userQuery: query,
    };
  }

  /**
   * Multi-turn progressive spec elicitation.
   * Walks buyer through 5 stages of product discovery.
   */
  async elicitNextSpec(
    userMessage: string,
    elicitationState: SpecElicitationState,
    conversationHistory?: { role: string; content: string }[],
    attachmentAnalysis?: AttachmentAnalysisSummary
  ): Promise<SpecElicitationResponse> {
    const stageLabels: Record<string, string> = {
      product: 'Product Identification',
      quantity: 'Order Quantity',
      destination: 'Destination Market',
      specifications: 'Product Specifications',
      timeline: 'Timeline & Budget',
      confirmation: 'Review & Confirmation',
      complete: 'Complete',
    };

    const stagePct: Record<string, number> = {
      product: 15,
      quantity: 35,
      destination: 55,
      specifications: 75,
      timeline: 85,
      confirmation: 95,
      complete: 100,
    };

    try {
      const response = await this.modelGateway.chat({
        messages: [
          { role: 'system', content: SPEC_ELICITOR_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              CURRENT_STAGE: elicitationState.currentStage,
              ACCUMULATED_SPECS: elicitationState.accumulatedSpecs,
              ATTACHMENT_ANALYSIS: attachmentAnalysis
                ? {
                    files: attachmentAnalysis.filesProcessed,
                    observations: attachmentAnalysis.observations,
                    designAttributes: attachmentAnalysis.designAttributes,
                    extractedSpecs: attachmentAnalysis.extractedSpecs,
                    productDesignQuery: attachmentAnalysis.productDesignQuery,
                  }
                : undefined,
              CONVERSATION_HISTORY: (conversationHistory || [])
                .slice(-6)
                .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
                .join('\n'),
              LATEST_MESSAGE: userMessage,
            }),
          },
        ],
        temperature: 0.15,
      });

      const clean = response.content.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(clean);

      const fullHistory = [...(conversationHistory || []), { role: 'user', content: userMessage }];
      const modelUpdates = {
        ...(parsed.updatedSpecs || {}),
        ...(parsed.extractedFromLatestMessage || {}),
      };

      let updatedSpecs = mergeAccumulatedSpecs(elicitationState.accumulatedSpecs, modelUpdates, fullHistory);

      // Merge attachment specifications if provided
      if (attachmentAnalysis?.extractedSpecs) {
        const es = attachmentAnalysis.extractedSpecs;
        const fromAttachment: Partial<AccumulatedSpecs> = {};
        if (es.productName && !updatedSpecs.product) fromAttachment.product = es.productName;
        if (es.category && !updatedSpecs.category) fromAttachment.category = es.category;
        if (es.quantity && !updatedSpecs.quantity) {
          const parsedQ = typeof es.quantity === 'number' ? es.quantity : Number(String(es.quantity).replace(/[^\d.]/g, ''));
          if (!isNaN(parsedQ) && parsedQ > 0) fromAttachment.quantity = parsedQ;
        }
        if (es.unit && !updatedSpecs.unit) fromAttachment.unit = es.unit;
        if (es.materialGrade && !updatedSpecs.materialGrade) fromAttachment.materialGrade = es.materialGrade;
        if (es.dimensions && !updatedSpecs.dimensions) fromAttachment.dimensions = es.dimensions;
        if (es.packaging && !updatedSpecs.packaging) fromAttachment.packaging = es.packaging;
        if (es.description) {
          fromAttachment.additionalNotes = [
            updatedSpecs.additionalNotes,
            es.description,
          ].filter(Boolean).join('\n');
        }
        if (es.certifications && es.certifications.length > 0) {
          fromAttachment.certifications = es.certifications;
        }
        updatedSpecs = mergeAccumulatedSpecs(updatedSpecs, fromAttachment);
      }

      if (!updatedSpecs.product) {
        updatedSpecs.product = this.extractProductName(userMessage, conversationHistory);
      }

      // Check if buyer requested AI smart defaults / "Suggest me"
      const isSuggesting = isSuggestRequest(userMessage);
      if (isSuggesting && updatedSpecs.product) {
        const smartDefaults = generateSmartDefaults(
          updatedSpecs.product,
          updatedSpecs.destination,
          updatedSpecs.quantity,
          updatedSpecs.unit
        );

        const autoSpecs: Partial<AccumulatedSpecs> = {};
        const suggestedMap: Record<string, { value: string; reason: string; confirmed: boolean }> = {};

        for (const sug of smartDefaults.suggestions) {
          suggestedMap[sug.field] = {
            value: sug.value,
            reason: sug.reason,
            confirmed: false,
          };
          if (sug.field === 'specifications.material_grade') {
            autoSpecs.materialGrade = sug.value;
          } else if (sug.field === 'compliance.certifications') {
            autoSpecs.certifications = sug.value.split(',').map((s) => s.trim());
          } else if (sug.field === 'packaging.packaging_type') {
            autoSpecs.packaging = sug.value;
          }
        }
        autoSpecs.aiSuggestedFields = suggestedMap;
        updatedSpecs = mergeAccumulatedSpecs(updatedSpecs, autoSpecs);
      }

      const newStageFromModel: SpecStage = (parsed.nextStage as SpecStage) || elicitationState.currentStage;
      const hasBase = Boolean(updatedSpecs.product && updatedSpecs.quantity && updatedSpecs.destination);

      const normMsg = userMessage.toLowerCase().trim();
      const isBuyerConfirmingBriefing = Boolean(
        normMsg.match(/\b(prepare|generate|build|create|run|proceed|go ahead|start|yes|ready|looks good|that'?s all|briefing now|prepare briefing|prepare executive sourcing briefing|yes,?\s*prepare)\b/) &&
        !normMsg.match(/\b(not yet|wait|more details|add details|add more|change|no\b)/)
      );
      const isBuyerAskingMore = Boolean(
        normMsg.match(/\b(more details|add details|add more|also|additional|wait|not yet|change)\b/)
      );

      let ready = false;
      let newStage: SpecStage = newStageFromModel;

      if (isSuggesting && updatedSpecs.product) {
        newStage = 'confirmation';
      } else if (hasBase) {
        if (isBuyerConfirmingBriefing && !isBuyerAskingMore) {
          ready = true;
          newStage = 'complete';
        } else if (parsed.isResearchReady && elicitationState.currentStage === 'confirmation') {
          ready = true;
          newStage = 'complete';
        } else {
          // Full information understood -> Ask buyer before preparing Executive Sourcing Briefing
          ready = false;
          newStage = 'confirmation';
        }
      } else {
        ready = false;
        if (newStage === 'complete' || newStage === 'confirmation') {
          if (!updatedSpecs.product) newStage = 'product';
          else if (!updatedSpecs.quantity) newStage = 'quantity';
          else if (!updatedSpecs.destination) newStage = 'destination';
          else newStage = 'specifications';
        }
      }

      const completedStages: SpecStage[] = [...elicitationState.completedStages];
      if (parsed.isCurrentStageSatisfied && !completedStages.includes(elicitationState.currentStage)) {
        completedStages.push(elicitationState.currentStage);
      }
      if (hasBase && !completedStages.includes('destination')) {
        completedStages.push('destination');
      }

      let agentQuestion = parsed.agentQuestion || this.generateStageQuestion(newStage, updatedSpecs);
      let suggestedOptions: IntakeOption[] = parsed.suggestedOptions || [];

      if (isSuggesting && updatedSpecs.product) {
        const destName = updatedSpecs.destination || 'your destination market';
        agentQuestion = `Based on standard export practices for **${updatedSpecs.product}** delivered to **${destName}**, I've filled in standard baseline specifications:\n\n` +
          (updatedSpecs.materialGrade ? `• **Quality & Heat Grade**: ${updatedSpecs.materialGrade}\n` : '') +
          (updatedSpecs.packaging ? `• **Packaging Format**: ${updatedSpecs.packaging}\n` : '') +
          (updatedSpecs.certifications?.length ? `• **Testing & Compliance**: ${updatedSpecs.certifications.join(', ')}\n` : '') +
          `\nThese market norms protect your shipment in ocean transit and ensure smooth customs clearance without extra regulatory friction. Would you like me to prepare the Executive Sourcing Briefing with these parameters, or would you like to adjust anything?`;

        suggestedOptions = [
          { label: 'Prepare Executive Sourcing Briefing', value: 'Yes, prepare the Executive Sourcing Briefing now', field: 'general' },
          { label: 'Adjust specifications', value: "I'd like to adjust the specifications", field: 'specifications' },
          { label: 'Set target budget', value: 'Our target budget is $... per unit', field: 'specifications' },
          { label: 'Set delivery timeline', value: 'Target delivery timeline is ... days', field: 'timeline' },
        ];
      } else if (newStage === 'confirmation') {
        // If the model produced a natural conversational response, preserve it!
        // Only use the canned stage question if agentQuestion is empty.
        if (!agentQuestion || agentQuestion.trim().length === 0) {
          agentQuestion = this.generateStageQuestion('confirmation', updatedSpecs);
        }
        if (!suggestedOptions || suggestedOptions.length === 0) {
          suggestedOptions = [
            { label: 'Prepare Executive Sourcing Briefing', value: 'Yes, prepare the Executive Sourcing Briefing now', field: 'general' },
            { label: '✨ Suggest me — optimize with market defaults', value: 'Suggest standard market specifications and shipment terms', field: 'general' },
            { label: 'Add more details', value: "I'd like to add more details", field: 'specifications' },
            { label: 'Set target budget', value: 'Our target budget is $... per unit', field: 'specifications' },
            { label: 'Set delivery timeline', value: 'Target delivery timeline is ... days', field: 'timeline' },
          ];
        }
      } else if (!suggestedOptions || suggestedOptions.length === 0) {
        suggestedOptions = this.generateDefaultOptions(updatedSpecs.product, updatedSpecs.destination);
      }

      // Ensure "Suggest me" option is present as first option when in specifications stage
      const hasSuggestOpt = suggestedOptions.some((opt) => opt.label.toLowerCase().includes('suggest') || opt.value.toLowerCase().includes('suggest'));
      if (!hasSuggestOpt && (newStage === 'specifications' || !updatedSpecs.materialGrade)) {
        suggestedOptions.unshift({
          label: '✨ Suggest me — standard market defaults',
          value: `Suggest standard market specifications and shipment terms for ${updatedSpecs.product || 'this product'} to ${updatedSpecs.destination || 'destination'}`,
          field: 'general',
        });
      }

      return {
        stage: ready ? 'complete' : newStage,
        isResearchReady: ready,
        agentQuestion,
        agentRationale: parsed.agentRationale || '',
        suggestedOptions,
        updatedSpecs,
        cardData: {
          completedStages,
          currentStageLabel: stageLabels[newStage] || newStage,
          progressPercent: stagePct[ready ? 'complete' : newStage] || 50,
        },
      };
    } catch {
      return this.heuristicElicitation(userMessage, elicitationState, attachmentAnalysis);
    }
  }

  private generateStageQuestion(stage: SpecStage | string, specs: AccumulatedSpecs): string {
    const product = specs.product || '';
    if (!product) {
      return `Hi! I'm your Proquoment sourcing advisor. What product, raw material, or merchandise are you looking to procure today?`;
    }
    switch (stage) {
      case 'product':
        return `What product or materials are you looking to source?`;
      case 'quantity':
        return `Got it, **${product}**! What target order volume or batch size do you have in mind?`;
      case 'destination':
        return `Where will this shipment be delivered? (Which country or discharge port?)`;
      case 'specifications':
        return `Are there specific material requirements, safety standards, or certifications needed for **${product}**?`;
      case 'timeline':
        return `What is your target delivery timeline or required lead time for this order?`;
      case 'confirmation':
        return `I have compiled your sourcing parameters for **${product}**:\n` +
          `• **Order Quantity:** ${specs.quantity ? `${specs.quantity.toLocaleString()} ${specs.unit || 'units'}` : 'Not specified'}\n` +
          `• **Destination:** ${specs.destination || 'Not specified'}\n` +
          (specs.materialGrade ? `• **Material / Grade:** ${specs.materialGrade}\n` : '') +
          (specs.certifications && specs.certifications.length > 0 ? `• **Certifications:** ${specs.certifications.join(', ')}\n` : '') +
          (specs.dimensions ? `• **Dimensions:** ${specs.dimensions}\n` : '') +
          (specs.packaging ? `• **Packaging:** ${specs.packaging}\n` : '') +
          `\nWould you like me to prepare the Executive Sourcing Briefing now, or would you like to add more details (such as target price, delivery timelines, or packaging preferences)?`;
      default:
        return `I have the key parameters for **${product}**. Shall I run the full sourcing and trade intelligence evaluation?`;
    }
  }

  private heuristicElicitation(
    userMessage: string,
    state: SpecElicitationState,
    attachmentAnalysis?: AttachmentAnalysisSummary
  ): SpecElicitationResponse {
    const lower = userMessage.toLowerCase();
    const extractedUpdates: Partial<AccumulatedSpecs> = {};

    // Extract product if missing
    if (!state.accumulatedSpecs.product) {
      extractedUpdates.product = this.extractProductName(userMessage);
    }

    // Extract quantity
    const qtyMatch = userMessage.match(/\b(\d+[\d,.]*)\s*(mt|metric tons?|tons?|units?|pcs|pieces?|kg|containers?|fcl|cbm)\b/i);
    if (qtyMatch) {
      extractedUpdates.quantity = Number(qtyMatch[1].replace(/,/g, ''));
      extractedUpdates.unit = qtyMatch[2].toLowerCase();
    }

    // Extract destination
    if (lower.includes('united states') || lower.includes('usa') || lower.includes('u.s.a') || lower.includes('america')) {
      extractedUpdates.destination = 'United States';
    } else if (lower.includes('indonesia') || lower.includes('jakarta')) {
      extractedUpdates.destination = 'Indonesia';
    } else if (lower.includes('uae') || lower.includes('dubai') || lower.includes('jebel ali')) {
      extractedUpdates.destination = 'UAE';
    } else if (lower.includes('vietnam')) {
      extractedUpdates.destination = 'Vietnam';
    } else if (lower.includes('india') || lower.includes('mumbai')) {
      extractedUpdates.destination = 'India';
    }

    // Extract specs / certifications
    const certs: string[] = [];
    if (lower.includes('fda')) certs.push('FDA Food Contact Standard');
    if (lower.includes('sni')) certs.push('SNI ISO 8124');
    if (lower.includes('ce') || lower.includes('en 71')) certs.push('CE EN 71');
    if (lower.includes('bpom')) certs.push('BPOM');
    if (certs.length > 0) extractedUpdates.certifications = certs;

    if (lower.includes('ceramic') || lower.includes('stoneware') || lower.includes('porcelain')) {
      extractedUpdates.materialGrade = 'Glazed Ceramic / Stoneware (Food Contact Safe)';
    } else if (lower.includes('polyester') || lower.includes('plush') || lower.includes('cotton')) {
      extractedUpdates.materialGrade = 'Plush Polyester / PP Cotton';
    }

    // Incorporate specs from attachment analysis
    if (attachmentAnalysis?.extractedSpecs) {
      const es = attachmentAnalysis.extractedSpecs;
      if (es.productName && !extractedUpdates.product) extractedUpdates.product = es.productName;
      if (es.materialGrade && !extractedUpdates.materialGrade) extractedUpdates.materialGrade = es.materialGrade;
      if (es.dimensions && !extractedUpdates.dimensions) extractedUpdates.dimensions = es.dimensions;
      if (es.packaging && !extractedUpdates.packaging) extractedUpdates.packaging = es.packaging;
      if (es.quantity && !extractedUpdates.quantity) {
        const num = typeof es.quantity === 'number' ? es.quantity : Number(String(es.quantity).replace(/[^\d.]/g, ''));
        if (!isNaN(num) && num > 0) extractedUpdates.quantity = num;
      }
      if (es.unit && !extractedUpdates.unit) extractedUpdates.unit = es.unit;
      if (es.certifications && es.certifications.length > 0) {
        extractedUpdates.certifications = Array.from(new Set([...(extractedUpdates.certifications || []), ...es.certifications]));
      }
    }

    const specs = mergeAccumulatedSpecs(state.accumulatedSpecs, extractedUpdates, [{ role: 'user', content: userMessage }]);

    // Determine readiness
    const hasBase = Boolean(specs.product && specs.quantity && specs.destination);
    const completedStages: SpecStage[] = [];
    if (specs.product) completedStages.push('product');
    if (specs.quantity) completedStages.push('quantity');
    if (specs.destination) completedStages.push('destination');
    if (specs.materialGrade || specs.certifications?.length) completedStages.push('specifications');

    let next: SpecStage = 'product';
    if (!specs.product) next = 'product';
    else if (!specs.quantity) next = 'quantity';
    else if (!specs.destination) next = 'destination';
    else if (!specs.materialGrade && !specs.certifications?.length && state.turnCount < 1) next = 'specifications';
    const isSuggesting = isSuggestRequest(userMessage);
    if (isSuggesting && specs.product) {
      const smartDefaults = generateSmartDefaults(
        specs.product,
        specs.destination,
        specs.quantity,
        specs.unit
      );

      const autoSpecs: Partial<AccumulatedSpecs> = {};
      const suggestedMap: Record<string, { value: string; reason: string; confirmed: boolean }> = {};

      for (const sug of smartDefaults.suggestions) {
        suggestedMap[sug.field] = {
          value: sug.value,
          reason: sug.reason,
          confirmed: false,
        };
        if (sug.field === 'specifications.material_grade') {
          autoSpecs.materialGrade = sug.value;
        } else if (sug.field === 'compliance.certifications') {
          autoSpecs.certifications = sug.value.split(',').map((s) => s.trim());
        } else if (sug.field === 'packaging.packaging_type') {
          autoSpecs.packaging = sug.value;
        }
      }
      autoSpecs.aiSuggestedFields = suggestedMap;
      Object.assign(specs, autoSpecs);
      next = 'confirmation';
    }

    const normMsg = userMessage.toLowerCase().trim();
    const isBuyerConfirming = Boolean(
      normMsg.match(/\b(prepare|generate|build|create|run|proceed|go ahead|start|yes|ready|looks good|that'?s all|briefing now|prepare briefing|prepare executive sourcing briefing|yes,?\s*prepare)\b/) &&
      !normMsg.match(/\b(not yet|wait|more details|add details|add more|change|no\b)/)
    );
    const isBuyerAddingMore = Boolean(
      normMsg.match(/\b(more details|add details|add more|also|additional|wait|not yet|change)\b/)
    );

    let ready = false;
    if (hasBase && isBuyerConfirming && !isBuyerAddingMore && !isSuggesting) {
      ready = true;
      next = 'complete';
    } else if (hasBase || isSuggesting) {
      next = 'confirmation';
    }

    const stageLabels: Record<string, string> = {
      product: 'Product Identification',
      quantity: 'Order Quantity',
      destination: 'Destination Market',
      specifications: 'Product Specifications',
      timeline: 'Timeline & Budget',
      confirmation: 'Review & Confirmation',
      complete: 'Complete',
    };

    const stagePct: Record<string, number> = {
      product: 15,
      quantity: 35,
      destination: 55,
      specifications: 75,
      timeline: 85,
      confirmation: 95,
      complete: 100,
    };

    let question = this.generateStageQuestion(ready ? 'complete' : next, specs);
    let options: IntakeOption[];

    if (isSuggesting && specs.product) {
      const destName = specs.destination || 'your destination market';
      question = `Based on standard export practices for **${specs.product}** delivered to **${destName}**, I've filled in standard baseline specifications:\n\n` +
        (specs.materialGrade ? `• **Quality & Heat Grade**: ${specs.materialGrade}\n` : '') +
        (specs.packaging ? `• **Packaging Format**: ${specs.packaging}\n` : '') +
        (specs.certifications?.length ? `• **Testing & Compliance**: ${specs.certifications.join(', ')}\n` : '') +
        `\nThese market norms protect your shipment in ocean transit and ensure smooth customs clearance without extra regulatory friction. Would you like me to prepare the Executive Sourcing Briefing with these parameters, or would you like to adjust anything?`;

      options = [
        { label: 'Prepare Executive Sourcing Briefing', value: 'Yes, prepare the Executive Sourcing Briefing now', field: 'general' },
        { label: 'Adjust specifications', value: "I'd like to adjust the specifications", field: 'specifications' },
        { label: 'Set target budget', value: 'Our target budget is $... per unit', field: 'specifications' },
        { label: 'Set delivery timeline', value: 'Target delivery timeline is ... days', field: 'timeline' },
      ];
    } else if (next === 'confirmation') {
      options = [
        { label: 'Prepare Executive Sourcing Briefing', value: 'Yes, prepare the Executive Sourcing Briefing now', field: 'general' },
        { label: '✨ Suggest me — optimize with market defaults', value: 'Suggest standard market specifications and shipment terms', field: 'general' },
        { label: 'Add more details', value: "I'd like to add more details", field: 'specifications' },
        { label: 'Set target budget', value: 'Our target budget is $... per unit', field: 'specifications' },
        { label: 'Set delivery timeline', value: 'Target delivery timeline is ... days', field: 'timeline' },
      ];
    } else {
      options = this.generateDefaultOptions(specs.product, specs.destination);
    }

    return {
      stage: ready ? 'complete' : next,
      isResearchReady: ready,
      agentQuestion: question,
      agentRationale: 'Precision sourcing requires validating specifications and regulatory boundaries before trade data modeling.',
      suggestedOptions: options,
      updatedSpecs: specs,
      cardData: {
        completedStages,
        currentStageLabel: stageLabels[ready ? 'complete' : next] || next,
        progressPercent: stagePct[ready ? 'complete' : next] || (completedStages.length * 20),
      },
    };
  }
}

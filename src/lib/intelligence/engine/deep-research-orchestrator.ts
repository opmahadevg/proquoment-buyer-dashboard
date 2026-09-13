import { ToolRegistry, globalToolRegistry } from '../tools/registry';
import { ModelGateway } from '../ai/model-gateway';
import { OpenRouterAdapter } from '../ai/openrouter-adapter';
import { AccumulatedSpecs } from '../core/conversation-state';
import { Evidence } from '../core/evidence';
import { CalculationRecord } from '../core/calculation';
import { DataGap } from '../core/data-gap';
import { ExecutionEvent } from './research-executor';
import { SourcingClassifier, SourcingClassificationResult } from '../ai/sourcing-classifier';
import { TradeTariffGrounder, TradeTariffGroundingResult } from '../ai/trade-tariff-grounder';

export interface DeepResearchResult {
  accumulatedEvidence: Evidence[];
  accumulatedCalculations: CalculationRecord[];
  accumulatedDataGaps: DataGap[];
  stepResults: Map<number, { status: string; data: any }>;
  resolvedHsCode?: string;
  resolvedOrigins?: string[];
  resolvedComplianceCerts?: string[];
  resolvedObservedPriceRange?: { low: number; high: number; unit: string };
  resolvedLandedCost?: {
    basePriceUSD: number;
    freightUSD: number;
    dutyUSD: number;
    vatUSD: number;
    landedPerUnitUSD: number;
    deltaPct: number;
  };
  resolvedSuppliers?: Array<{
    name: string;
    country: string;
    cluster?: string;
    verificationStatus?: string;
  }>;
  classificationResult?: SourcingClassificationResult;
  tradeGroundingResult?: TradeTariffGroundingResult;
}

export class DeepResearchOrchestrator {
  private toolRegistry: ToolRegistry;
  private modelGateway: ModelGateway;

  constructor(
    toolRegistry?: ToolRegistry,
    modelGateway?: ModelGateway
  ) {
    this.toolRegistry = toolRegistry || globalToolRegistry;
    this.modelGateway = modelGateway || new OpenRouterAdapter();
  }

  async execute(
    specs: AccumulatedSpecs,
    context: { buyerId: string; sessionId: string; workspaceId: string },
    onProgress?: (event: ExecutionEvent) => void
  ): Promise<DeepResearchResult> {
    const result: DeepResearchResult = {
      accumulatedEvidence: [],
      accumulatedCalculations: [],
      accumulatedDataGaps: [],
      stepResults: new Map(),
    };

    const product = specs.product || 'Commercial Goods';
    const destination = specs.destination || 'United States';
    const quantity = specs.quantity || 5000;
    const unit = specs.unit || 'pcs';

    // ── Call 1: Sourcing Classification & Entity Grounding ──
    onProgress?.({
      type: 'research_status',
      state: 'understanding',
      progressPercent: 15,
      message: `Running multi-stage AI classification for ${product}...`,
    });

    const classifier = new SourcingClassifier(this.modelGateway);
    const classification = await classifier.classify(specs);
    result.classificationResult = classification;
    result.resolvedHsCode = classification.primaryHsCode;
    result.resolvedComplianceCerts = classification.targetComplianceCerts;
    result.resolvedObservedPriceRange = classification.benchmarkFobUSD;

    // ── Call 2: Bilateral Trade & Tariff Grounding ──
    onProgress?.({
      type: 'research_status',
      state: 'planning',
      progressPercent: 20,
      message: `Evaluating bilateral trade remedies, FTAs, and applied tariffs into ${destination}...`,
    });

    const grounder = new TradeTariffGrounder(this.modelGateway);
    const tradeGrounding = await grounder.groundTradeAndTariffs(classification);
    result.tradeGroundingResult = tradeGrounding;

    const canonicalProduct = classification.canonicalProduct;
    let knownHsCode = classification.primaryHsCode;
    let candidateOrigins = tradeGrounding.rankedOrigins.map((o) => o.country);
    if (candidateOrigins.length === 0) candidateOrigins = classification.candidateOrigins;
    result.resolvedOrigins = candidateOrigins;
    let knownBasePriceUSD = classification.benchmarkFobUSD.low;

    // ── Group 1: Product Classification Tool Confirmation + Freight Benchmark (parallel) ──
    onProgress?.({
      type: 'research_status',
      state: 'researching',
      progressPercent: 30,
      message: `Corroborating ${canonicalProduct} under WCO HS ${knownHsCode} and modeling logistics routes...`,
    });

    const group1 = await Promise.allSettled([
      this.runTool(
        'identify_hs_code',
        { product_name: canonicalProduct, destination_country: destination },
        context
      ),
      this.runTool(
        'get_freight_estimate',
        { origin_country_or_port: candidateOrigins[0], destination_country_or_port: destination, container_type: '20GP' },
        context
      ),
    ]);

    if (group1[0].status === 'fulfilled' && group1[0].value.data?.primaryCode) {
      knownHsCode = group1[0].value.data.primaryCode;
      result.resolvedHsCode = knownHsCode;
      result.stepResults.set(1, group1[0].value);
    } else {
      result.resolvedHsCode = knownHsCode;
      result.accumulatedDataGaps.push({
        id: 'gap_hs',
        field: 'hs_code',
        reason: 'Automated HS code classification inferred from product description',
        severity: 'low',
        impactOnDecision: 'Minimal impact on preliminary CIF estimate',
      } as any);
    }

    if (group1[1].status === 'fulfilled') {
      result.stepResults.set(8, group1[1].value);
    }

    // ── Group 2: Trade volumes + Multi-Origin analysis + Tariffs + Supplier depth (parallel) ──
    onProgress?.({
      type: 'research_status',
      state: 'researching',
      progressPercent: 50,
      message: 'Analyzing bilateral customs records, tariff treaties, and multi-origin supplier landscape...',
    });

    const isUSADest = destination.toLowerCase().includes('usa') || destination.toLowerCase().includes('united states');
    const isCeramics = knownHsCode.startsWith('69') || classification.category.toLowerCase().includes('ceramic');
    const isPerUnitGood = isCeramics || unit.includes('unit') || unit.includes('piece') || unit.includes('pcs');

    const group2 = await Promise.allSettled([
      this.runTool(
        'get_trade_flows',
        { hs_code: knownHsCode, reporter_country: destination, years: [2025, 2024], product_name: canonicalProduct },
        context
      ),
      this.runTool(
        'get_tariff_data',
        {
          hs_code: knownHsCode,
          destination_country: destination,
          origin_countries: candidateOrigins,
          product_name: canonicalProduct,
        },
        context
      ),
      this.runTool(
        'compare_origins',
        {
          destination_country: destination,
          product_name: canonicalProduct,
          origins: candidateOrigins,
        },
        context
      ),
      this.runTool(
        'get_supplier_landscape',
        { product_name: canonicalProduct, origin_country: candidateOrigins[0] },
        context
      ),
    ]);

    if (group2[0].status === 'fulfilled') result.stepResults.set(2, group2[0].value);
    if (group2[1].status === 'fulfilled') result.stepResults.set(3, group2[1].value);
    if (group2[2].status === 'fulfilled') result.stepResults.set(7, group2[2].value);
    if (group2[3].status === 'fulfilled') {
      const suppData = group2[3].value?.data;
      result.resolvedSuppliers = suppData?.suppliers || [];
      result.stepResults.set(6, group2[3].value);
    }

    // ── Group 3: Price data + Compliance requirements (parallel) ──
    onProgress?.({
      type: 'research_status',
      state: 'researching',
      progressPercent: 70,
      message: 'Benchmarking customs declared CIF unit values and regulatory compliance mandates...',
    });

    const group3 = await Promise.allSettled([
      this.runTool(
        'get_price_data',
        { product_name: canonicalProduct, hs_code: knownHsCode, destination_country: destination },
        context
      ),
      this.runTool(
        'get_regulatory_requirements',
        {
          hs_code: knownHsCode,
          destination_country: destination,
          product_name: canonicalProduct,
        },
        context
      ),
    ]);

    if (group3[0].status === 'fulfilled') {
      const priceData = group3[0].value?.data;
      if (priceData?.observedTradeUnitValues) {
        result.resolvedObservedPriceRange = priceData.observedTradeUnitValues;
        knownBasePriceUSD = priceData.observedTradeUnitValues.low;
      }
      result.stepResults.set(4, group3[0].value);
    }

    if (group3[1].status === 'fulfilled') {
      const compData = group3[1].value?.data;
      result.resolvedComplianceCerts =
        compData?.requiredCertifications || classification.targetComplianceCerts;
      result.stepResults.set(5, group3[1].value);
    } else {
      result.resolvedComplianceCerts = classification.targetComplianceCerts;
    }

    // Determine top recommended origin from trade grounding or compare_origins ranking
    const topOriginName = tradeGrounding.topRecommendedOrigin.country || candidateOrigins[0];
    const resolvedDutyRate = tradeGrounding.topRecommendedOrigin.effectiveDutyPercent;

    // ── Group 4: Landed Cost Calculation ──
    onProgress?.({
      type: 'research_status',
      state: 'evaluating',
      progressPercent: 85,
      message: `Running deterministic landed cost model for ${topOriginName} (FOB + Freight + Duty + VAT)...`,
    });

    const freightEstimate = isPerUnitGood ? Math.round(quantity * (isCeramics ? 0.32 : 0.25)) : 1500;

    const group4 = await Promise.allSettled([
      this.runTool(
        'calculate_landed_cost',
        {
          product_name: canonicalProduct,
          hs_code: knownHsCode,
          origin_country: topOriginName,
          destination_country: destination,
          quantity,
          unit,
          base_price_usd: knownBasePriceUSD,
          freight_cost_usd: freightEstimate,
          import_duty_rate_percent: resolvedDutyRate,
          vat_rate_percent: isUSADest ? 0 : 11,
          port_handling_usd: isPerUnitGood ? Math.round(quantity * 0.05) : 200,
        },
        context
      ),
    ]);

    if (group4[0].status === 'fulfilled') {
      const calcData = group4[0].value?.data;
      if (calcData) {
        const freightPerUnit = Math.round((calcData.freightCostTotalUSD / quantity) * 100) / 100;
        const dutyPerUnit = Math.round((calcData.importDutyUSD / quantity) * 100) / 100;
        const vatPerUnit = Math.round(((calcData.vatTaxUSD + (calcData.portHandlingUSD || 0)) / quantity) * 100) / 100;

        result.resolvedLandedCost = {
          basePriceUSD: knownBasePriceUSD,
          freightUSD: isPerUnitGood ? freightPerUnit : calcData.freightCostTotalUSD,
          dutyUSD: isPerUnitGood ? dutyPerUnit : calcData.importDutyUSD,
          vatUSD: isPerUnitGood ? vatPerUnit : calcData.vatTaxUSD,
          landedPerUnitUSD: calcData.landedCostPerUnitUSD,
          deltaPct: calcData.landedCostDeltaPercent,
        };
        result.accumulatedCalculations.push({
          id: `calc_lc_${Date.now()}`,
          metric: 'Landed Cost Per Unit',
          formula: 'Base FOB + Allocated Freight + Customs Tariff + Taxes & Port Handling',
          inputs: {
            origin: topOriginName,
            destination,
            baseFOB: knownBasePriceUSD,
            dutyRatePercent: resolvedDutyRate,
            quantity,
            unit,
          },
          result: result.resolvedLandedCost,
          calculatedAt: new Date().toISOString(),
        });
        result.stepResults.set(9, group4[0].value);
      }
    }

    return result;
  }

  private async runTool(
    toolName: string,
    params: Record<string, any>,
    context: { buyerId: string; sessionId: string; workspaceId: string }
  ): Promise<{ status: string; data: any }> {
    try {
      const res = await this.toolRegistry.execute(toolName, params, context);
      return res;
    } catch {
      return { status: 'error', data: null };
    }
  }
}

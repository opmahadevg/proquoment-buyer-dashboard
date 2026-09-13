import { IntelligenceObjective, EvidenceRequirement } from '../core/sourcing-intent';

export interface ResearchStep {
  id: number;
  description: string;
  evidenceTarget: EvidenceRequirement;
  toolName: string;
  params: Record<string, any>;
  dependsOn: number[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
}

export interface ResearchPlan {
  id: string;
  objective: IntelligenceObjective;
  steps: ResearchStep[];
  parallelGroups: number[][]; // step IDs grouped for concurrent execution
  estimatedDurationSeconds: number;
}

export class ResearchPlanner {
  createPlan(objective: IntelligenceObjective): ResearchPlan {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const steps: ResearchStep[] = [];
    const prodName = objective.entities.product || 'Industrial Product';
    const dest = objective.entities.destination || 'Indonesia';
    const origins = objective.entities.candidateOrigins || ['India', 'China'];

    let stepCounter = 1;

    // Step 1: Identify Product
    const step1Id = stepCounter++;
    steps.push({
      id: step1Id,
      description: `Classify ${prodName} specifications and grades`,
      evidenceTarget: 'product_classification',
      toolName: 'identify_product',
      params: { raw_description: prodName },
      dependsOn: [],
      status: 'pending',
    });

    // Step 2: Identify HS Code
    const step2Id = stepCounter++;
    steps.push({
      id: step2Id,
      description: `Determine 6-digit HS tariff classification for ${dest}`,
      evidenceTarget: 'product_classification',
      toolName: 'identify_hs_code',
      params: { product_name: prodName, destination_country: dest },
      dependsOn: [step1Id],
      status: 'pending',
    });

    // Quick depth finishes after HS identification
    if (objective.depth === 'quick') {
      return {
        id: planId,
        objective,
        steps,
        parallelGroups: [[step1Id], [step2Id]],
        estimatedDurationSeconds: 4,
      };
    }

    // Step 3: Trade Flows (UN Comtrade + Google Search)
    const step3Id = stepCounter++;
    steps.push({
      id: step3Id,
      description: `Retrieve bilateral customs import flows into ${dest}`,
      evidenceTarget: 'import_demand',
      toolName: 'get_trade_flows',
      params: { reporter_country: dest, hs_code: objective.entities.hsCode?.replace('.', '') || '', product_name: prodName },
      dependsOn: [step2Id],
      status: 'pending',
    });

    // Step 4: Price Intelligence (Historical customs unit values & commodity benchmarks + Google Search)
    const step4Id = stepCounter++;
    steps.push({
      id: step4Id,
      description: `Analyze historical customs trade unit values and commodity index benchmarks`,
      evidenceTarget: 'observed_price',
      toolName: 'get_price_data',
      params: { product_name: prodName, destination_country: dest },
      dependsOn: [step2Id],
      status: 'pending',
    });

    // Step 5: Regulatory & Compliance (WTO ePing)
    const step5Id = stepCounter++;
    steps.push({
      id: step5Id,
      description: `Examine mandatory certifications and SPS/TBT notifications for ${prodName}`,
      evidenceTarget: 'compliance_rules',
      toolName: 'get_regulatory_requirements',
      params: { destination_country: dest, product_name: prodName },
      dependsOn: [step1Id],
      status: 'pending',
    });

    // Step 6: Supplier Landscape
    const step6Id = stepCounter++;
    steps.push({
      id: step6Id,
      description: `Scan verified supplier directory and manufacturing hubs`,
      evidenceTarget: 'supplier_depth',
      toolName: 'get_supplier_landscape',
      params: { product_name: prodName, origin_country: origins[0] || 'India' },
      dependsOn: [step1Id],
      status: 'pending',
    });

    // Step 7: Tariff rates (WITS + Google Search)
    const step7Id = stepCounter++;
    steps.push({
      id: step7Id,
      description: `Retrieve MFN and preferential bilateral tariff rates`,
      evidenceTarget: 'tariff_duties',
      toolName: 'get_tariff_data',
      params: {
        destination_country: dest,
        origin_country: origins[0] || 'IND',
        hs_code: objective.entities.hsCode?.replace('.', '') || '',
        product_name: prodName,
      },
      dependsOn: [step2Id],
      status: 'pending',
    });

    // Step 8: Freight Benchmark
    const step8Id = stepCounter++;
    steps.push({
      id: step8Id,
      description: `Calculate ocean freight benchmark from key origin ports to ${dest}`,
      evidenceTarget: 'freight_benchmark',
      toolName: 'get_freight_estimate',
      params: { origin_country_or_port: origins[0] || 'India', destination_country_or_port: dest },
      dependsOn: [],
      status: 'pending',
    });

    // Step 9: Landed Cost Calculation
    const step9Id = stepCounter++;
    steps.push({
      id: step9Id,
      description: `Deterministically calculate landed cost per unit into ${dest}`,
      evidenceTarget: 'landed_cost',
      toolName: 'calculate_landed_cost',
      params: {
        base_price_usd: 0,
        freight_cost_usd: 1500,
        import_duty_rate_percent: 0,
        quantity: objective.entities.quantity || 1,
        unit: objective.entities.unit || 'units',
      },
      dependsOn: [step4Id, step7Id, step8Id],
      status: 'pending',
    });

    // Step 10: Origin Comparison (Deep research only)
    let step10Id: number | undefined;
    if (objective.depth === 'deep' || objective.objective === 'compare_origins' || objective.objective === 'make_sourcing_decision') {
      step10Id = stepCounter++;
      steps.push({
        id: step10Id,
        description: `Evaluate deterministic sourcing scores and rank candidate origins (${origins.join(' vs ')})`,
        evidenceTarget: 'origin_market_share',
        toolName: 'compare_origins',
        params: { destination_country: dest, product_name: prodName, origins },
        dependsOn: [step3Id, step9Id],
        status: 'pending',
      });
    }

    // Determine parallel execution groups based on dependencies
    const parallelGroups: number[][] = [
      [step1Id, step8Id], // can start product and freight in parallel
      [step2Id, step5Id, step6Id], // once step1 finishes, can do HS, regulatory, suppliers
      [step3Id, step4Id, step7Id], // once HS is known, run trade, price, tariffs concurrently
      [step9Id], // once price, tariff, freight are ready, run landed cost
    ];

    if (step10Id) {
      parallelGroups.push([step10Id]);
    }

    return {
      id: planId,
      objective,
      steps,
      parallelGroups,
      estimatedDurationSeconds: objective.depth === 'deep' ? 25 : 12,
    };
  }
}

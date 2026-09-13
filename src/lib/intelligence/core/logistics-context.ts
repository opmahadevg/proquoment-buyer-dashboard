export interface FreightBenchmark {
  originPort: string;
  destinationPort: string;
  containerType: '20GP' | '40GP' | '40HC' | 'LCL' | 'Air';
  estimatedCostMin: number;
  estimatedCostMax: number;
  currency: string;
  transitDaysMin: number;
  transitDaysMax: number;
  benchmarkDate: string;
  confidence: 'high' | 'medium' | 'low';
  assumptions: string[];
}

export interface LogisticsContext {
  primaryRoutes?: FreightBenchmark[];
  destinationPorts?: string[];
  candidateOriginPorts?: string[];
  recommendedIncoterms?: string[];
  averageTransitDays?: number;
  customsClearanceDaysEst?: number;
  riskFactors?: string[];
}

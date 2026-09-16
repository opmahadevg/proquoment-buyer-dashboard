import { CalculationResult } from '../core/calculation';

export interface LandedCostInput {
  basePriceUSD: number; // FOB price per unit
  quantity: number;
  unit: string;
  unitBasis?: 'piece' | 'MT' | 'KG' | 'unit' | string;
  buyerTargetPricePerPiece?: number;
  freightCostUSD: number; // estimated freight benchmark
  insuranceRatePercent?: number; // e.g. 0.3% default
  importDutyRatePercent?: number; // e.g. 5%
  vatOrSalesTaxPercent?: number; // e.g. 10%
  portHandlingCostUSD?: number; // estimated port clearance & terminal fees
}

export interface LandedCostBreakdown {
  baseCostTotalUSD: number;
  freightCostTotalUSD: number;
  insuranceCostUSD: number;
  cifTotalUSD: number;
  importDutyUSD: number;
  vatTaxUSD: number;
  portHandlingUSD: number;
  totalLandedCostUSD: number;
  landedCostPerUnitUSD: number;
  landedCostDeltaPercent: number; // (landed - base) / base * 100
}

export function calculateLandedCost(
  input: LandedCostInput
): CalculationResult<LandedCostBreakdown> {
  const formula = 'Base + Freight + Insurance + Duty + VAT + Handling';
  const qty = input.quantity > 0 ? input.quantity : 1;
  const baseTotal = input.basePriceUSD * qty;
  const freightTotal = input.freightCostUSD;
  const insRate = (input.insuranceRatePercent ?? 0.3) / 100;
  const insuranceTotal = Math.round((baseTotal + freightTotal) * insRate * 100) / 100;
  const cifTotal = baseTotal + freightTotal + insuranceTotal;

  const dutyRate = (input.importDutyRatePercent ?? 0) / 100;
  const dutyTotal = Math.round(cifTotal * dutyRate * 100) / 100;

  const vatRate = (input.vatOrSalesTaxPercent ?? 0) / 100;
  const vatTotal = Math.round((cifTotal + dutyTotal) * vatRate * 100) / 100;

  const handlingTotal = input.portHandlingCostUSD ?? 150;

  const grandTotal = Math.round((cifTotal + dutyTotal + vatTotal + handlingTotal) * 100) / 100;
  const unitLanded = Math.round((grandTotal / qty) * 100) / 100;
  const deltaPct = input.basePriceUSD > 0
    ? Math.round(((unitLanded - input.basePriceUSD) / input.basePriceUSD) * 1000) / 10
    : 0;

  let unitDisparityNotice = '';
  if (input.buyerTargetPricePerPiece && input.basePriceUSD > 0) {
    const ratio = input.basePriceUSD / input.buyerTargetPricePerPiece;
    if (ratio > 20) {
      unitDisparityNotice = ` ⚠️ Unit disparity notice: Base cost $${input.basePriceUSD} appears to reflect bulk metric tons (MT), while buyer target is $${input.buyerTargetPricePerPiece}/piece.`;
    }
  }

  const breakdown: LandedCostBreakdown = {
    baseCostTotalUSD: baseTotal,
    freightCostTotalUSD: freightTotal,
    insuranceCostUSD: insuranceTotal,
    cifTotalUSD: cifTotal,
    importDutyUSD: dutyTotal,
    vatTaxUSD: vatTotal,
    portHandlingUSD: handlingTotal,
    totalLandedCostUSD: grandTotal,
    landedCostPerUnitUSD: unitLanded,
    landedCostDeltaPercent: deltaPct,
  };

  return {
    result: breakdown,
    formula,
    inputs: { ...input },
    explanation: `Estimated Landed Cost: $${unitLanded.toLocaleString()} USD/${input.unit} (+${deltaPct}% over FOB base).${unitDisparityNotice}`,
  };
}

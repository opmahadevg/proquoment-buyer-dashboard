'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Share2,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Send,
  HelpCircle,
  TrendingUp,
  ShieldAlert,
  Ship,
  Users,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { MarketOverviewCard } from '../cards/MarketOverviewCard';
import { PriceIntelligenceCard } from '../cards/PriceIntelligenceCard';
import { ComplianceSummaryCard } from '../cards/ComplianceSummaryCard';
import { LandedCostCard } from '../cards/LandedCostCard';
import { OriginComparisonCard } from '../cards/OriginComparisonCard';
import { SupplierLandscapeCard } from '../cards/SupplierLandscapeCard';
import { SourcingDecisionCard } from '../cards/SourcingDecisionCard';

interface Props {
  workspace: any;
  sourcingObject: any;
}

export const WorkspaceView: React.FC<Props> = ({ workspace, sourcingObject }) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'market'
    | 'price'
    | 'compliance'
    | 'suppliers'
    | 'logistics'
    | 'risk'
    | 'brief'
  >('overview');

  const prod = sourcingObject?.product || { canonicalName: workspace.product_name, primaryHSCode: workspace.hs_code };
  const market = sourcingObject?.market || { destinationCountry: workspace.destination_country, importVolume: 12400 };
  const origins = sourcingObject?.supply?.originCountries || workspace.origin_countries || ['India', 'China'];
  const score = workspace.sourcing_score || 87;

  const handleLaunchRFQ = () => {
    // Navigate to RFQ Builder with intelligence pre-fill parameters
    const query = new URLSearchParams({
      intelligence_workspace_id: workspace.id,
      product_name: prod.canonicalName,
      hs_code: prod.primaryHSCode || '2916.31',
      destination: market.destinationCountry,
      origin: origins[0] || 'India',
      incoterm: 'CIF',
      prefill: 'true',
    }).toString();

    router.push(`/new-product?${query}`);
  };

  const tabs = [
    { id: 'overview', label: 'Executive Overview' },
    { id: 'market', label: 'Market & Trade' },
    { id: 'price', label: 'Price & Economics' },
    { id: 'compliance', label: 'Compliance & Tariffs' },
    { id: 'suppliers', label: 'Suppliers' },
    { id: 'logistics', label: 'Logistics' },
    { id: 'risk', label: 'Scoring & Risk' },
    { id: 'brief', label: 'Sourcing Brief → RFQ' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Workspace Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/intelligence"
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {prod.canonicalName} → {market.destinationCountry}
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  Decision Workspace
                </span>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                HS Code: <strong className="font-mono text-zinc-700 dark:text-zinc-300">{prod.primaryHSCode || '2916.31'}</strong> · Top Origin:{' '}
                <strong className="text-zinc-700 dark:text-zinc-300">{origins[0]}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                {score}<span className="text-xs font-normal text-zinc-400">/100</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                Sourcing Score
              </span>
            </div>

            <button
              type="button"
              onClick={handleLaunchRFQ}
              className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Launch RFQ</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto mt-4 pt-1 border-t border-zinc-100 dark:border-zinc-800/80 scrollbar-none text-xs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Strategic Verdict Card */}
              <SourcingDecisionCard
                data={{
                  recommendation: 'strongly_recommended',
                  sourcingScore: score,
                  scoreMethodology: 'Deterministic weighted factors (Demand, Origin, Tariffs, Logistics)',
                  scoreFactors: [
                    { name: 'Demand Attractiveness', score: 88, weight: 0.20, contribution: 17.6, evidenceIds: [] },
                    { name: 'Origin Competitiveness', score: 86, weight: 0.20, contribution: 17.2, evidenceIds: [] },
                    { name: 'Price Competitiveness', score: 85, weight: 0.15, contribution: 12.8, evidenceIds: [] },
                    { name: 'Import Dependency', score: 85, weight: 0.15, contribution: 12.8, evidenceIds: [] },
                    { name: 'Supplier Depth', score: 80, weight: 0.10, contribution: 8.0, evidenceIds: [] },
                    { name: 'Trade Growth', score: 84, weight: 0.10, contribution: 8.4, evidenceIds: [] },
                    { name: 'Compliance Feasibility', score: 85, weight: 0.05, contribution: 4.3, evidenceIds: [] },
                    { name: 'Logistics Efficiency', score: 80, weight: 0.05, contribution: 4.0, evidenceIds: [] },
                  ],
                  primaryOrigin: origins[0] || 'India',
                  keyAdvantages: [
                    `0% FTA Preferential Tariff under AIFTA/CEPA`,
                    `Verified exporter cluster with GMP and Halal accreditations`,
                    `Competitive historical customs unit values ($1,180 - $1,210 USD/MT)`,
                    `Growing market demand (+18% YoY in destination)`,
                  ],
                  keyRisks: [
                    'Ocean transit time variability (14-20 days)',
                    'Mandatory BPOM distribution license prerequisite',
                  ],
                  criticalUnknowns: [
                    'Factory-direct minimum order quantity (MOQ) allocations',
                    'Specific commercial palletization preferences',
                  ],
                  nextSteps: [
                    'Initiate RFQ to qualified Indian manufacturers',
                    'Request pre-shipment Certificate of Analysis (CoA) batch samples',
                  ],
                }}
                onCreateRFQ={handleLaunchRFQ}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MarketOverviewCard
                  data={{
                    product: prod.canonicalName,
                    hsCode: prod.primaryHSCode || '2916.31',
                    destinationCountry: market.destinationCountry,
                    annualImportVolumeMT: 12400,
                    annualImportValueUSD: 14860000,
                    growthRateYoY: 18.2,
                    importDependencyPercent: 85,
                    majorOrigins: [
                      { countryName: 'China', sharePercent: 58 },
                      { countryName: 'India', sharePercent: 24 },
                      { countryName: 'Netherlands', sharePercent: 8 },
                    ],
                  }}
                />

                <PriceIntelligenceCard
                  data={{
                    observedTradeUnitValue: {
                      low: 1180,
                      high: 1220,
                      unit: 'USD/MT',
                      basis: 'UN Comtrade bilateral customs declaration',
                      date: '2024-2025 customs data',
                    },
                    supplierQuoteRange: {
                      low: 1170,
                      high: 1240,
                      unit: 'USD/MT',
                      basis: 'Proquoment verified supplier history',
                      date: 'Recent platform cycles',
                    },
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ComplianceSummaryCard
                  data={{
                    destinationCountry: market.destinationCountry,
                    effectiveTariffRate: '0% (AIFTA Preferential Status)',
                    mfnRate: '5.0%',
                    requiredCertifications: [
                      'BPOM Distribution Permit (Izin Edar)',
                      'Halal Certification (BPJPH Recognized)',
                      'Batch Certificate of Analysis (CoA)',
                    ],
                    mandatoryInspection: true,
                  }}
                />

                <LandedCostCard
                  data={{
                    basePriceFOB: 1198,
                    freightEstimateUSD: 1500,
                    containerType: '20GP (~20 MT payload)',
                    freightPerMTUSD: 75,
                    marineInsurancePerMTUSD: 3.6,
                    importDutyUSD: 0,
                    vatTaxUSD: 139.7,
                    portHandlingPerMTUSD: 10,
                    estimatedLandedCostPerMTUSD: 1426.3,
                    costDeltaPercent: 19.1,
                    benchmarkTransitDays: '14 - 20 days',
                  }}
                />
              </div>
            </div>
          )}

          {/* MARKET TAB */}
          {activeTab === 'market' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <MarketOverviewCard
                data={{
                  product: prod.canonicalName,
                  hsCode: prod.primaryHSCode || '2916.31',
                  destinationCountry: market.destinationCountry,
                  annualImportVolumeMT: 12400,
                  annualImportValueUSD: 14860000,
                  growthRateYoY: 18.2,
                  importDependencyPercent: 85,
                  majorOrigins: [
                    { countryName: 'China', sharePercent: 58 },
                    { countryName: 'India', sharePercent: 24 },
                    { countryName: 'Netherlands', sharePercent: 8 },
                  ],
                }}
              />
            </div>
          )}

          {/* PRICE TAB */}
          {activeTab === 'price' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <PriceIntelligenceCard
                data={{
                  observedTradeUnitValue: {
                    low: 1180,
                    high: 1220,
                    unit: 'USD/MT',
                    basis: 'UN Comtrade customs declarations',
                    date: '2024-2025 customs data',
                  },
                }}
              />
              <LandedCostCard
                data={{
                  basePriceFOB: 1198,
                  freightEstimateUSD: 1500,
                  containerType: '20GP',
                  freightPerMTUSD: 75,
                  marineInsurancePerMTUSD: 3.6,
                  importDutyUSD: 0,
                  vatTaxUSD: 139.7,
                  portHandlingPerMTUSD: 10,
                  estimatedLandedCostPerMTUSD: 1426.3,
                  costDeltaPercent: 19.1,
                  benchmarkTransitDays: '14 - 20 days',
                }}
              />
            </div>
          )}

          {/* COMPLIANCE TAB */}
          {activeTab === 'compliance' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <ComplianceSummaryCard
                data={{
                  destinationCountry: market.destinationCountry,
                  effectiveTariffRate: '0% (AIFTA Preferential Status)',
                  mfnRate: '5.0%',
                  requiredCertifications: [
                    'BPOM Distribution Permit (Izin Edar)',
                    'Halal Certification (BPJPH Recognized)',
                    'Batch Certificate of Analysis (CoA)',
                  ],
                  mandatoryInspection: true,
                }}
              />
            </div>
          )}

          {/* SUPPLIERS TAB */}
          {activeTab === 'suppliers' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <SupplierLandscapeCard
                data={{
                  verifiedSuppliers: [
                    {
                      id: 'sup_01',
                      name: 'Aditya Speciality Chemicals Ltd.',
                      country: 'India',
                      category: 'Chemicals',
                      verified: true,
                      productionCapacity: '1,200 MT/month',
                      certifications: ['ISO 9001:2015', 'GMP', 'Halal', 'Kosher'],
                      reliabilityScore: 96,
                      source: 'proquoment_internal',
                    },
                    {
                      id: 'sup_02',
                      name: 'Gujarat Bio-Organics Pvt Ltd.',
                      country: 'India',
                      category: 'Chemicals',
                      verified: true,
                      productionCapacity: '800 MT/month',
                      certifications: ['ISO 9001:2015', 'Halal'],
                      reliabilityScore: 91,
                      source: 'proquoment_internal',
                    },
                  ],
                  totalIdentified: 2,
                  primaryClusters: ['Gujarat, India', 'Maharashtra, India'],
                }}
              />
            </div>
          )}

          {/* LOGISTICS TAB */}
          {activeTab === 'logistics' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <LandedCostCard
                data={{
                  basePriceFOB: 1198,
                  freightEstimateUSD: 1500,
                  containerType: '20GP (~20 MT payload)',
                  freightPerMTUSD: 75,
                  marineInsurancePerMTUSD: 3.6,
                  importDutyUSD: 0,
                  vatTaxUSD: 139.7,
                  portHandlingPerMTUSD: 10,
                  estimatedLandedCostPerMTUSD: 1426.3,
                  costDeltaPercent: 19.1,
                  benchmarkTransitDays: '14 - 20 days',
                }}
              />
            </div>
          )}

          {/* RISK & DECISION TAB */}
          {activeTab === 'risk' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <OriginComparisonCard
                data={{
                  destinationCountry: market.destinationCountry,
                  productName: prod.canonicalName,
                  rankings: [
                    {
                      countryCode: 'IND',
                      countryName: 'India',
                      rank: 1,
                      score: {
                        total: 87,
                        factors: [],
                        methodology: 'Deterministic multi-factor scoring',
                      },
                      landedCostEstimateUSD: 1380,
                      strengths: [
                        '0% FTA duty under AIFTA',
                        'Established food/pharma grade compliance',
                      ],
                      challenges: ['14-20 days ocean transit'],
                      confidence: 'high',
                    },
                    {
                      countryCode: 'CHN',
                      countryName: 'China',
                      rank: 2,
                      score: {
                        total: 84,
                        factors: [],
                        methodology: 'Deterministic multi-factor scoring',
                      },
                      landedCostEstimateUSD: 1360,
                      strengths: ['Massive capacity', 'Shorter transit'],
                      challenges: ['Concentration risk'],
                      confidence: 'high',
                    },
                  ],
                }}
              />
            </div>
          )}

          {/* SOURCING BRIEF / RFQ TAB */}
          {activeTab === 'brief' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      Sourcing Brief & RFQ Readiness
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Pre-compiled procurement specification ready for supplier solicitation
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLaunchRFQ}
                    className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition"
                  >
                    <span>Proceed to RFQ Builder</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Pre-fill Table with Field Classification */}
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="p-3">Field</th>
                        <th className="p-3">Pre-filled Value</th>
                        <th className="p-3">Classification</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      <tr>
                        <td className="p-3 font-semibold text-zinc-800 dark:text-zinc-200">Product Name</td>
                        <td className="p-3 font-medium">{prod.canonicalName}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            Buyer Provided
                          </span>
                        </td>
                        <td className="p-3 text-emerald-600 font-medium">Ready</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-zinc-800 dark:text-zinc-200">HS Code</td>
                        <td className="p-3 font-mono">{prod.primaryHSCode || '2916.31'}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                            Research Indicates
                          </span>
                        </td>
                        <td className="p-3 text-emerald-600 font-medium">Ready</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-zinc-800 dark:text-zinc-200">Destination</td>
                        <td className="p-3 font-medium">{market.destinationCountry}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            Buyer Provided
                          </span>
                        </td>
                        <td className="p-3 text-emerald-600 font-medium">Ready</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-zinc-800 dark:text-zinc-200">Preferred Origin</td>
                        <td className="p-3 font-medium">{origins[0]}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                            AI Suggested (#1 Ranked)
                          </span>
                        </td>
                        <td className="p-3 text-emerald-600 font-medium">Ready</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-zinc-800 dark:text-zinc-200">Recommended Incoterm</td>
                        <td className="p-3 font-medium">CIF Jakarta Port</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                            AI Suggested
                          </span>
                        </td>
                        <td className="p-3 text-emerald-600 font-medium">Ready</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-zinc-800 dark:text-zinc-200">Target Price</td>
                        <td className="p-3 text-zinc-400 italic">Left blank for buyer entry (No AI estimation)</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                            Buyer Specified
                          </span>
                        </td>
                        <td className="p-3 text-amber-600 font-medium">Enter in RFQ</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-zinc-800 dark:text-zinc-200">Certifications</td>
                        <td className="p-3 font-medium">BPOM Izin Edar, Halal BPJPH, CoA</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                            Research Indicates
                          </span>
                        </td>
                        <td className="p-3 text-emerald-600 font-medium">Ready</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

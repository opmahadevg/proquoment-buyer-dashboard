'use client';

import { useState, useEffect, useCallback } from 'react';
import { IntelligenceResponse, StructuredCard, SuggestedAction } from './core/intelligence-result';
import { ResearchState } from './core/research-state';
import { SpecElicitationState, createInitialElicitationState, AccumulatedSpecs } from './core/conversation-state';
import { AttachmentAnalysisSummary } from './core/attachment-analysis';

export interface IntelligenceSession {
  id: string;
  title: string;
  workspaceId?: string;
  status: 'active' | 'archived';
  score?: number;
  date?: string;
  productName?: string;
  destination?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntelligenceAttachment {
  name: string;
  type: string;
  size?: number;
  dataUrl?: string;
  url?: string;
  text?: string;
}

export interface IntelligenceMessageItem {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  attachments?: IntelligenceAttachment[];
  cards?: StructuredCard[];
  evidenceIds?: string[];
  suggestedActions?: SuggestedAction[];
  researchState?: ResearchState;
  attachmentAnalysis?: AttachmentAnalysisSummary;
  createdAt: string;
}

export interface WorkspaceSummary {
  id: string;
  productName: string;
  hsCode?: string;
  destinationCountry: string;
  originCountries: string[];
  status: 'active' | 'archived' | 'converted';
  sourcingScore?: number;
  updatedAt: string;
}

// ── Default Seed Sessions (Includes Red Chilli past session) ──
export const DEFAULT_SESSIONS: IntelligenceSession[] = [
  {
    id: 'sess_default_chilli',
    title: 'Red Chilli (Dried Whole) → Indonesia (500 kg)',
    productName: 'Red chilli',
    destination: 'Indonesia',
    score: 85,
    date: 'Just now',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sess_default_01',
    title: 'Teddy Bears (Plush Toys) → Indonesia (5,000 Units)',
    productName: 'Teddy Bears',
    destination: 'Indonesia',
    score: 84,
    date: '15 mins ago',
    status: 'active',
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'sess_default_02',
    title: 'Sodium Benzoate Sourcing → Indonesia (500 MT)',
    productName: 'Sodium Benzoate',
    destination: 'Indonesia',
    score: 87,
    date: '2 hours ago',
    status: 'active',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'sess_default_03',
    title: 'Hospital Furniture → UAE (200 Units)',
    productName: 'Hospital Furniture',
    destination: 'UAE',
    score: 82,
    date: '1 day ago',
    status: 'active',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
];

// Pre-seeded conversation messages with full Executive Sourcing Briefings
const DEFAULT_MESSAGES_MAP: Record<string, IntelligenceMessageItem[]> = {
  sess_default_chilli: [
    {
      id: 'msg_chilli_1',
      sessionId: 'sess_default_chilli',
      role: 'user',
      content: 'Source 500 kg Red chilli into Indonesia Port of Tanjung Priok, dried whole premium grade, 30 days lead time',
      createdAt: new Date(Date.now() - 60000).toISOString(),
    },
    {
      id: 'msg_chilli_2',
      sessionId: 'sess_default_chilli',
      role: 'assistant',
      content:
        'I have completed a comprehensive sourcing intelligence evaluation for **Red chilli** into **Indonesia (Port of Tanjung Priok)**.\n\n' +
        '### Strategic Procurement Briefing:\n' +
        '- **Product Classification**: Classified under HS Code **0904.21** (Dried whole fruits of the genus Capsicum).\n' +
        '- **Trade Corridors**: Verified bilateral customs import volumes from India (54% market share) and China (28% market share) into Indonesia.\n' +
        '- **Recommended Origin**: Ranked **India** as optimal sourcing origin offering 0% preferential import tariff under the ASEAN-India Free Trade Agreement (AIFTA).\n' +
        '- **Compliance Mandates**: Mandatory Phytosanitary Certificate from exporting authority, Certificate of Origin (Form A/AI), and BPOM food import notification.\n' +
        '- **Landed Cost**: Modeled deterministic landed cost benchmark at $2,814 USD/MT (CIF Jakarta + Port Handling + Import VAT).',
      cards: [
        {
          id: 'card_briefing_chilli',
          type: 'sourcing_briefing',
          title: 'Executive Sourcing Briefing: Red chilli → Indonesia',
          data: {
            productProfile: {
              name: 'Red chilli',
              category: 'Agricultural Commodities & Spices',
              hsCode: '0904.21',
              materialGrade: 'Grade A Export Quality',
              certifications: ['Phytosanitary Certificate', 'Certificate of Origin (Form A/AI)', 'BPOM Registered Food Import'],
              packaging: '25kg / 50kg Export Jute / Poly Bags',
              dimensions: null,
              orderQuantity: '500 kg sample units',
            },
            marketSnapshot: {
              destinationCountry: 'Indonesia',
              annualImportVolumeMT: 16800,
              annualImportValueUSD: 38600000,
              growthRateYoY: 14.8,
              majorOrigins: [
                { countryName: 'India', sharePercent: 54 },
                { countryName: 'China', sharePercent: 28 },
                { countryName: 'Vietnam', sharePercent: 12 },
              ],
            },
            recommendedOrigins: [
              {
                rank: 1,
                country: 'India',
                advantage: '5% tariff reduction under ASEAN-India Free Trade Agreement (AIFTA). Established Guntur spice export hub.',
                effectiveDuty: '0% (Preferential FTA Rate)',
                leadTimeDays: '18 - 28 days',
              },
              {
                rank: 2,
                country: 'China',
                advantage: 'Alternative supply corridor offering fast ocean transit from Guangzhou / Qingdao.',
                effectiveDuty: '5% MFN Baseline',
                leadTimeDays: '20 - 30 days',
              },
            ],
            complianceChecklist: [
              { item: 'Phytosanitary Certificate (Exporting NPPO)', required: true, status: 'done', priority: 'critical' },
              { item: 'Certificate of Origin (Form A/AI for 0% Duty)', required: true, status: 'done', priority: 'critical' },
              { item: 'BPOM Food Safety Import Approval (Surat Keterangan Impor)', required: true, status: 'pending', priority: 'critical' },
              { item: 'Fumigation Certificate (Methyl Bromide / Phosphine)', required: true, status: 'pending', priority: 'important' },
            ],
            historicalPriceRef: {
              low: 2200,
              high: 3400,
              unit: 'USD/MT',
              basis: 'Customs CIF declaration historical records (2024 - 2025)',
              notice: 'Historical customs benchmark CIF values. Actual spot prices are determined directly via supplier bids in RFQ.',
            },
            landedCostTable: {
              basePriceUSD: 2400,
              freightUSD: 1500,
              dutyUSD: 0,
              vatUSD: 264,
              totalLandedPerUnitUSD: 2814,
              costDeltaPercent: 17.25,
              containerType: '20GP Container',
              transitDays: '14 - 20 days',
              basis: 'Deterministic benchmark: Base FOB + Ocean Freight + FTA Duty + Import VAT',
            },
            sourcingScore: 85,
            rfqReadyScore: 92,
            nextSteps: [
              'Create Sourcing Brief and launch RFQ on Proquoment platform',
              'Request product pre-production samples from India exporters (Guntur hub)',
              'Verify Phytosanitary test specifications and laboratory certificates',
              'Confirm Incoterm (FOB vs CIF) and lock ocean freight transit window',
            ],
          },
        },
      ],
      suggestedActions: [
        {
          id: 'act_rfq_chilli',
          label: 'Create Sourcing Brief & Launch RFQ',
          prompt: 'Convert this sourcing intelligence for Red chilli into an active RFQ.',
          actionType: 'generate_rfq',
        },
        {
          id: 'act_compare_chilli',
          label: 'Compare India vs China in Detail',
          prompt: 'Compare India and China in depth for sourcing Red chilli to Indonesia.',
          actionType: 'compare_origins',
        },
        {
          id: 'act_freight_chilli',
          label: 'Calculate 40ft Container Freight Scenarios',
          prompt: 'Calculate landed cost scenarios with 40ft container freight rates.',
          actionType: 'check_landed_cost',
        },
      ],
      createdAt: new Date().toISOString(),
    },
  ],
  sess_default_01: [
    {
      id: 'msg_tb_1',
      sessionId: 'sess_default_01',
      role: 'user',
      content: 'Teddy Bears (Plush Toys) 5,000 units to Indonesia, SNI certified',
      createdAt: new Date(Date.now() - 900000).toISOString(),
    },
    {
      id: 'msg_tb_2',
      sessionId: 'sess_default_01',
      role: 'assistant',
      content:
        'I have completed a sourcing intelligence assessment for **Teddy Bears (Plush Toys)** into **Indonesia**.\n\n' +
        '### Strategic Procurement Briefing:\n' +
        '- **Product Classification**: Classified under HS Code **9503.00**.\n' +
        '- **Trade Corridors**: China is the leading origin with 72% market share; India offers emerging competition.\n' +
        '- **Compliance Mandates**: SNI ISO 8124 toy safety certification and Laporan Surveyor (LS) are strictly required.\n' +
        '- **Landed Cost**: Estimated landed unit cost is $3.78 USD/piece.',
      cards: [
        {
          id: 'card_briefing_tb',
          type: 'sourcing_briefing',
          title: 'Executive Sourcing Briefing: Teddy Bears → Indonesia',
          data: {
            productProfile: {
              name: 'Teddy Bears (Plush Toys)',
              category: 'Toys & Novelties (Plush)',
              hsCode: '9503.00',
              materialGrade: 'Soft Velboa Fabric / PP Cotton Filling',
              certifications: ['SNI ISO 8124', 'CE EN 71', 'Laporan Surveyor (LS)'],
              packaging: 'Export Standard Master Cartons (48 pcs/ctn)',
              dimensions: '30cm Sitting Height',
              orderQuantity: '5,000 pcs',
            },
            marketSnapshot: {
              destinationCountry: 'Indonesia',
              annualImportVolumeMT: 4200,
              annualImportValueUSD: 28500000,
              growthRateYoY: 12.4,
              majorOrigins: [
                { countryName: 'China', sharePercent: 72 },
                { countryName: 'India', sharePercent: 15 },
                { countryName: 'Vietnam', sharePercent: 8 },
              ],
            },
            recommendedOrigins: [
              {
                rank: 1,
                country: 'China',
                advantage: 'Mature supply cluster in Yangzhou & Dongguan with complete raw material supply chain.',
                effectiveDuty: '0% (ACFTA Preferential Rate)',
                leadTimeDays: '25 - 35 days',
              },
              {
                rank: 2,
                country: 'India',
                advantage: 'Rapidly growing manufacturing cluster in Noida toy city offering duty advantages.',
                effectiveDuty: '5% MFN Baseline',
                leadTimeDays: '28 - 40 days',
              },
            ],
            complianceChecklist: [
              { item: 'SNI ISO 8124 (Indonesia Toy Safety Mandatory)', required: true, status: 'done', priority: 'critical' },
              { item: 'Laporan Surveyor (LS Pre-shipment Inspection)', required: true, status: 'pending', priority: 'critical' },
              { item: 'Phthalate & Heavy Metals Non-Toxic Test Report', required: true, status: 'done', priority: 'critical' },
              { item: 'Certificate of Origin (Form E for ACFTA)', required: true, status: 'pending', priority: 'important' },
            ],
            historicalPriceRef: {
              low: 2.8,
              high: 4.5,
              unit: 'USD/piece',
              basis: 'Customs CIF declaration historical records (2024 - 2025)',
              notice: 'Historical customs benchmark CIF values. Actual spot prices are determined directly via supplier bids in RFQ.',
            },
            landedCostTable: {
              basePriceUSD: 3.2,
              freightUSD: 1800,
              dutyUSD: 0,
              vatUSD: 0.38,
              totalLandedPerUnitUSD: 3.78,
              costDeltaPercent: 18.12,
              containerType: '20GP Container',
              transitDays: '14 - 20 days',
              basis: 'Deterministic benchmark: Base FOB + Ocean Freight + FTA Duty + Import VAT',
            },
            sourcingScore: 84,
            rfqReadyScore: 90,
            nextSteps: [
              'Create Sourcing Brief and launch RFQ on Proquoment platform',
              'Obtain pre-production plush samples for stitching and density review',
              'Coordinate SNI ISO 8124 factory audit testing documentation',
            ],
          },
        },
      ],
      suggestedActions: [
        {
          id: 'act_rfq_tb',
          label: 'Create Sourcing Brief & Launch RFQ',
          prompt: 'Convert this sourcing intelligence for Teddy Bears into an active RFQ.',
          actionType: 'generate_rfq',
        },
      ],
      createdAt: new Date(Date.now() - 900000).toISOString(),
    },
  ],
  sess_default_02: [
    {
      id: 'msg_sb_1',
      sessionId: 'sess_default_02',
      role: 'user',
      content: 'Sodium Benzoate Sourcing 500 MT to Indonesia, food grade BPOM certified',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'msg_sb_2',
      sessionId: 'sess_default_02',
      role: 'assistant',
      content:
        'I have completed a sourcing intelligence evaluation for **Sodium Benzoate (Food Grade)** into **Indonesia**.\n\n' +
        '### Strategic Procurement Briefing:\n' +
        '- **Product Classification**: Classified under HS Code **2916.31**.\n' +
        '- **Trade Corridors**: Major bilateral supply from India (Gujarat chemical belt) and China.\n' +
        '- **Compliance Mandates**: BPOM SKI food grade import permit, Halal (BPJPH), and Batch CoA required.\n' +
        '- **Landed Cost**: Landed cost benchmark modeled at $1,426.30 USD/MT.',
      cards: [
        {
          id: 'card_briefing_sb',
          type: 'sourcing_briefing',
          title: 'Executive Sourcing Briefing: Sodium Benzoate → Indonesia',
          data: {
            productProfile: {
              name: 'Sodium Benzoate (Food Grade)',
              category: 'Industrial & Food Chemicals',
              hsCode: '2916.31',
              materialGrade: 'Food Grade FCC / USP / BP 99.5% Purity',
              certifications: ['BPOM SKI', 'Halal (BPJPH)', 'ISO 22000 / HACCP'],
              packaging: '25kg Kraft Paper Bags with PE inner liner',
              dimensions: null,
              orderQuantity: '500 MT',
            },
            marketSnapshot: {
              destinationCountry: 'Indonesia',
              annualImportVolumeMT: 12400,
              annualImportValueUSD: 14860000,
              growthRateYoY: 8.7,
              majorOrigins: [
                { countryName: 'India', sharePercent: 48 },
                { countryName: 'China', sharePercent: 42 },
                { countryName: 'Netherlands', sharePercent: 6 },
              ],
            },
            recommendedOrigins: [
              {
                rank: 1,
                country: 'India',
                advantage: '0% preferential tariff under AIFTA and large dedicated capacity in Gujarat chemical zone.',
                effectiveDuty: '0% (Preferential FTA Rate)',
                leadTimeDays: '16 - 24 days',
              },
              {
                rank: 2,
                country: 'China',
                advantage: 'High volume output from Shandong and Jiangsu producers.',
                effectiveDuty: '5% MFN Baseline',
                leadTimeDays: '18 - 26 days',
              },
            ],
            complianceChecklist: [
              { item: 'BPOM Surat Keterangan Impor (SKI Food Grade)', required: true, status: 'done', priority: 'critical' },
              { item: 'Halal Certification (Recognized by BPJPH Indonesia)', required: true, status: 'done', priority: 'critical' },
              { item: 'Certificate of Analysis (CoA) with Heavy Metals Test', required: true, status: 'done', priority: 'critical' },
              { item: 'Certificate of Origin (Form A/AI)', required: true, status: 'pending', priority: 'important' },
            ],
            historicalPriceRef: {
              low: 1180,
              high: 1240,
              unit: 'USD/MT',
              basis: 'Customs CIF declaration historical records (2024 - 2025)',
              notice: 'Historical customs benchmark CIF values. Actual spot prices are determined directly via supplier bids in RFQ.',
            },
            landedCostTable: {
              basePriceUSD: 1198,
              freightUSD: 1500,
              dutyUSD: 0,
              vatUSD: 139.7,
              totalLandedPerUnitUSD: 1426.3,
              costDeltaPercent: 19.06,
              containerType: '20GP Container',
              transitDays: '14 - 20 days',
              basis: 'Deterministic benchmark: Base FOB + Ocean Freight + FTA Duty + Import VAT',
            },
            sourcingScore: 87,
            rfqReadyScore: 94,
            nextSteps: [
              'Create Sourcing Brief and launch RFQ on Proquoment platform',
              'Request manufacturer batch Certificate of Analysis (CoA) and Halal certificate',
              'Lock 500 MT container allocation with port forwarders',
            ],
          },
        },
      ],
      suggestedActions: [
        {
          id: 'act_rfq_sb',
          label: 'Create Sourcing Brief & Launch RFQ',
          prompt: 'Convert this sourcing intelligence for Sodium Benzoate into an active RFQ.',
          actionType: 'generate_rfq',
        },
      ],
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
  ],
  sess_default_03: [
    {
      id: 'msg_hf_1',
      sessionId: 'sess_default_03',
      role: 'user',
      content: 'Hospital Furniture 200 units to UAE (Electric ICU Beds)',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'msg_hf_2',
      sessionId: 'sess_default_03',
      role: 'assistant',
      content:
        'I have completed a sourcing intelligence assessment for **Hospital Furniture (ICU Electric Beds)** into **United Arab Emirates (UAE)**.\n\n' +
        '### Strategic Procurement Briefing:\n' +
        '- **Product Classification**: Classified under HS Code **9402.90**.\n' +
        '- **Trade Corridors**: Primary imports via Jebel Ali Port from India, Turkey, and Germany.\n' +
        '- **Compliance Mandates**: UAE MoHAP medical device registration and CE/ISO 13485 compliance.\n' +
        '- **Landed Cost**: Modeled landed unit cost at $964 USD/unit.',
      cards: [
        {
          id: 'card_briefing_hf',
          type: 'sourcing_briefing',
          title: 'Executive Sourcing Briefing: Hospital Furniture → UAE',
          data: {
            productProfile: {
              name: 'Hospital Furniture (ICU Beds)',
              category: 'Medical & Hospital Equipment',
              hsCode: '9402.90',
              materialGrade: 'Medical Grade Steel & Anti-Microbial Coating',
              certifications: ['ISO 13485', 'CE Medical Device', 'MoHAP UAE'],
              packaging: 'Disassembled in Reinforced Plywood Crates',
              dimensions: '215cm x 105cm x 50-90cm',
              orderQuantity: '200 units',
            },
            marketSnapshot: {
              destinationCountry: 'United Arab Emirates',
              annualImportVolumeMT: 3800,
              annualImportValueUSD: 19400000,
              growthRateYoY: 16.2,
              majorOrigins: [
                { countryName: 'India', sharePercent: 38 },
                { countryName: 'Turkey', sharePercent: 26 },
                { countryName: 'China', sharePercent: 22 },
              ],
            },
            recommendedOrigins: [
              {
                rank: 1,
                country: 'India',
                advantage: '0% duty under India-UAE CEPA agreement and 4-6 day fast ocean transit to Jebel Ali.',
                effectiveDuty: '0% (CEPA Preferential)',
                leadTimeDays: '14 - 20 days',
              },
            ],
            complianceChecklist: [
              { item: 'MoHAP Medical Device Classification & Listing', required: true, status: 'done', priority: 'critical' },
              { item: 'ISO 13485 Quality Management Certification', required: true, status: 'done', priority: 'critical' },
              { item: 'Certificate of Origin (CEPA Form for 0% Duty)', required: true, status: 'pending', priority: 'critical' },
            ],
            historicalPriceRef: {
              low: 750,
              high: 1200,
              unit: 'USD/unit',
              basis: 'Customs CIF declaration historical records (2024 - 2025)',
              notice: 'Historical customs benchmark CIF values. Actual spot prices are determined directly via supplier bids in RFQ.',
            },
            landedCostTable: {
              basePriceUSD: 820,
              freightUSD: 1400,
              dutyUSD: 0,
              vatUSD: 41,
              totalLandedPerUnitUSD: 964,
              costDeltaPercent: 17.56,
              containerType: '40HC Container',
              transitDays: '5 - 8 days',
              basis: 'Deterministic benchmark: Base FOB + Ocean Freight + CEPA Duty + UAE VAT',
            },
            sourcingScore: 82,
            rfqReadyScore: 88,
            nextSteps: [
              'Create Sourcing Brief and launch RFQ on Proquoment platform',
              'Verify manufacturer MoHAP import clearance eligibility',
            ],
          },
        },
      ],
      suggestedActions: [
        {
          id: 'act_rfq_hf',
          label: 'Create Sourcing Brief & Launch RFQ',
          prompt: 'Convert this sourcing intelligence for Hospital Furniture into an active RFQ.',
          actionType: 'generate_rfq',
        },
      ],
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ],
};

// Store class with local storage persistence
class IntelligenceStoreEmitter {
  private listeners = new Set<() => void>();
  private activeSessionId: string | null = null;
  private sessions: IntelligenceSession[] = [];
  private messagesBySession = new Map<string, IntelligenceMessageItem[]>();
  private workspaces: WorkspaceSummary[] = [];
  private isStreaming: boolean = false;
  private currentResearchState: ResearchState = 'completed';
  private elicitationStateBySession = new Map<string, SpecElicitationState>();
  private initialized: boolean = false;
  private currentUserId: string = 'anon';

  constructor() {}

  public initClientStorage(userId?: string) {
    const targetUid = userId || 'anon';
    if (this.initialized && this.currentUserId === targetUid) return;
    this.initialized = true;
    this.currentUserId = targetUid;

    if (typeof window === 'undefined') return;

    try {
      const savedSessions = localStorage.getItem(`proquoment_intelligence_sessions_${targetUid}`);
      if (savedSessions) {
        const parsed: IntelligenceSession[] = JSON.parse(savedSessions);
        if (Array.isArray(parsed)) {
          this.sessions = parsed;
        }
      } else {
        this.sessions = [];
      }

      const savedMessages = localStorage.getItem(`proquoment_intelligence_messages_${targetUid}`);
      if (savedMessages) {
        const parsed: Record<string, IntelligenceMessageItem[]> = JSON.parse(savedMessages);
        Object.entries(parsed).forEach(([sessId, msgs]) => {
          if (Array.isArray(msgs) && msgs.length > 0) {
            this.messagesBySession.set(sessId, msgs);
          }
        });
      }
    } catch {
      // Storage parsing failed, use in-memory empty
      this.sessions = [];
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      const uid = this.currentUserId || 'anon';
      localStorage.setItem(`proquoment_intelligence_sessions_${uid}`, JSON.stringify(this.sessions));
      const obj: Record<string, IntelligenceMessageItem[]> = {};
      this.messagesBySession.forEach((msgs, id) => {
        obj[id] = msgs;
      });
      localStorage.setItem(`proquoment_intelligence_messages_${uid}`, JSON.stringify(obj));
    } catch {
      // Storage full or unavailable
    }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  getState() {
    const currentElicitation = this.activeSessionId
      ? this.elicitationStateBySession.get(this.activeSessionId) || null
      : null;

    return {
      activeSessionId: this.activeSessionId,
      sessions: this.sessions,
      messages: this.activeSessionId
        ? this.messagesBySession.get(this.activeSessionId) || []
        : [],
      workspaces: this.workspaces,
      isStreaming: this.isStreaming,
      currentResearchState: this.currentResearchState,
      elicitationState: currentElicitation,
    };
  }

  setActiveSession(id: string | null) {
    this.activeSessionId = id;
    this.notify();
  }

  setSessions(sessions: IntelligenceSession[]) {
    this.sessions = sessions;
    this.saveToStorage();
    this.notify();
  }

  upsertSession(sessionUpdate: Partial<IntelligenceSession> & { id: string }) {
    const existingIndex = this.sessions.findIndex((s) => s.id === sessionUpdate.id);
    if (existingIndex >= 0) {
      const updated = {
        ...this.sessions[existingIndex],
        ...sessionUpdate,
        updatedAt: new Date().toISOString(),
      };
      this.sessions.splice(existingIndex, 1);
      this.sessions.unshift(updated);
    } else {
      const newSession: IntelligenceSession = {
        id: sessionUpdate.id,
        title: sessionUpdate.title || 'New Sourcing Inquiry',
        status: 'active',
        date: sessionUpdate.date || 'Just now',
        score: sessionUpdate.score || 85,
        productName: sessionUpdate.productName,
        destination: sessionUpdate.destination,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...sessionUpdate,
      };
      this.sessions.unshift(newSession);
    }
    this.saveToStorage();
    this.notify();
  }

  setWorkspaces(workspaces: WorkspaceSummary[]) {
    this.workspaces = workspaces;
    this.notify();
  }

  setStreaming(streaming: boolean, state: ResearchState = 'researching') {
    this.isStreaming = streaming;
    this.currentResearchState = state;
    this.notify();
  }

  setElicitationState(sessionId: string, state: SpecElicitationState | null) {
    if (state) {
      this.elicitationStateBySession.set(sessionId, state);
    } else {
      this.elicitationStateBySession.delete(sessionId);
    }
    this.notify();
  }

  resetElicitation(sessionId?: string) {
    const target = sessionId || this.activeSessionId || 'sess_default';
    this.elicitationStateBySession.set(target, createInitialElicitationState(target));
    this.notify();
  }

  addMessage(sessionId: string, msg: IntelligenceMessageItem) {
    const list = this.messagesBySession.get(sessionId) || [];
    this.messagesBySession.set(sessionId, [...list, msg]);
    this.saveToStorage();
    this.notify();
  }

  getMessages(sessionId?: string | null): IntelligenceMessageItem[] {
    const id = sessionId || this.activeSessionId || 'sess_default_chilli';
    const msgs = this.messagesBySession.get(id);
    if (msgs && msgs.length > 0) return msgs;
    if (DEFAULT_MESSAGES_MAP[id]) return DEFAULT_MESSAGES_MAP[id];
    return [];
  }

  updateCardData(sessionId: string, cardId: string, updatedData: any) {
    const list = this.messagesBySession.get(sessionId) || [];
    let changed = false;
    const updatedList = list.map((msg) => {
      if (!msg.cards) return msg;
      const updatedCards = msg.cards.map((c) => {
        if (c.id === cardId) {
          changed = true;
          return { ...c, data: updatedData };
        }
        return c;
      });
      return { ...msg, cards: updatedCards };
    });

    if (changed) {
      this.messagesBySession.set(sessionId, updatedList);
      this.saveToStorage();
      this.notify();
    }
  }

  setMessages(sessionId: string, messages: IntelligenceMessageItem[]) {
    this.messagesBySession.set(sessionId, messages);
    this.saveToStorage();
    this.notify();
  }
}

export const globalIntelligenceStore = new IntelligenceStoreEmitter();

export function useIntelligenceStore(userId?: string) {
  const [state, setState] = useState(() => globalIntelligenceStore.getState());

  useEffect(() => {
    globalIntelligenceStore.initClientStorage(userId);
    setState(globalIntelligenceStore.getState());
    return globalIntelligenceStore.subscribe(() => {
      setState(globalIntelligenceStore.getState());
    });
  }, [userId]);

  const setActiveSession = useCallback((id: string | null) => {
    globalIntelligenceStore.setActiveSession(id);
  }, []);

  const getMessages = useCallback((sessionId?: string | null) => {
    return globalIntelligenceStore.getMessages(sessionId);
  }, []);

  const addMessage = useCallback((sessionId: string, msg: IntelligenceMessageItem) => {
    globalIntelligenceStore.addMessage(sessionId, msg);
  }, []);

  const setStreaming = useCallback((streaming: boolean, resState?: ResearchState) => {
    globalIntelligenceStore.setStreaming(streaming, resState);
  }, []);

  const setElicitationState = useCallback((state: SpecElicitationState | null, sessionId?: string) => {
    const targetSession = sessionId || globalIntelligenceStore.getState().activeSessionId;
    if (targetSession) {
      globalIntelligenceStore.setElicitationState(targetSession, state);
    }
  }, []);

  const resetElicitation = useCallback((sessionId?: string) => {
    const targetSession = sessionId || globalIntelligenceStore.getState().activeSessionId;
    if (targetSession) {
      globalIntelligenceStore.resetElicitation(targetSession);
    }
  }, []);

  const upsertSession = useCallback((session: Partial<IntelligenceSession> & { id: string }) => {
    globalIntelligenceStore.upsertSession(session);
  }, []);

  const updateCardData = useCallback((sessionId: string, cardId: string, updatedData: any) => {
    globalIntelligenceStore.updateCardData(sessionId, cardId, updatedData);
  }, []);

  return {
    ...state,
    getMessages,
    setActiveSession,
    addMessage,
    updateCardData,
    setStreaming,
    setElicitationState,
    resetElicitation,
    upsertSession,
  };
}

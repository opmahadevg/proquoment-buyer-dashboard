import { Evidence, EvidenceClassification, ConfidenceLevel, IntelligenceSource } from '../core/evidence';
import { getOrCreateSource } from './source-registry';

export class EvidenceManager {
  private sources = new Map<string, IntelligenceSource>();
  private evidence = new Map<string, Evidence>();

  constructor(initialSources: IntelligenceSource[] = [], initialEvidence: Evidence[] = []) {
    initialSources.forEach((s) => this.sources.set(s.id, s));
    initialEvidence.forEach((e) => this.evidence.set(e.id, e));
  }

  registerSource(source: IntelligenceSource): string {
    this.sources.set(source.id, source);
    return source.id;
  }

  getOrRegisterKnownSource(key: string, url?: string): IntelligenceSource {
    const source = getOrCreateSource(key, url);
    this.sources.set(source.id, source);
    return source;
  }

  getSource(id: string): IntelligenceSource | undefined {
    return this.sources.get(id);
  }

  getAllSources(): IntelligenceSource[] {
    return Array.from(this.sources.values());
  }

  recordEvidence(params: {
    claim: string;
    sourceKeyOrId: string;
    value?: unknown;
    unit?: string;
    classification: EvidenceClassification;
    confidence: ConfidenceLevel;
    methodology?: string;
    observedAt?: string;
  }): Evidence {
    const id = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let source = this.sources.get(params.sourceKeyOrId);

    if (!source) {
      source = this.getOrRegisterKnownSource(params.sourceKeyOrId);
    }

    const item: Evidence = {
      id,
      claim: params.claim,
      sourceId: source.id,
      value: params.value,
      unit: params.unit,
      classification: params.classification,
      confidence: params.confidence,
      methodology: params.methodology,
      observedAt: params.observedAt,
      createdAt: new Date().toISOString(),
    };

    this.evidence.set(id, item);
    return item;
  }

  getEvidence(id: string): Evidence | undefined {
    return this.evidence.get(id);
  }

  getEvidenceByIds(ids: string[]): Evidence[] {
    return ids.map((id) => this.evidence.get(id)).filter((e): e is Evidence => Boolean(e));
  }

  getAllEvidence(): Evidence[] {
    return Array.from(this.evidence.values());
  }

  formatProvenance(evidenceId: string): string {
    const ev = this.evidence.get(evidenceId);
    if (!ev) return '';
    const src = this.sources.get(ev.sourceId);
    const srcName = src ? src.name : 'Unknown Source';
    const tag = ev.classification.toUpperCase();
    return `[${tag}] [${srcName}] ${ev.claim}`;
  }
}

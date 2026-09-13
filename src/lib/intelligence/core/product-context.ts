import { ConfidenceLevel } from './evidence';

export interface HSCodeCandidate {
  code: string;
  description: string;
  confidence: ConfidenceLevel;
  reasoning: string;
  evidenceId?: string;
}

export interface ProductContext {
  canonicalName: string;
  aliases?: string[];
  description?: string;
  category?: string;
  subcategory?: string;
  specifications?: Record<string, unknown>;
  grade?: string;
  application?: string;
  hsCodes?: HSCodeCandidate[];
  primaryHSCode?: string;
  qualityStandards?: string[];
  casNumber?: string;
}

export interface AttachmentAnalysisSummary {
  filesProcessed: string[];
  extractionMethod: 'text' | 'vision' | 'mixed' | 'image-only';
  productDesignQuery?: string;
  designAttributes?: string[];
  observations: string[];
  extractedSpecs: {
    productName?: string;
    category?: string;
    description?: string;
    intendedUse?: string;
    quantity?: number;
    unit?: string;
    dimensions?: string;
    materialGrade?: string;
    packaging?: string;
    certifications?: string[];
    additionalSpecs?: Record<string, string>;
  };
  rawExtractedText?: string;
  confidence?: 'high' | 'medium' | 'low';
}

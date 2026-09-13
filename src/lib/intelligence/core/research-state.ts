export type ResearchState =
  | 'intake'
  | 'understanding'
  | 'classifying'
  | 'planning'
  | 'researching'
  | 'calculating'
  | 'evaluating'
  | 'synthesizing'
  | 'completed'
  | 'failed';

export interface ResearchProgressEvent {
  jobId: string;
  state: ResearchState;
  progressPercent: number;
  currentStepId?: number;
  stepDescription?: string;
  message: string;
  timestamp: string;
}

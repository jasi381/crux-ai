export type InterviewType = 'Android Developer' | 'DSA' | 'HR Interview' | 'System Design';
export type InterviewPersonality = 'Friendly' | 'Strict' | 'FAANG-style';

export interface InterviewConfig {
  type: InterviewType;
  personality: InterviewPersonality;
}

export interface TranscriptMessage {
  text: string;
  isUser: boolean;
  timestamp: number;
}

export interface Scorecard {
  clarity: number;
  confidence: number;
  technicalDepth: number;
  conciseness: number;
  suggestions: string[];
}

export interface InterviewHistory {
  id: string;
  timestamp: number;
  type: string;
  personality: string;
  durationSeconds: number;
  scorecard: Scorecard;
  transcript: TranscriptMessage[];
}

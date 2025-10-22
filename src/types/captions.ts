export interface CaptionSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface CaptionStyle {
  type: 'reel' | 'classic' | 'bounce' | 'slide';
  position: 'bottom' | 'center' | 'top';
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  padding: number;
  borderRadius: number;
  // Animation properties
  animationDuration?: number; // Duration of entrance/exit animations in ms
  animationDelay?: number; // Delay before animation starts
  animationEasing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  // Visual effects
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  // Border properties
  borderColor?: string;
  borderWidth?: number;
  // Additional styling
  opacity?: number;
  rotation?: number;
}

export interface CaptionGenerationRequest {
  videoId: string;
  transcript: string;
  style: CaptionStyle;
  options: {
    maxSegmentDuration: number;
    minSegmentDuration: number;
    wordPerMinute: number;
  };
}

export interface CaptionGenerationResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  captions?: CaptionSegment[];
  error?: string;
}

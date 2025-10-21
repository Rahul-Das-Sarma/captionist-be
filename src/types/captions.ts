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

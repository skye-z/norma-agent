export interface TextBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextMatch {
  text: string;
  x: number;
  y: number;
  confidence: number;
  bounds: TextBounds;
}

export interface OCRResult {
  success: boolean;
  matches: TextMatch[];
  error?: string;
}

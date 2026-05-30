
export interface DetailedTip {
  title: string;
  description: string;
  action: string;
}

export interface AuraAnalysis {
  auraScore: number;
  explanation: string;
  tips: string[]; 
  detailedTips: DetailedTip[]; 
  vision: string; 
  transformedImageBase64?: string;
}

export interface ImageData {
  base64: string;
  mimeType: string;
}

export enum AppState {
  LANDING,
  CAMERA,
  UPLOADING,
  ANALYZING,
  RESULTS,
  GUIDE
}

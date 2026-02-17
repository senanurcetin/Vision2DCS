
export type SignalType = 'AI' | 'AO' | 'DI' | 'DO';

export type PCS7BlockType = 'MonAnL' | 'MonDiL' | 'MotL' | 'VlvL' | 'VlvAnL' | 'PIDConL' | 'Unknown';

export interface SentinelAlert {
  tag: string;
  severity: 'warning' | 'error' | 'info';
  message: string;
}

export interface Instrument {
  id: string;
  tagName: string;
  equipmentType: string;
  signalType: SignalType;
  description: string;
  engineeringUnits: string;
  pcs7BlockType: PCS7BlockType;
  abb800xaObject: string;
  confidence: 'high' | 'medium' | 'low';
  // Advanced features
  brand?: string;
  model?: string;
  estimatedCost?: number;
  connectedTo?: string; 
  safetyWarning?: string;
}

export interface AnalysisProject {
  id: string;
  name: string;
  date: string;
  imageUrl: string;
  instruments: Instrument[];
  digitalTwinUrl?: string; // AI-generated conceptual image
}

export interface SessionUser {
  id: string;
  username: string;
  role: string;
}

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface AndroidRelease {
  version: string | null;
  downloadUrl: string | null;
}

export interface WaterEntry {
  id: string;
  drankAt: string;
  ml: number;
}

export interface WaterDay {
  day: string;
  ml: number;
  entries: WaterEntry[];
}

export interface WaterData {
  averages: { goalMl: number } | null;
  days: WaterDay[];
}

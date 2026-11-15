export interface Palette {
  background: string;
  surface: string;
  surfaceHigh: string;
  border: string;
  text: string;
  textSoft: string;
  accent: string;
  accentBright: string;
  accentDeep: string;
  accentSoft: string;
  onAccent: string;
  danger: string;
  dangerSoft: string;
  overlay: string;
}

export const darkPalette: Palette = {
  background: '#060B12',
  surface: '#0C1622',
  surfaceHigh: '#13202E',
  border: '#1A2A38',
  text: '#E6F1F7',
  textSoft: '#8FA3B5',
  accent: '#3FD0E8',
  accentBright: '#7FE7F5',
  accentDeep: '#1E6F80',
  accentSoft: '#0E3A45',
  onAccent: '#02141A',
  danger: '#FF7A7A',
  dangerSoft: '#3A1418',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const lightPalette: Palette = {
  background: '#F3F7FA',
  surface: '#FFFFFF',
  surfaceHigh: '#EAF1F5',
  border: '#D5E0E7',
  text: '#0D1B26',
  textSoft: '#4F6577',
  accent: '#00788C',
  accentBright: '#0A95AB',
  accentDeep: '#00788C',
  accentSoft: '#C9F0F7',
  onAccent: '#FFFFFF',
  danger: '#C62828',
  dangerSoft: '#FBE3E3',
  overlay: 'rgba(0, 0, 0, 0.4)',
};

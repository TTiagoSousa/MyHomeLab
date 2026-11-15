import { useMemo } from 'react';
import { useTheme } from '../../../Contexts/ThemeContext';

export interface ChartColors {
  accent: string;
  text: string;
  textSoft: string;
  textFaint: string;
  line: string;
  lineStrong: string;
  panel: string;
}

const read = (name: string, fallback: string) =>
  getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;

export function useChartColors(): ChartColors {
  const { mode } = useTheme();

  return useMemo(
    () => ({
      accent: read('--accent', '#5FD8F5'),
      text: read('--text-main', '#E6F4F8'),
      textSoft: read('--text-soft', '#9FB7C0'),
      textFaint: read('--text-faint', '#5E7680'),
      line: read('--hud-line', 'rgba(109,205,232,.12)'),
      lineStrong: read('--hud-line-strong', 'rgba(109,205,232,.25)'),
      panel: read('--modal-background', '#0A121D'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode],
  );
}

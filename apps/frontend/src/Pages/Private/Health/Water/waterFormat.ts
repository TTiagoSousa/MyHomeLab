export const WATER_COLORS = {
  bar: '#38bdf8',
  goalBar: '#0ea5e9',
  goal: '#22d3ee',
};

export const QUICK_AMOUNTS = [250, 330, 500, 750];

export const formatMl = (ml: number | null | undefined) => {
  if (ml == null) return '—';
  if (ml < 1000) return `${ml} ml`;
  return `${(ml / 1000).toFixed(2).replace(/\.?0+$/, '')} L`;
};

export const goalShare = (ml: number, goal: number) => Math.round((ml / goal) * 100);

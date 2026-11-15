export const WEIGHT_COLORS = {
  line: '#a78bfa',
  area: 'rgba(167, 139, 250, 0.12)',
  average: '#94a3b8',
};

export const formatKg = (kg: number | null | undefined) => (kg == null ? '—' : `${kg.toFixed(1)} kg`);

export const formatKgChange = (kg: number | null | undefined) =>
  kg == null ? '—' : `${kg > 0 ? '+' : ''}${kg.toFixed(1)} kg`;

export const changeClass = (kg: number | null | undefined) => (kg == null || kg === 0 ? '' : kg > 0 ? 'up' : 'down');

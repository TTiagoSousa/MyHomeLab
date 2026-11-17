interface HomeLabProps {
  color?: string;
}

const HomeLab = ({ color = 'currentColor' }: HomeLabProps) => (
  <svg width='26' height='26' viewBox='0 0 24 24' fill={color} stroke={color} strokeWidth='2.1' strokeLinecap='round' strokeLinejoin='round'>
    <rect x='3' y='3' width='7' height='7' rx='1.4' />
    <rect x='14' y='3' width='7' height='7' rx='1.4' />
    <rect x='3' y='14' width='7' height='7' rx='1.4' />
    <rect x='14' y='14' width='7' height='7' rx='1.4' />
  </svg>
);

export default HomeLab;

interface BoardProps {
  color?: string;
}

const Board = ({ color = 'currentColor' }: BoardProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <rect x="3.5" y="4" width="17" height="16" rx="2.5" stroke={color} strokeWidth="1.5" />
    <path d="M9.5 4v16M15 4v16" stroke={color} strokeWidth="1.5" />
    <path d="M5.5 7.5h2M5.5 10.5h2M11.5 7.5h1.5M17 7.5h1.5M17 10.5h1.5M17 13.5h1.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default Board;

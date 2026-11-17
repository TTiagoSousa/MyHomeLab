interface GameTrackerProps {
  color?: string;
}

const GameTracker = ({ color = '#8B5CF6' }: GameTrackerProps) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 11h4" />
    <path d="M8 9v4" />
    <path d="M15 12h.01" />
    <path d="M18 10h.01" />
    <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59l-.705 6.36A3 3 0 0 0 4.98 18.3c.98 0 1.86-.6 2.22-1.5L8 15h8l.8 1.8c.36.9 1.24 1.5 2.22 1.5a3 3 0 0 0 2.983-3.35l-.705-6.36A4 4 0 0 0 17.32 5z" />
  </svg>
);

export default GameTracker;

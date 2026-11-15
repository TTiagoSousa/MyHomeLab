interface OpenGymProps {
  color?: string;
}

const OpenGym = ({ color = '#22C55E' }: OpenGymProps) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.5 6.5v11" />
    <path d="M17.5 6.5v11" />
    <path d="M3.5 9v6" />
    <path d="M20.5 9v6" />
    <path d="M6.5 12h11" />
  </svg>
);

export default OpenGym;

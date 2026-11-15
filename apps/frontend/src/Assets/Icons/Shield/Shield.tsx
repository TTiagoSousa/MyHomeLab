interface ShieldProps {
  color?: string;
}

const Shield = ({ color = 'currentColor' }: ShieldProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.9 7 9 4.1-1.1 7-4.8 7-9V6l-7-2.5Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="m9 12 2.2 2.2L15.5 10" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default Shield;

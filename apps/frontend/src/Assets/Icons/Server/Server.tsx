interface ServerProps {
  color?: string;
}

const Server = ({ color = 'currentColor' }: ServerProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <rect x="4" y="4" width="16" height="6.5" rx="1.5" stroke={color} strokeWidth="1.5" />
    <rect x="4" y="13.5" width="16" height="6.5" rx="1.5" stroke={color} strokeWidth="1.5" />
    <path d="M7.5 7.25H8.5M7.5 16.75H8.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 7.25H16.5M12 16.75H16.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default Server;

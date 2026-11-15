interface AgentsProps {
  color?: string;
}

const Agents = ({ color = 'currentColor' }: AgentsProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <rect x="4" y="7" width="16" height="12" rx="3" stroke={color} strokeWidth="1.5" />
    <path d="M12 4v3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="3.5" r="1.25" stroke={color} strokeWidth="1.5" />
    <circle cx="9" cy="12.5" r="1.15" fill={color} />
    <circle cx="15" cy="12.5" r="1.15" fill={color} />
    <path d="M9.5 16h5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export default Agents;

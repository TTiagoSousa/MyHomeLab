interface DocProps {
  color?: string;
}

const Doc = ({ color = 'currentColor' }: DocProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M6.5 3.5h7l4 4v11.5a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M13.5 3.5V7.5h4" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M8.5 11.5h7M8.5 14.5h7M8.5 17.5h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default Doc;

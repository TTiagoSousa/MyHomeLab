interface ChecklistProps {
  color?: string;
}

const Checklist = ({ color = 'currentColor' }: ChecklistProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M4 6.5l1.6 1.6L8.5 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 12.5l1.6 1.6 2.9-3.1" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="4" y="16.8" width="4" height="4" rx="1" stroke={color} strokeWidth="1.5" />
    <path d="M11.5 6.5H20M11.5 12.5H20M11.5 18.8H20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default Checklist;

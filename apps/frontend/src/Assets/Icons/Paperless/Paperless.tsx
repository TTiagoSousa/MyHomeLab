interface PaperlessProps {
  color?: string;
}

const Paperless = ({ color = '#17541F' }: PaperlessProps) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6" />
    <path d="M9 17h4" />
  </svg>
);

export default Paperless;

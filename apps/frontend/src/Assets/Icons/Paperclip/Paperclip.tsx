interface PaperclipProps {
  color?: string;
}

const Paperclip = ({ color = 'currentColor' }: PaperclipProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path
      d="M20.5 11.5L12.3 19.7C10.3 21.7 7.1 21.7 5.1 19.7C3.1 17.7 3.1 14.5 5.1 12.5L13.6 4C14.9 2.7 17 2.7 18.3 4C19.6 5.3 19.6 7.4 18.3 8.7L9.9 17.1C9.2 17.8 8.1 17.8 7.4 17.1C6.7 16.4 6.7 15.3 7.4 14.6L15 7"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default Paperclip;

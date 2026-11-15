interface FolderProps {
  color?: string;
}

const Folder = ({ color = 'currentColor' }: FolderProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path
      d="M3.75 7.5A1.75 1.75 0 0 1 5.5 5.75h4l2 2.25h7A1.75 1.75 0 0 1 20.25 9.75v7.75a1.75 1.75 0 0 1-1.75 1.75h-13a1.75 1.75 0 0 1-1.75-1.75V7.5Z"
      stroke={color}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

export default Folder;

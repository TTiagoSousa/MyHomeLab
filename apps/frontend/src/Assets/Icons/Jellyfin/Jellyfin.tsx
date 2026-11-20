const Jellyfin = () => (
  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs>
      <linearGradient id="jellyfin-icon-gradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#aa5cc3" />
        <stop offset="1" stopColor="#00a4dc" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="14" fill="url(#jellyfin-icon-gradient)" />
    <path d="M32 12 L52 48 H12 Z" fill="#ffffff" />
    <path d="M32 26 L42 44 H22 Z" fill="url(#jellyfin-icon-gradient)" />
  </svg>
);

export default Jellyfin;

declare global {
  interface Window {
    __ENV__?: {
      VITE_API_URL?: string;
    };
  }
}

const BASE_URL = window.__ENV__?.VITE_API_URL || import.meta.env.VITE_API_URL;

export { BASE_URL };

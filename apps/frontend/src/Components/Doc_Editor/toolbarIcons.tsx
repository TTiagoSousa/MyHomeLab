import type { ReactNode } from 'react';

const Stroke_Icon = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.7'
    strokeLinecap='round'
    strokeLinejoin='round'
    width='100%'
    height='100%'
    aria-hidden='true'
  >
    {children}
  </svg>
);

export const Bullet_List_Icon = () => (
  <Stroke_Icon>
    <path d='M9 6h11M9 12h11M9 18h11' />
    <circle cx='4.5' cy='6' r='1' fill='currentColor' />
    <circle cx='4.5' cy='12' r='1' fill='currentColor' />
    <circle cx='4.5' cy='18' r='1' fill='currentColor' />
  </Stroke_Icon>
);

export const Ordered_List_Icon = () => (
  <Stroke_Icon>
    <path d='M10 6h10M10 12h10M10 18h10' />
    <path d='M4 4.5h1.5v4M3.8 8.5h3M3.8 14.2a1.5 1.5 0 0 1 2.7.6c0 1.2-2.7 2-2.7 3.2h2.9' />
  </Stroke_Icon>
);

export const Task_List_Icon = () => (
  <Stroke_Icon>
    <rect x='3' y='4' width='6' height='6' rx='1.2' />
    <path d='M4.5 7l1.2 1.2L8 5.8' />
    <rect x='3' y='14' width='6' height='6' rx='1.2' />
    <path d='M12 7h9M12 17h9' />
  </Stroke_Icon>
);

export const Quote_Icon = () => (
  <Stroke_Icon>
    <path d='M4 5v14' />
    <path d='M9 8h11M9 12h11M9 16h7' />
  </Stroke_Icon>
);

export const Inline_Code_Icon = () => (
  <Stroke_Icon>
    <path d='M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5' />
  </Stroke_Icon>
);

export const Code_Block_Icon = () => (
  <Stroke_Icon>
    <rect x='3' y='4' width='18' height='16' rx='2' />
    <path d='M9.5 9.5L7 12l2.5 2.5M14.5 9.5L17 12l-2.5 2.5' />
  </Stroke_Icon>
);

export const Rule_Icon = () => (
  <Stroke_Icon>
    <path d='M3 12h18' />
    <path d='M7 7h10M7 17h10' opacity='.4' />
  </Stroke_Icon>
);

export const Link_Icon = () => (
  <Stroke_Icon>
    <path d='M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2' />
    <path d='M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2' />
  </Stroke_Icon>
);

export const Undo_Icon = () => (
  <Stroke_Icon>
    <path d='M9 14L4 9l5-5' />
    <path d='M4 9h10.5a5.5 5.5 0 0 1 0 11H11' />
  </Stroke_Icon>
);

export const Redo_Icon = () => (
  <Stroke_Icon>
    <path d='M15 14l5-5-5-5' />
    <path d='M20 9H9.5a5.5 5.5 0 0 0 0 11H13' />
  </Stroke_Icon>
);

export const Table_Icon = () => (
  <Stroke_Icon>
    <rect x='3' y='4' width='18' height='16' rx='2' />
    <path d='M3 9.5h18M3 15h18M9 9.5V20M15 9.5V20' />
  </Stroke_Icon>
);

export const Diagram_Icon = () => (
  <Stroke_Icon>
    <rect x='9' y='3' width='6' height='5' rx='1' />
    <rect x='3' y='16' width='6' height='5' rx='1' />
    <rect x='15' y='16' width='6' height='5' rx='1' />
    <path d='M12 8v4M6 16v-2h12v2' />
  </Stroke_Icon>
);

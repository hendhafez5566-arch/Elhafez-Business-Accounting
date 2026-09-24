import type { ReactNode } from 'react';

export type IconName =
  | 'home'
  | 'tasks'
  | 'settings'
  | 'dashboard'
  | 'customers'
  | 'profile'
  | 'agents'
  | 'leads'
  | 'quote'
  | 'followup'
  | 'traveler'
  | 'supplier'
  | 'analytics'
  | 'purchase'
  | 'tourism'
  | 'calendar'
  | 'program'
  | 'workspace'
  | 'booking'
  | 'room'
  | 'visa'
  | 'ticket'
  | 'transport'
  | 'operations'
  | 'readiness'
  | 'barcode'
  | 'appearance'
  | 'bell'
  | 'menu';

const iconContent: Record<IconName, ReactNode> = {
  home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,
  tasks: <><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.5 1a7 7 0 0 0-1.8-1L14.2 3h-4.4l-.4 3a7 7 0 0 0-1.8 1L5 6 3 9.4 5.1 11a7 7 0 0 0 0 2L3 14.6 5 18l2.6-1a7 7 0 0 0 1.8 1l.4 3h4.4l.4-3a7 7 0 0 0 1.8-1l2.6 1 2-3.4-2.1-1.6a7 7 0 0 0 .1-1Z"/></>,
  dashboard: <><rect x="3" y="3" width="7" height="8" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="15" width="7" height="6" rx="1"/></>,
  customers: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20c.5-4 2.5-6 5.5-6s5 2 5.5 6M14 15c3.6 0 5.5 1.7 6 5"/></>,
  profile: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.7-4.7 3.2-7 7.5-7s6.8 2.3 7.5 7"/></>,
  agents: <><circle cx="8" cy="8" r="3"/><circle cx="17" cy="7" r="2"/><path d="M2.5 20c.5-4 2.5-6 5.5-6s5 2 5.5 6M15 12h6v8h-6z"/></>,
  leads: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="m16.5 7.5 4-4M17 4h3v3"/></>,
  quote: <><path d="M6 3h10l3 3v15H6z"/><path d="M16 3v4h4M9 11h6M9 15h6"/></>,
  followup: <><path d="M4 5h16v12H8l-4 4z"/><path d="M8 9h8M8 13h5"/></>,
  traveler: <><path d="M3 16h18M12 3l3 13M9 16l3-13M6 8h12"/><circle cx="12" cy="3" r="1"/></>,
  supplier: <><path d="M3 9h18v12H3zM7 9V5h10v4"/><path d="M8 13h8M8 17h5"/></>,
  analytics: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  purchase: <><path d="M4 5h2l2 10h9l2-7H7"/><circle cx="10" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></>,
  tourism: <><path d="M3 18h18M6 18l2-9h8l2 9M9 9l3-5 3 5"/><path d="M8 13h8"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
  program: <><path d="M4 4h16v16H4zM8 8h8M8 12h5M8 16h7"/></>,
  workspace: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4V2h8v2M3 10h18M10 10v2h4v-2"/></>,
  booking: <><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/><path d="m14 18 1.5 1.5L19 16"/></>,
  room: <><path d="M3 18V9h18v9M5 9V5h6v4M13 9V6h6v3M3 18v3M21 18v3"/></>,
  visa: <><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="3"/><path d="M14 10h4M14 14h4"/></>,
  ticket: <><path d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z"/><path d="M12 8v2M12 14v2"/></>,
  transport: <><path d="M4 16V7c0-2 1-3 3-3h10c2 0 3 1 3 3v9"/><path d="M4 12h16M7 16h10"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></>,
  operations: <><path d="M4 20V4h16v16z"/><path d="m8 12 2 2 5-5M8 7h8M8 17h8"/></>,
  readiness: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 8"/></>,
  barcode: <><path d="M4 5v14M7 5v14M10 5v14M14 5v14M17 5v14M20 5v14"/></>,
  appearance: <><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/><path d="M5.5 6.5h13M5.5 17.5h13"/></>,
  bell: <><path d="M6 17h12l-1.5-2.5V10a4.5 4.5 0 0 0-9 0v4.5z"/><path d="M10 20h4"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
};

export function Icon({
  name,
  size = 20,
  className = '',
}: {
  readonly name: IconName;
  readonly size?: number;
  readonly className?: string;
}) {
  return (
    <svg
      className={['ui-icon', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconContent[name]}
    </svg>
  );
}

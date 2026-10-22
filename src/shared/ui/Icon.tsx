const PATHS = {
  calendar: 'M4 10h16M9 3v4M15 3v4',
  weeks: 'M4 7h16M4 12h16M4 17h10',
  plans: 'M12 4l9 5-9 5-9-5 9-5zM3 14l9 5 9-5',
  settings: 'M4 8h9M17 8h3M4 16h3M11 16h9',
  warning: 'M12 4l9 16H3L12 4zM12 10v4M12 17.5h.01',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 9l5-5 5 5M5 20h14',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5',
  check: 'M5 12.5l4.5 4.5L19 7',
  close: 'M6 6l12 12M18 6L6 18',
  info: 'M12 11v5M12 8h.01',
} as const;

export type IconName = keyof typeof PATHS;
type IconSize = 'xs' | 's' | 'm' | 'l';

const SIZE_CLASS: Record<IconSize, string> = { xs: 'ic xs', s: 'ic s', m: 'ic', l: 'ic l' };

/** Decorative icon; put the meaning in nearby text or an aria-label on the button that holds it. */
export function Icon({ name, size = 'm' }: { name: IconName; size?: IconSize }) {
  return (
    <svg className={SIZE_CLASS[size]} viewBox="0 0 24 24" aria-hidden="true">
      {name === 'calendar' && <rect x="4" y="5" width="16" height="15" rx="3" />}
      {name === 'settings' && (
        <>
          <circle cx="15" cy="8" r="2" />
          <circle cx="9" cy="16" r="2" />
        </>
      )}
      {name === 'info' && <circle cx="12" cy="12" r="9" />}
      <path d={PATHS[name]} />
    </svg>
  );
}

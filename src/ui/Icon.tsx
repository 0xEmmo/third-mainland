const paths = {
  play: <path d="M7 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  pause: (
    <g fill="currentColor" stroke="none">
      <rect x="6.5" y="5" width="4" height="14" rx="1" />
      <rect x="13.5" y="5" width="4" height="14" rx="1" />
    </g>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  target: (
    <g>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </g>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  info: (
    <g>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16v.5" />
    </g>
  ),
  table: (
    <g>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M3.5 10h17M3.5 14.5h17M9.5 10v9" />
    </g>
  ),
  map: <path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2zM9 4.5v13M15 6.5v13" />,
  layers: <path d="M12 4l8.5 4.5L12 13 3.5 8.5zM3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5" />,
  chevron: <path d="M7 10l5 5 5-5" />,
  offline: <path d="M3 3l18 18M8.5 16.5a5 5 0 017 0M5 12.5a10 10 0 014.4-2.4M14.6 10.1A10 10 0 0119 12.5M12 20h.01" />,
  retry: <path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" />,
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  )
}

/** The bridge mark from the title card: two spans meeting over the water. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--road)" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M4 20C8 14 9 8 12 4M12 4C14 9 16 14 20 20" />
      <path d="M7 14h10" opacity=".6" />
    </svg>
  )
}

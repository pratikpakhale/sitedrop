type IconProps = { size?: number }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export function Upload({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 20V8" />
      <path d="m7 13 5-5 5 5" />
      <path d="M5 4h14" />
    </svg>
  )
}

export function Lock({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" />
    </svg>
  )
}

export function Folder({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 7a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.5.7l1 1.2a2 2 0 0 0 1.5.7H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}

export function Archive({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M11 4v5M13 9v3M11 12v3" />
    </svg>
  )
}

export function Shuffle({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M16 4h4v4" />
      <path d="M4 20 20 4" />
      <path d="M16 20h4v-4" />
      <path d="m4 4 5 5" />
      <path d="m15 15 5 5" />
    </svg>
  )
}

export function Copy({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  )
}

export function Check({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m5 12 5 5L19 7" />
    </svg>
  )
}

export function Trash({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export function External({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </svg>
  )
}

export function Warning({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M10.3 4.3 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}

export function Wand({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m4 20 11-11" />
      <path d="M16 8.5 19.5 5 19 4.5 15.5 8" />
      <path d="M18 12h.01M20 16h.01M9 4h.01M5 7h.01" />
    </svg>
  )
}

export function Pencil({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14 6 4 4" />
    </svg>
  )
}

export function Refresh({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M20 11a8 8 0 1 0-.6 4" />
      <path d="M20 4v7h-7" />
    </svg>
  )
}

export function X({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  )
}

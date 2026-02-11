interface NormiesAppIconProps {
  className?: string
  size?: number
}

/**
 * NormiesAppIcon - Displays the Normies floppy disk icon
 */
export function NormiesAppIcon({ className, size = 64 }: NormiesAppIconProps) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="120" y="80" width="784" height="864" rx="28" fill="#2A2A2E" />
      <rect
        x="124"
        y="84"
        width="776"
        height="856"
        rx="26"
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth="4"
      />
      <rect x="140" y="98" width="44" height="56" rx="6" fill="#222226" />
      <rect x="310" y="108" width="404" height="200" rx="12" fill="#1C1C1F" />
      <rect x="318" y="114" width="260" height="188" rx="8" fill="#B0B0B4" />
      <rect x="322" y="118" width="252" height="5" rx="2" fill="#CCCCD0" />
      <line x1="318" y1="208" x2="578" y2="208" stroke="#929296" strokeWidth="2" />
      <rect x="346" y="140" width="200" height="130" rx="4" fill="#0E0E10" />
      <rect x="180" y="380" width="664" height="320" rx="8" fill="#F5F0E4" />
      <rect
        x="180"
        y="380"
        width="664"
        height="320"
        rx="8"
        fill="none"
        stroke="#E0D8C6"
        strokeWidth="2"
      />
      <line x1="220" y1="440" x2="804" y2="440" stroke="#DDD6C4" strokeWidth="1.5" />
      <line x1="220" y1="485" x2="804" y2="485" stroke="#DDD6C4" strokeWidth="1.5" />
      <line x1="220" y1="530" x2="804" y2="530" stroke="#DDD6C4" strokeWidth="1.5" />
      <line x1="220" y1="575" x2="804" y2="575" stroke="#DDD6C4" strokeWidth="1.5" />
      <line x1="220" y1="620" x2="804" y2="620" stroke="#DDD6C4" strokeWidth="1.5" />
      <line x1="220" y1="665" x2="804" y2="665" stroke="#DDD6C4" strokeWidth="1.5" />
      <rect x="392" y="770" width="240" height="140" rx="14" fill="#1C1C1F" />
      <circle cx="512" cy="840" r="32" fill="#2A2A2E" stroke="#1C1C1F" strokeWidth="4" />
      <circle cx="512" cy="840" r="14" fill="#1C1C1F" />
    </svg>
  )
}

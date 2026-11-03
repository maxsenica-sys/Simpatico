export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? "small" : ""}`} aria-label="Talk">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="2" y="6" width="44" height="30" rx="10" fill="currentColor" opacity="0.14" />
        <rect x="10" y="26" width="28" height="4" rx="2" fill="currentColor" />
        <rect x="14" y="18" width="20" height="4" rx="2" fill="currentColor" opacity="0.55" />
        <path d="M16 36 L14 44 L24 36 Z" fill="currentColor" opacity="0.14" />
      </svg>
      <span>Talk</span>
    </div>
  );
}

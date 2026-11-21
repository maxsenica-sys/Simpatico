import { BRAND } from "@/shared/brand";

/** Two speech bubbles meeting in the middle: two people on the same wavelength. */
export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path d="M17 7h3c7.2 0 13 5.4 13 12s-5.8 12-13 12h-2.5l-6.5 5.5V30A12 12 0 0 1 4 19C4 12.4 9.8 7 17 7z" fill={BRAND.blue} />
      <path d="M28 15h3c7.2 0 13 5.4 13 12a12 12 0 0 1-7 10.9v5.6L30.5 39H28c-7.2 0-13-5.4-13-12s5.8-12 13-12z" fill={BRAND.mint} fillOpacity="0.88" />
    </svg>
  );
}

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? "small" : ""}`} aria-label={BRAND.appName}>
      <LogoMark />
      <span className="wordmark">{BRAND.appName}</span>
    </div>
  );
}

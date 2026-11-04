/** App icon artwork for ImageResponse (PWA icons, apple-touch-icon): the two-bubble mark on dark. */
export function IconArt({ size, padded = false }: { size: number; padded?: boolean }) {
  // Maskable icons need the mark inside the central safe zone, so it is drawn smaller.
  const mark = padded ? size * 0.62 : size * 0.78;
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0d10" }}>
      <svg viewBox="0 0 48 48" width={mark} height={mark}>
        <path d="M17 7h3c7.2 0 13 5.4 13 12s-5.8 12-13 12h-2.5l-6.5 5.5V30A12 12 0 0 1 4 19C4 12.4 9.8 7 17 7z" fill="#5b8cff" />
        <path d="M28 15h3c7.2 0 13 5.4 13 12a12 12 0 0 1-7 10.9v5.6L30.5 39H28c-7.2 0-13-5.4-13-12s5.8-12 13-12z" fill="#5fe0bd" fillOpacity="0.88" />
      </svg>
    </div>
  );
}

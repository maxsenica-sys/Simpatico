/** Shared icon artwork for ImageResponse (PWA icons, apple-touch-icon). */
export function IconArt({ size, padded = false }: { size: number; padded?: boolean }) {
  const s = size;
  const inset = padded ? s * 0.18 : s * 0.1;
  const w = s - inset * 2;
  return (
    <div style={{ width: s, height: s, display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0d10" }}>
      <div
        style={{
          width: w,
          height: w * 0.68,
          borderRadius: w * 0.2,
          background: "#1d2a4a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: w * 0.12,
          gap: w * 0.06,
        }}
      >
        <div style={{ width: w * 0.46, height: w * 0.08, borderRadius: w, background: "#5b8cff", opacity: 0.55 }} />
        <div style={{ width: w * 0.64, height: w * 0.08, borderRadius: w, background: "#5b8cff" }} />
      </div>
    </div>
  );
}

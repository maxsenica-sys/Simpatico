/**
 * Your profile photo: a small square JPEG kept on this phone (localStorage). In a call it goes
 * straight to the other phones over the call's own encrypted connection (a WebRTC data
 * channel), never through our server, so they can show it in their Recent list.
 */
const KEY = "talk.photo";
/** Pixels per side. Small enough to send instantly and keep dozens in Recent. */
const SIDE = 192;
/** Anything bigger than this from another phone is ignored. */
export const MAX_PHOTO_CHARS = 60_000;

export function loadPhoto(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function savePhoto(dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem(KEY, dataUrl);
    else localStorage.removeItem(KEY);
  } catch {}
}

/** Only small JPEG/WebP/PNG data URLs are accepted from other phones. */
export function validPhoto(x: unknown): x is string {
  return typeof x === "string" && x.length < MAX_PHOTO_CHARS && /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(x);
}

/** A picked image file -> a centred square, 192 px, JPEG. Phone rotation (EXIF) is applied. */
export async function photoFromFile(file: File): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions).catch(() => createImageBitmap(file));
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIDE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIDE, SIDE);
  bmp.close?.();
  for (const q of [0.82, 0.7, 0.55]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length < MAX_PHOTO_CHARS * 0.6) return url;
  }
  return canvas.toDataURL("image/jpeg", 0.45);
}

import { ImageResponse } from "next/og";
import { IconArt } from "../iconArt";

export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === "512" ? 512 : 192;
  const maskable = new URL(req.url).searchParams.has("maskable");
  return new ImageResponse(<IconArt size={px} padded={maskable} />, {
    width: px,
    height: px,
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}

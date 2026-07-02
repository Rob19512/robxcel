import { ImageResponse } from "next/og";

const ALLOWED_SIZES = new Set([192, 512]);

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const s = ALLOWED_SIZES.has(Number(size)) ? Number(size) : 512;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4f46e5",
        }}
      >
        <span
          style={{
            fontSize: s * 0.56,
            fontWeight: 700,
            color: "white",
            fontFamily: "sans-serif",
          }}
        >
          R
        </span>
      </div>
    ),
    { width: s, height: s }
  );
}

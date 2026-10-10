import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Next.js App Router'ning fayl-konvensiyasi: brauzer tab favicon'ini dinamik generatsiya qiladi. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #a855f7, #22d3ee)",
          borderRadius: 6,
          color: "white",
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        U
      </div>
    ),
    size
  );
}

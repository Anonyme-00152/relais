import { ImageResponse } from "next/og";

export const alt = "Relais · Envoyez lourd. Partagez léger.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f4f4ef", padding: 80, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "#2557f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: "#ffc23d" }} />
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, color: "#0d1628", letterSpacing: -1.5 }}>Relais</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, fontWeight: 700, color: "#0d1628", letterSpacing: -4, lineHeight: 1 }}>Envoyez lourd.</div>
          <div style={{ fontSize: 96, fontWeight: 700, color: "#2557f5", letterSpacing: -4, lineHeight: 1.1 }}>Partagez léger.</div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 28, color: "#5a6478" }}>
          Sans compte · Mot de passe · Expiration · Fichiers analysés
        </div>
      </div>
    ),
    size,
  );
}

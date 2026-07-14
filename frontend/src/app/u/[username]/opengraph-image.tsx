import { ImageResponse } from "next/og";
import { getPublicProfile } from "@/lib/api/users";

// Dynamic social-share card for a creator mini-site (1200×630). Rendered per
// request on the server so pasting /u/<username> into an IG bio / WA / X shows a
// branded preview. Text-forward so it reads even if an emoji glyph is missing.
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Kreav creator mini-site";

export default async function OgImage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  let displayName = username;
  let handle = username;
  let bio = "Digital products on Kreav";
  let accent = "#FF3BFF";
  let emoji = "🛍️";
  try {
    const p = await getPublicProfile(username);
    displayName = p.displayName || username;
    handle = p.username || username;
    bio = p.bio || bio;
    accent = p.accent || accent;
    emoji = p.avatarEmoji || emoji;
  } catch {
    /* fall back to defaults (still a valid card) */
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: accent,
          color: "#0A0A0A",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 132,
              height: 132,
              borderRadius: 28,
              background: "rgba(255,255,255,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 76,
            }}
          >
            {emoji}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>{displayName}</div>
            <div style={{ fontSize: 34, opacity: 0.7, marginTop: 8 }}>@{handle}</div>
          </div>
        </div>

        <div style={{ fontSize: 34, lineHeight: 1.35, maxWidth: 900, opacity: 0.85 }}>
          {bio.length > 140 ? bio.slice(0, 137) + "…" : bio}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 30, fontWeight: 800 }}>Buy · pay instantly in USDC</div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 900,
              letterSpacing: 2,
              background: "#0A0A0A",
              color: "#FFE600",
              padding: "10px 20px",
              borderRadius: 10,
            }}
          >
            KREAV
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

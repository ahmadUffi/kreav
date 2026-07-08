"use client";
import Link from "next/link";
import Icon, { type IconName } from "@/components/ui/Icon";
import type { CreatorProfile, Product } from "@/lib/mock";

const SOCIALS: { key: keyof CreatorProfile["socials"]; icon: IconName; url: (h: string) => string }[] = [
  { key: "instagram", icon: "instagram", url: (h) => `https://instagram.com/${h}` },
  { key: "x", icon: "x", url: (h) => `https://x.com/${h}` },
  { key: "tiktok", icon: "tiktok", url: (h) => `https://tiktok.com/@${h}` },
  { key: "youtube", icon: "youtube", url: (h) => `https://youtube.com/${h.startsWith("@") ? h : "@" + h}` },
];

/**
 * Public Linktree-style creator page. Used by /u/[username] and the editor preview.
 * `products` is the pool used to resolve `profile.featuredProductIds`.
 */
export default function CreatorMiniSite({
  profile,
  products = [],
}: {
  profile: CreatorProfile;
  products?: Product[];
}) {
  const featured = profile.featuredProductIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));
  const socials = SOCIALS.filter((s) => profile.socials[s.key]);

  return (
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: "50%",
            margin: "0 auto 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            background: profile.accent,
            border: "1px solid var(--line, rgba(10,10,10,.14))",
          }}
        >
          {profile.avatarEmoji}
        </div>
        <div style={{ fontFamily: "var(--font-anton)", fontSize: 26, lineHeight: 1.1 }}>{profile.displayName}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
          @{profile.username} · {profile.country}
        </div>
        {profile.bio && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6, margin: "12px auto 0", maxWidth: 380 }}>
            {profile.bio}
          </p>
        )}
      </div>

      {/* Socials */}
      {socials.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16 }}>
          {socials.map((s) => (
            <a key={s.key} href={s.url(profile.socials[s.key] as string)} target="_blank" rel="noreferrer" aria-label={s.key} style={{ color: "var(--text)" }}>
              <Icon name={s.icon} size={20} />
            </a>
          ))}
        </div>
      )}

      {/* Links */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
        {profile.links.map((l) => (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              textAlign: "center",
              textDecoration: "none",
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--card-text)",
              background: "var(--card)",
              border: "1px solid var(--line, rgba(10,10,10,.14))",
              borderRadius: "var(--r, 10px)",
              boxShadow: "var(--shadow-sm, 0 1px 2px rgba(10,10,10,.06))",
              padding: "14px 16px",
              transition: "transform 0.12s, box-shadow 0.12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "var(--shadow, 0 6px 20px rgba(10,10,10,.08))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "";
              e.currentTarget.style.boxShadow = "var(--shadow-sm, 0 1px 2px rgba(10,10,10,.06))";
            }}
          >
            {l.label}
          </a>
        ))}
      </div>

      {/* Featured products */}
      {featured.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--muted)",
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            Featured products
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {featured.map((p) => (
              <Link key={p.id} href={`/store/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 10,
                    border: "1px solid var(--line, rgba(10,10,10,.14))",
                    borderRadius: "var(--r, 10px)",
                    background: "var(--card)",
                  }}
                >
                  <div style={{ width: 46, height: 46, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, background: p.accent }}>
                    {p.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.title}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>${p.price}</div>
                  </div>
                  <span style={{ color: "var(--muted)" }}>
                    <Icon name="chevronRight" size={16} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: 28 }}>
        <Link href="/" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", textDecoration: "none" }}>
          Powered by <strong style={{ color: "var(--text)" }}>Kreav</strong>
        </Link>
      </div>
    </div>
  );
}

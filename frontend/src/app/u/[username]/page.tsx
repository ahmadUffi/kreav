import Link from "next/link";
import CreatorMiniSite from "@/components/CreatorMiniSite";
import { getPublicProfile } from "@/lib/api/users";
import { mapProfileProduct } from "@/lib/api/mappers";
import type { CreatorProfile, Product } from "@/lib/mock";

export default async function CreatorPublicPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  let profile: CreatorProfile | null = null;
  let products: Product[] = [];

  try {
    const raw = await getPublicProfile(username);
    const handle = `@${raw.username}`;
    products = raw.products.map((p) => mapProfileProduct(p, handle));
    profile = {
      username: raw.username,
      displayName: raw.displayName,
      bio: raw.bio ?? "",
      country: raw.country ?? "",
      avatarEmoji: raw.avatarEmoji ?? "🙂",
      accent: raw.accent ?? "#FF3BFF",
      // Public profile endpoint doesn't expose socials/links (see INTEGRATION_PLAN.md).
      socials: {},
      links: [],
      featuredProductIds: products.map((p) => p.id),
    };
  } catch {
    // 404 or server error → neutral not-found below rather than crashing.
    profile = null;
  }

  if (!profile) {
    return (
      <div style={{ maxWidth: 420, margin: "0 auto", textAlign: "center", paddingTop: 40 }}>
        <div style={{ fontSize: 46, marginBottom: 12 }}>🔍</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Creator not found
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6, color: "var(--muted)", margin: "0 0 20px" }}>
          We couldn&apos;t find <span style={{ color: "var(--text)" }}>@{username}</span> on Kreav.
        </p>
        <Link
          href="/store"
          style={{
            display: "inline-block",
            fontFamily: "var(--font-mono)",
            fontSize: 13.5,
            fontWeight: 700,
            color: "#0A0A0A",
            background: "var(--accent, #FFE600)",
            border: "1.5px solid var(--line-strong, #0A0A0A)",
            borderRadius: "var(--r-sm, 8px)",
            padding: "11px 18px",
            textDecoration: "none",
          }}
        >
          Browse the store
        </Link>
      </div>
    );
  }

  return <CreatorMiniSite profile={profile} products={products} />;
}

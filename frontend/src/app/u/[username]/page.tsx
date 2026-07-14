import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import CreatorMiniSite from "@/components/CreatorMiniSite";
import { getPublicProfile } from "@/lib/api/users";
import { mapProfileProduct } from "@/lib/api/mappers";
import type { PublicProfileRaw } from "@/lib/api/types";
import type { CreatorProfile, Product } from "@/lib/types";

// Cache the fetch so generateMetadata + the page share one request (axios isn't
// deduped by Next's fetch cache).
const loadProfile = cache(async (username: string): Promise<PublicProfileRaw | null> => {
  try {
    return await getPublicProfile(username);
  } catch {
    return null;
  }
});

/** Per-creator metadata so the shared link previews richly (bio IG / WA / X). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const raw = await loadProfile(username);
  if (!raw) return { title: "Creator not found · Kreav" };
  const title = `${raw.displayName} (@${raw.username}) · Kreav`;
  const description =
    raw.bio || `${raw.displayName}'s digital products on Kreav — pay instantly with USDC.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "profile", url: `/u/${raw.username}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CreatorPublicPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  let profile: CreatorProfile | null = null;
  let products: Product[] = [];

  const raw = await loadProfile(username);
  if (raw) {
    const handle = `@${raw.username}`;
    products = raw.products.map((p) => mapProfileProduct(p, handle));
    profile = {
      username: raw.username,
      displayName: raw.displayName,
      bio: raw.bio ?? "",
      country: raw.country ?? "",
      avatarEmoji: raw.avatarEmoji ?? "🙂",
      accent: raw.accent ?? "#FF3BFF",
      socials: raw.socials ?? {},
      links: (raw.links ?? []).map((l, i) => ({ id: `l${i}`, label: l.label, url: l.url })),
      featuredProductIds: products.map((p) => p.id),
    };
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

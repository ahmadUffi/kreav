import Link from "next/link";
import CreatorMiniSite from "@/components/CreatorMiniSite";
import { findCreator } from "@/lib/mock";

export default async function CreatorPublicPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = findCreator(username);

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

  return <CreatorMiniSite profile={profile} />;
}

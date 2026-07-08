"use client";
import { useEffect, useRef, useState } from "react";
import { Card, Button, Input, Icon } from "@/components/ui";
import CreatorMiniSite from "@/components/CreatorMiniSite";
import { useSession } from "@/lib/api/useSession";
import { SessionNotice } from "@/components/SessionNotice";
import { getSite, saveSite } from "@/lib/api/site";
import { getMe } from "@/lib/api/users";
import { listProducts } from "@/lib/api/products";
import type { SiteConfigRaw } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import type { CreatorProfile, Product } from "@/lib/mock";

const ACCENTS = ["#FF3BFF", "#00F5FF", "#FFE600", "#FF4D00", "#0A0A0A"];

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text)",
  marginBottom: 7,
};
const fieldStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--font-mono)",
  fontSize: 14,
  padding: "12px 14px",
  borderRadius: "var(--r-sm, 8px)",
  border: "1.5px solid var(--line, rgba(10,10,10,.14))",
  outline: "none",
  background: "var(--card)",
  color: "var(--card-text)",
};

/** SiteConfigRaw → editor profile (BE links have no id; generate local ones). */
function toProfile(raw: SiteConfigRaw, country: string): CreatorProfile {
  return {
    username: raw.username,
    displayName: raw.displayName,
    bio: raw.bio ?? "",
    country,
    avatarEmoji: raw.avatarEmoji ?? "🙂",
    accent: raw.accent ?? "#FF3BFF",
    socials: raw.socials ?? {},
    links: raw.links.map((l, i) => ({ id: `l${i}`, label: l.label, url: l.url })),
    featuredProductIds: raw.featuredProductIds ?? [],
  };
}

/** Editor profile → SiteConfigRaw for PUT (strip local link ids, country lives in settings). */
function toSiteConfig(p: CreatorProfile): SiteConfigRaw {
  return {
    displayName: p.displayName,
    username: p.username,
    bio: p.bio || undefined,
    avatarEmoji: p.avatarEmoji || undefined,
    accent: p.accent || undefined,
    socials: p.socials,
    links: p.links.map((l) => ({ label: l.label, url: l.url })),
    featuredProductIds: p.featuredProductIds,
  };
}

export default function DashboardSitePage() {
  const { ready, userId } = useSession();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const linkId = useRef(1000);

  useEffect(() => {
    if (!ready || !userId) return;
    let alive = true;
    Promise.all([getSite(userId), getMe(userId), listProducts({ creatorId: userId, limit: 100 })])
      .then(([site, me, prods]) => {
        if (!alive) return;
        setProfile(toProfile(site, me.country ?? ""));
        setProducts(prods.items);
        setState("ready");
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof ApiError ? e.message : "Couldn't load your mini-site.");
        setState("error");
      });
    return () => {
      alive = false;
    };
  }, [ready, userId]);

  if (ready && !userId) return <SessionNotice />;

  if (state === "loading" || !profile) {
    return <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>Loading…</p>;
  }
  if (state === "error") {
    return (
      <Card className="text-center" style={{ padding: 32 }}>
        <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>{error}</p>
      </Card>
    );
  }

  const p = profile;
  const set = (patch: Partial<CreatorProfile>) => setProfile((cur) => (cur ? { ...cur, ...patch } : cur));
  const setSocial = (key: keyof CreatorProfile["socials"], value: string) =>
    setProfile((cur) => (cur ? { ...cur, socials: { ...cur.socials, [key]: value } } : cur));
  const updateLink = (id: string, patch: Partial<{ label: string; url: string }>) =>
    setProfile((cur) => (cur ? { ...cur, links: cur.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) } : cur));
  const removeLink = (id: string) =>
    setProfile((cur) => (cur ? { ...cur, links: cur.links.filter((l) => l.id !== id) } : cur));
  const addLink = () =>
    setProfile((cur) =>
      cur ? { ...cur, links: [...cur.links, { id: `l${linkId.current++}`, label: "New link", url: "https://" }] } : cur,
    );
  const toggleFeatured = (id: string) =>
    setProfile((cur) =>
      cur
        ? {
            ...cur,
            featuredProductIds: cur.featuredProductIds.includes(id)
              ? cur.featuredProductIds.filter((x) => x !== id)
              : [...cur.featuredProductIds, id],
          }
        : cur,
    );

  const copyLink = () => {
    const url = `${window.location.origin}/u/${p.username}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const save = async () => {
    if (!userId) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const updated = await saveSite(userId, toSiteConfig(p));
      setProfile(toProfile(updated, p.country));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your mini-site.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.05 }}>Mini-site</h1>
          <p className="mt-1" style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
            Your shareable page: <span style={{ color: "var(--text)" }}>kreav.app/u/{p.username}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={copyLink}>
            {copied ? "Copied!" : "Copy link"}
          </Button>
          <a href={`/u/${p.username}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <Button variant="secondary">View live</Button>
          </a>
          <Button variant="primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {saved && <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-success-fg, #0a7a45)" }}>✓ Saved</span>}
        </div>
      </div>
      {error && (
        <p className="mb-4" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-danger-fg, #b23a00)" }}>{error}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: 20 }}>
            <div className="mb-4" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>Profile</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Input id="dn" label="Display name" value={p.displayName} onChange={(e) => set({ displayName: e.target.value })} />
              <Input id="un" label="Username" value={p.username} onChange={(e) => set({ username: e.target.value.toLowerCase() })} />
              <div>
                <label htmlFor="bio" style={labelStyle}>Bio</label>
                <textarea id="bio" value={p.bio} onChange={(e) => set({ bio: e.target.value })} rows={3} style={{ ...fieldStyle, resize: "vertical" }} />
              </div>
              <Input id="av" label="Avatar emoji" value={p.avatarEmoji} onChange={(e) => set({ avatarEmoji: e.target.value })} />
              <div>
                <span style={labelStyle}>Accent</span>
                <div className="flex gap-2">
                  {ACCENTS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Accent ${c}`}
                      onClick={() => set({ accent: c })}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: c,
                        cursor: "pointer",
                        border: p.accent === c ? "2px solid var(--line-strong, #0A0A0A)" : "1px solid var(--line, rgba(10,10,10,.14))",
                        boxShadow: p.accent === c ? "var(--ring, 0 0 0 3px rgba(255,230,0,.4))" : "none",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card style={{ padding: 20 }}>
            <div className="mb-4" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>Socials</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Input id="ig" label="Instagram" value={p.socials.instagram ?? ""} onChange={(e) => setSocial("instagram", e.target.value)} />
              <Input id="xs" label="X" value={p.socials.x ?? ""} onChange={(e) => setSocial("x", e.target.value)} />
              <Input id="tk" label="TikTok" value={p.socials.tiktok ?? ""} onChange={(e) => setSocial("tiktok", e.target.value)} />
              <Input id="yt" label="YouTube" value={p.socials.youtube ?? ""} onChange={(e) => setSocial("youtube", e.target.value)} />
            </div>
          </Card>

          <Card style={{ padding: 20 }}>
            <div className="mb-4 flex items-center justify-between">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>Links</span>
              <Button variant="secondary" onClick={addLink} style={{ padding: "7px 12px" }}>
                + Add
              </Button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {p.links.map((l) => (
                <div key={l.id} className="flex items-start gap-2">
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <input value={l.label} onChange={(e) => updateLink(l.id, { label: e.target.value })} style={{ ...fieldStyle, padding: "9px 12px", fontSize: 13 }} />
                    <input value={l.url} onChange={(e) => updateLink(l.id, { url: e.target.value })} style={{ ...fieldStyle, padding: "9px 12px", fontSize: 12, color: "var(--muted)" }} />
                  </div>
                  <button
                    type="button"
                    aria-label="Remove link"
                    onClick={() => removeLink(l.id)}
                    style={{ background: "transparent", border: "1px solid var(--line, rgba(10,10,10,.14))", borderRadius: "var(--r-sm, 8px)", color: "var(--muted)", cursor: "pointer", padding: 8, lineHeight: 0 }}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ padding: 20 }}>
            <div className="mb-3" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>Featured products</div>
            {products.length === 0 ? (
              <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
                You have no products yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {products.map((prod) => {
                  const on = p.featuredProductIds.includes(prod.id);
                  return (
                    <label key={prod.id} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 13, cursor: "pointer" }}>
                      <input type="checkbox" checked={on} onChange={() => toggleFeatured(prod.id)} />
                      <span style={{ fontSize: 18 }}>{prod.emoji}</span>
                      {prod.title}
                    </label>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Live preview */}
        <div>
          <div className="lg:sticky" style={{ top: 84 }}>
            <div className="mb-3 flex items-center gap-2" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
              <Icon name="external" size={14} /> Live preview
            </div>
            <div
              style={{
                margin: "0 auto",
                maxWidth: 400,
                border: "1px solid var(--line, rgba(10,10,10,.14))",
                borderRadius: 22,
                background: "var(--bg)",
                boxShadow: "var(--shadow, 0 6px 20px rgba(10,10,10,.08))",
                padding: "28px 20px",
              }}
            >
              <CreatorMiniSite profile={p} products={products} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

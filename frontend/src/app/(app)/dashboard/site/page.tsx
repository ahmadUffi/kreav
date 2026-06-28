"use client";
import { useRef, useState } from "react";
import { Card, Button, Input, Icon } from "@/components/ui";
import CreatorMiniSite from "@/components/CreatorMiniSite";
import { currentCreator, products, type CreatorProfile } from "@/lib/mock";

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

export default function DashboardSitePage() {
  const [profile, setProfile] = useState<CreatorProfile>({ ...currentCreator, links: [...currentCreator.links] });
  const [copied, setCopied] = useState(false);
  const linkId = useRef(100);

  const set = (patch: Partial<CreatorProfile>) => setProfile((p) => ({ ...p, ...patch }));
  const setSocial = (key: keyof CreatorProfile["socials"], value: string) =>
    setProfile((p) => ({ ...p, socials: { ...p.socials, [key]: value } }));

  const updateLink = (id: string, patch: Partial<{ label: string; url: string }>) =>
    setProfile((p) => ({ ...p, links: p.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const removeLink = (id: string) => setProfile((p) => ({ ...p, links: p.links.filter((l) => l.id !== id) }));
  const addLink = () =>
    setProfile((p) => ({ ...p, links: [...p.links, { id: `l${linkId.current++}`, label: "New link", url: "https://" }] }));

  const toggleFeatured = (id: string) =>
    setProfile((p) => ({
      ...p,
      featuredProductIds: p.featuredProductIds.includes(id)
        ? p.featuredProductIds.filter((x) => x !== id)
        : [...p.featuredProductIds, id],
    }));

  const copyLink = () => {
    const url = `${window.location.origin}/u/${profile.username}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.05 }}>Mini-site</h1>
          <p className="mt-1" style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>
            Your shareable page: <span style={{ color: "var(--text)" }}>kreav.app/u/{profile.username}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={copyLink}>
            {copied ? "Copied!" : "Copy link"}
          </Button>
          <a href={`/u/${profile.username}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <Button variant="primary">View live</Button>
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: 20 }}>
            <div className="mb-4" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>Profile</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Input id="dn" label="Display name" value={profile.displayName} onChange={(e) => set({ displayName: e.target.value })} />
              <Input id="un" label="Username" value={profile.username} onChange={(e) => set({ username: e.target.value.toLowerCase() })} />
              <div>
                <label htmlFor="bio" style={labelStyle}>Bio</label>
                <textarea id="bio" value={profile.bio} onChange={(e) => set({ bio: e.target.value })} rows={3} style={{ ...fieldStyle, resize: "vertical" }} />
              </div>
              <Input id="av" label="Avatar emoji" value={profile.avatarEmoji} onChange={(e) => set({ avatarEmoji: e.target.value })} />
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
                        border: profile.accent === c ? "2px solid var(--line-strong, #0A0A0A)" : "1px solid var(--line, rgba(10,10,10,.14))",
                        boxShadow: profile.accent === c ? "var(--ring, 0 0 0 3px rgba(255,230,0,.4))" : "none",
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
              <Input id="ig" label="Instagram" value={profile.socials.instagram ?? ""} onChange={(e) => setSocial("instagram", e.target.value)} />
              <Input id="xs" label="X" value={profile.socials.x ?? ""} onChange={(e) => setSocial("x", e.target.value)} />
              <Input id="tk" label="TikTok" value={profile.socials.tiktok ?? ""} onChange={(e) => setSocial("tiktok", e.target.value)} />
              <Input id="yt" label="YouTube" value={profile.socials.youtube ?? ""} onChange={(e) => setSocial("youtube", e.target.value)} />
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
              {profile.links.map((l) => (
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {products.map((p) => {
                const on = profile.featuredProductIds.includes(p.id);
                return (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={on} onChange={() => toggleFeatured(p.id)} />
                    <span style={{ fontSize: 18 }}>{p.emoji}</span>
                    {p.title}
                  </label>
                );
              })}
            </div>
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
              <CreatorMiniSite profile={profile} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

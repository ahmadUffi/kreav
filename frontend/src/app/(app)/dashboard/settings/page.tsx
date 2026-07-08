"use client";
import { useEffect, useState } from "react";
import { Card, Input, Button, Badge } from "@/components/ui";
import { useSession } from "@/lib/api/useSession";
import { SessionNotice } from "@/components/SessionNotice";
import { getMe, updateMe } from "@/lib/api/users";
import { setUsername as persistUsername } from "@/lib/api/session";
import { ApiError } from "@/lib/api/client";

export default function DashboardSettingsPage() {
  const { ready, userId } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!ready || !userId) return;
    let alive = true;
    getMe()
      .then((u) => {
        if (!alive) return;
        setDisplayName(u.name ?? "");
        setUsername(u.username ?? "");
        setCountry(u.country ?? "");
        setState("ready");
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof ApiError ? e.message : "Couldn't load your settings.");
        setState("error");
      });
    return () => {
      alive = false;
    };
  }, [ready, userId]);

  if (ready && !userId) return <SessionNotice />;

  const save = async () => {
    if (!userId) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const updated = await updateMe({
        name: displayName.trim() || undefined,
        username: username.trim() || undefined,
        country: country.trim() || undefined,
      });
      if (updated.username) persistUsername(updated.username);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[560px]">
      <h1 className="mb-5" style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.05 }}>
        Settings
      </h1>

      <Card style={{ padding: 24 }}>
        <div className="mb-4" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>
          Profile
        </div>
        {state === "loading" ? (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>Loading…</p>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Input id="displayName" label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <Input id="username" label="Username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} />
              <Input id="country" label="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            {error && (
              <p style={{ margin: "14px 0 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-danger-fg, #b23a00)" }}>{error}</p>
            )}
            <div className="mt-5 flex items-center gap-3">
              <Button variant="primary" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              {saved && <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-success-fg, #0a7a45)" }}>✓ Saved</span>}
            </div>
          </>
        )}
      </Card>

      <Card style={{ padding: 24, marginTop: 16 }}>
        <div className="mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700 }}>
          Appearance
        </div>
        <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
          Light / dark theme is controlled from the top navigation toggle. <Badge tone="neutral">Demo</Badge>
        </p>
      </Card>
    </div>
  );
}

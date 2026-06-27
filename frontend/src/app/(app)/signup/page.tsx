"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod/v4";
import { Badge, Card, Button, Input } from "@/components/ui";

const signupSchema = z.object({
  email: z.email("Please enter a valid email address"),
  role: z.enum(["creator", "buyer"], "Please choose how you'll use Kreav"),
});

type Role = "creator" | "buyer";

const ROLES: { value: Role; title: string; blurb: string; emoji: string }[] = [
  { value: "creator", title: "I'm a creator", blurb: "Sell ebooks, presets, templates and more.", emoji: "🎨" },
  { value: "buyer", title: "I'm a buyer", blurb: "Discover and buy digital products.", emoji: "🛍️" },
];

/** Where each role lands after a successful (mock) signup. */
const DESTINATION: Record<Role, string> = {
  creator: "/wallet/connect", // FE-005 — connect a non-custodial wallet next
  buyer: "/store",
};

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [errors, setErrors] = useState<{ email?: string; role?: string }>({});
  const [submitted, setSubmitted] = useState(false);

  const destination = role ? DESTINATION[role] : "/store";

  // Mock success: after the confirmation flashes, route the user onward.
  useEffect(() => {
    if (!submitted) return;
    const t = setTimeout(() => router.push(destination), 1400);
    return () => clearTimeout(t);
  }, [submitted, destination, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = signupSchema.safeParse({ email, role });
    if (!result.success) {
      const next: { email?: string; role?: string } = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as "email" | "role";
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitted(true);
  };

  return (
    <div className="mx-auto max-w-[560px] px-10 pt-12 pb-[90px]">
      <Badge>Get started</Badge>
      <h1
        className="mt-4 mb-2"
        style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(30px, 4.4vw, 48px)", lineHeight: 1.05 }}
      >
        Create your account
      </h1>
      <p className="mb-8" style={{ fontFamily: "var(--font-mono)", fontSize: 14, lineHeight: 1.6, color: "var(--muted)" }}>
        One step to start buying or selling on Kreav.
      </p>

      {submitted ? (
        <Card className="text-center" style={{ padding: 40 }}>
          <div
            className="mx-auto mb-4 flex items-center justify-center"
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "var(--tone-success-bg, rgba(2,158,87,.14))",
              color: "var(--tone-success-fg, #0a7a45)",
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            ✓
          </div>
          <div className="mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700 }}>
            You&apos;re in!
          </div>
          <p className="mb-5" style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--muted)" }}>
            Welcome to Kreav as a {role}. Taking you to{" "}
            {role === "creator" ? "connect your wallet" : "the store"}…
          </p>
          <Button variant="primary" onClick={() => router.push(destination)}>
            Continue now
          </Button>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Role selection */}
          <div>
            <div
              className="mb-2.5"
              style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--text)" }}
            >
              How will you use Kreav?
            </div>
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map((r) => {
                const active = role === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    style={{
                      textAlign: "left",
                      cursor: "pointer",
                      background: active ? "var(--surface-2, rgba(10,10,10,.045))" : "var(--card)",
                      color: "var(--card-text)",
                      padding: 16,
                      borderRadius: "var(--r, 10px)",
                      border: `1.5px solid ${active ? "var(--line-strong, #0A0A0A)" : "var(--line, rgba(10,10,10,.14))"}`,
                      boxShadow: active ? "var(--ring, 0 0 0 3px rgba(255,230,0,.4))" : "var(--shadow-sm, 0 1px 2px rgba(10,10,10,.06))",
                      transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
                    }}
                  >
                    <div style={{ fontSize: 26, marginBottom: 8 }}>{r.emoji}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700 }}>{r.title}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
                      {r.blurb}
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.role && (
              <p className="mt-2" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-danger-fg, #FF4D00)" }}>
                {errors.role}
              </p>
            )}
          </div>

          <Input
            id="email"
            type="email"
            label="Email address"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />

          <Button type="submit" variant="primary" fullWidth>
            Create account
          </Button>

          {/* Non-custodial assurance */}
          <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, color: "var(--muted)" }}>
            🔒 Kreav is non-custodial. We&apos;ll <strong style={{ color: "var(--text)" }}>never</strong> ask
            for your seed phrase or secret key — you stay in full control of your wallet.
          </p>
        </form>
      )}
    </div>
  );
}

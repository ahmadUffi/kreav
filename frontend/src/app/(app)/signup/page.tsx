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
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "60px 40px 90px" }}>
      <Badge>Get started</Badge>
      <h1
        style={{
          fontFamily: "var(--font-anton)",
          fontSize: "clamp(34px, 5vw, 58px)",
          textTransform: "uppercase",
          lineHeight: 1,
          margin: "20px 0 30px",
        }}
      >
        Create your account
      </h1>

      {submitted ? (
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>✓</div>
          <div
            style={{
              fontFamily: "var(--font-anton)",
              fontSize: 24,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            You&apos;re in!
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--muted)", margin: "0 0 18px" }}>
            Welcome to Kreav as a {role}. Taking you to{" "}
            {role === "creator" ? "connect your wallet" : "the store"}…
          </p>
          <Button variant="secondary" onClick={() => router.push(destination)}>
            Continue now
          </Button>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {/* Role selection */}
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "var(--text)",
                marginBottom: 10,
              }}
            >
              How will you use Kreav?
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
                      background: "var(--card)",
                      color: "var(--card-text)",
                      padding: 18,
                      border: `3px solid ${active ? "#FFE600" : "#0A0A0A"}`,
                      boxShadow: active ? "8px 8px 0 #0A0A0A" : "6px 6px 0 #0A0A0A",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{r.emoji}</div>
                    <div style={{ fontFamily: "var(--font-anton)", fontSize: 18, textTransform: "uppercase" }}>
                      {r.title}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      {r.blurb}
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.role && (
              <p style={{ margin: "8px 0 0", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "#FF4D00" }}>
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
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1.6,
              color: "var(--muted)",
            }}
          >
            🔒 Kreav is non-custodial. We&apos;ll <strong style={{ color: "var(--text)" }}>never</strong> ask
            for your seed phrase or secret key — you stay in full control of your wallet.
          </p>
        </form>
      )}
    </div>
  );
}

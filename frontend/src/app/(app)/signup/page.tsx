"use client";
import { useState } from "react";
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

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [errors, setErrors] = useState<{ email?: string; role?: string }>({});
  const [submitted, setSubmitted] = useState(false);

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
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--muted)", margin: 0 }}>
            Welcome to Kreav as a {role}. We&apos;ll be in touch at {email}.
          </p>
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
        </form>
      )}
    </div>
  );
}

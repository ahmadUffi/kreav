"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod/v4";
import { Badge, Card, Button, Input, Stepper } from "@/components/ui";
import WalletConnectPanel from "@/components/WalletConnectPanel";
import { COUNTRIES } from "@/lib/constants";

type Role = "creator" | "buyer";

interface Data {
  role: Role | null;
  email: string;
  username: string;
  country: string;
  walletAddress: string | null;
}

type Phase = "form" | "submitting" | "done";

const ROLES: { value: Role; title: string; blurb: string; emoji: string }[] = [
  { value: "creator", title: "I'm a creator", blurb: "Sell ebooks, presets, templates and more.", emoji: "🎨" },
  { value: "buyer", title: "I'm a buyer", blurb: "Discover and buy digital products.", emoji: "🛍️" },
];

const TAKEN_USERNAMES = ["admin", "kreav", "support", "maya.shoots"];

const detailsSchema = z.object({
  email: z.email("Enter a valid email address"),
  username: z
    .string()
    .min(3, "At least 3 characters")
    .max(30, "Keep it under 30 characters")
    .regex(/^[a-z0-9._-]+$/, "Lowercase letters, numbers, . _ - only"),
  country: z.string().min(1, "Select your country"),
});

const stepsFor = (role: Role | null): string[] =>
  role === "buyer"
    ? ["Choose role", "Your details", "Review"]
    : ["Choose role", "Your details", "Connect wallet", "Review"];

type StepKind = "role" | "details" | "wallet" | "review";
function stepKind(role: Role | null, step: number): StepKind {
  if (step === 0) return "role";
  if (step === 1) return "details";
  if (role !== "buyer" && step === 2) return "wallet";
  return "review";
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>("form");
  const [data, setData] = useState<Data>({ role: null, email: "", username: "", country: "", walletAddress: null });
  const [errors, setErrors] = useState<{ email?: string; username?: string; country?: string }>({});

  const steps = stepsFor(data.role);
  const kind = stepKind(data.role, step);
  const isLast = step === steps.length - 1;

  // Mock create → success → redirect.
  useEffect(() => {
    if (phase !== "submitting") return;
    const t = setTimeout(() => setPhase("done"), 1100);
    return () => clearTimeout(t);
  }, [phase]);
  useEffect(() => {
    if (phase !== "done") return;
    const dest = data.role === "buyer" ? "/store" : "/dashboard";
    const t = setTimeout(() => router.push(dest), 1200);
    return () => clearTimeout(t);
  }, [phase, data.role, router]);

  const set = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }));

  const validateDetails = () => {
    const result = detailsSchema.safeParse({ email: data.email, username: data.username, country: data.country });
    const next: typeof errors = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof typeof errors;
        if (!next[key]) next[key] = issue.message;
      }
    }
    if (!next.username && TAKEN_USERNAMES.includes(data.username)) {
      next.username = "That username is already taken";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (kind === "role") {
      if (!data.role) return;
      setStep(1);
    } else if (kind === "details") {
      if (validateDetails()) setStep(2);
    } else if (kind === "wallet") {
      if (data.walletAddress) setStep(3);
    } else {
      setPhase("submitting");
    }
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  // --- Submitting / done overlay ---
  if (phase !== "form") {
    const done = phase === "done";
    return (
      <div className="mx-auto max-w-[560px] px-10 pt-12 pb-[90px]">
        <Card className="text-center" style={{ padding: 48 }}>
          {done ? (
            <div
              className="mx-auto mb-4 flex items-center justify-center"
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "var(--tone-success-bg, rgba(2,158,87,.14))",
                color: "var(--tone-success-fg, #0a7a45)",
                fontSize: 26,
                fontWeight: 800,
              }}
            >
              ✓
            </div>
          ) : (
            <div className="kv-blink mb-4" style={{ fontSize: 40 }}>⏳</div>
          )}
          <div className="mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700 }}>
            {done ? "You're all set!" : "Creating your account…"}
          </div>
          <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--muted)" }}>
            {done
              ? `Taking you to ${data.role === "buyer" ? "the store" : "your dashboard"}…`
              : "Setting up your Kreav profile."}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] px-10 pt-12 pb-[90px]">
      <Badge>Get started</Badge>
      <h1
        className="mt-4 mb-6"
        style={{ fontFamily: "var(--font-anton)", fontSize: "clamp(30px, 4.4vw, 48px)", lineHeight: 1.05 }}
      >
        Create your account
      </h1>

      <Stepper steps={steps} current={step} />

      {kind === "role" && (
        <div className="grid grid-cols-2 gap-3">
          {ROLES.map((r) => {
            const active = data.role === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => set({ role: r.value })}
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
      )}

      {kind === "details" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Input
            id="email"
            type="email"
            label="Email address"
            placeholder="your@email.com"
            value={data.email}
            onChange={(e) => set({ email: e.target.value })}
            onBlur={() => validateDetails()}
            error={errors.email}
          />
          <Input
            id="username"
            label="Username"
            placeholder="yourname"
            value={data.username}
            onChange={(e) => set({ username: e.target.value.toLowerCase() })}
            onBlur={() => validateDetails()}
            error={errors.username}
          />
          <div style={{ width: "100%" }}>
            <label htmlFor="country" style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 7 }}>
              Country
            </label>
            <select
              id="country"
              value={data.country}
              onChange={(e) => set({ country: e.target.value })}
              style={{
                width: "100%",
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                padding: "12px 14px",
                borderRadius: "var(--r-sm, 8px)",
                border: `1.5px solid ${errors.country ? "var(--tone-danger-fg, #FF4D00)" : "var(--line, rgba(10,10,10,.14))"}`,
                outline: "none",
                background: "var(--card)",
                color: data.country ? "var(--card-text)" : "var(--muted)",
              }}
            >
              <option value="" disabled>
                Select your country
              </option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c} style={{ color: "#0A0A0A" }}>
                  {c}
                </option>
              ))}
            </select>
            {errors.country && (
              <p style={{ margin: "7px 0 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tone-danger-fg, #FF4D00)" }}>
                {errors.country}
              </p>
            )}
          </div>
        </div>
      )}

      {kind === "wallet" && (
        <div>
          <Card style={{ padding: 32 }}>
            <WalletConnectPanel onConnected={(address) => set({ walletAddress: address })} />
          </Card>
          <p className="mt-4" style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, color: "var(--muted)" }}>
            🔒 Non-custodial — we never ask for your seed phrase or secret key.
          </p>
        </div>
      )}

      {kind === "review" && (
        <Card style={{ padding: 24 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
            Review your details
          </div>
          <ReviewRow label="Role" value={data.role ?? "—"} />
          <ReviewRow label="Email" value={data.email} />
          <ReviewRow label="Username" value={`@${data.username}`} />
          <ReviewRow label="Country" value={data.country} />
          {data.role !== "buyer" && (
            <ReviewRow label="Wallet" value={data.walletAddress ? truncate(data.walletAddress) : "Not connected"} />
          )}
        </Card>
      )}

      {/* Nav buttons */}
      <div className="mt-7 flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button variant="ghost" onClick={goBack}>
            ← Back
          </Button>
        ) : (
          <span />
        )}
        <Button
          variant="primary"
          disabled={(kind === "role" && !data.role) || (kind === "wallet" && !data.walletAddress)}
          onClick={goNext}
        >
          {isLast ? "Create account" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between gap-4"
      style={{ padding: "10px 0", borderTop: "1px solid var(--line, rgba(10,10,10,.14))" }}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function truncate(addr: string): string {
  return addr.length <= 11 ? addr : `${addr.slice(0, 4)}…${addr.slice(-3)}`;
}

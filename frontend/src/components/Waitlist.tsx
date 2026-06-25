"use client";
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { z } from "zod/v4";

gsap.registerPlugin(ScrollTrigger);

const emailSchema = z.object({
  email: z.email("Please enter a valid email address"),
});

export default function Waitlist() {
  const counterRef = useRef<HTMLSpanElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useGSAP(() => {
    const counter = counterRef.current;
    if (!counter) return;
    ScrollTrigger.create({
      trigger: counter,
      start: "top 88%",
      once: true,
      onEnter: () => {
        const obj = { v: 0 };
        gsap.to(obj, {
          v: 1000,
          duration: 1.6,
          ease: "power2.out",
          onUpdate: () => {
            if (counter) counter.textContent = Math.round(obj.v).toLocaleString("en-US");
          },
        });
      },
    });
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = emailSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <section
      ref={sectionRef}
      style={{
        background: "#FF3BFF",
        borderTop: "4px solid #0A0A0A",
        borderBottom: "4px solid #0A0A0A",
        padding: "64px 40px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-anton)",
          fontSize: "clamp(40px,7vw,92px)",
          lineHeight: 0.95,
          color: "#0A0A0A",
          textTransform: "uppercase",
        }}
      >
        <span ref={counterRef}>0</span>+ Creators Waiting
      </div>

      <p
        style={{
          fontSize: 15,
          color: "#0A0A0A",
          margin: "16px 0 26px",
          letterSpacing: 0.5,
          fontFamily: "var(--font-mono)",
        }}
      >
        Be among the first creators on Kreav.
      </p>

      {submitted ? (
        <div
          style={{
            display: "inline-block",
            background: "#0A0A0A",
            color: "#FFE600",
            border: "3px solid #0A0A0A",
            padding: "15px 30px",
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: 1,
            textTransform: "uppercase",
            boxShadow: "6px 6px 0 rgba(0,0,0,0.3)",
          }}
        >
          ✓ You&apos;re on the list!
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", gap: 0, justifyContent: "center", flexWrap: "wrap", maxWidth: 500, margin: "0 auto" }}
        >
          <div style={{ display: "flex", gap: 0, width: "100%", maxWidth: 480 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                flex: 1,
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                padding: "15px 18px",
                border: "3px solid #0A0A0A",
                borderRight: "none",
                outline: "none",
                background: "#fff",
                color: "#0A0A0A",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: 1,
                textTransform: "uppercase",
                background: loading ? "#ccc" : "#fff",
                color: "#0A0A0A",
                border: "3px solid #0A0A0A",
                padding: "15px 24px",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "6px 6px 0 #0A0A0A",
                whiteSpace: "nowrap",
              }}
            >
              {loading ? "..." : "Join The Waitlist"}
            </button>
          </div>
          {error && (
            <p
              style={{
                width: "100%",
                marginTop: 8,
                color: "#0A0A0A",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
              }}
            >
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

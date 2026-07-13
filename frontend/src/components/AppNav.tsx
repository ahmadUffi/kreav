"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "@/context/theme";
import { useSession } from "@/lib/api/useSession";
import { walletStatus, loginWithFreighter } from "@/lib/api/auth";
import { getMe } from "@/lib/api/users";
import {
  setToken,
  setUserId,
  setUsername,
  setWalletAddress,
  clearSession,
} from "@/lib/api/session";
import { truncateAddress, avatarFor } from "@/lib/stellar";
import type { UserRaw } from "@/lib/api/types";

const REQUIRED_NETWORK = "TESTNET";

/**
 * App shell navigation. Wallet-first:
 *  - Signed out → Store + a "Connect wallet" button (returning wallet logs in
 *    via SEP-10; a new wallet is routed to creator onboarding).
 *  - Signed in  → Store + Dashboard + an avatar chip (emoji circle + address)
 *    with a dropdown (Dashboard / Settings / Disconnect).
 */
export default function AppNav() {
  const { dark, toggle } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { ready, userId, walletAddress, username } = useSession();
  const signedIn = ready && !!userId;

  const [profile, setProfile] = useState<UserRaw | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectErr, setConnectErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Load the avatar/profile fields once signed in.
  useEffect(() => {
    if (!signedIn) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    getMe()
      .then((u) => {
        if (!cancelled) setProfile(u);
      })
      .catch(() => {
        /* avatar falls back to the address-derived one */
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const connect = async () => {
    setConnectErr(null);
    setConnecting(true);
    try {
      const fr = await import("@stellar/freighter-api");
      const conn = await fr.isConnected();
      if (conn.error || !conn.isConnected) {
        throw new Error("Freighter wallet is not installed.");
      }
      const access = await fr.requestAccess();
      if (access.error || !access.address) {
        throw new Error("Connection was rejected in Freighter.");
      }
      const net = await fr.getNetwork();
      if (net.error || net.network?.toUpperCase() !== REQUIRED_NETWORK) {
        throw new Error("Switch Freighter to the Testnet network.");
      }
      const address = access.address;

      const { registered } = await walletStatus(address);
      if (registered) {
        // Returning creator → SEP-10 login (signs a challenge in Freighter).
        const session = await loginWithFreighter(address);
        setToken(session.token);
        setUserId(session.user.id);
        setUsername(session.user.name);
        setWalletAddress(address);
        router.push("/dashboard");
      } else {
        // New wallet → creator onboarding, carrying the connected address.
        router.push(`/signup?wallet=${encodeURIComponent(address)}`);
      }
    } catch (e) {
      setConnectErr(e instanceof Error ? e.message : "Couldn't connect the wallet.");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    clearSession();
    setMenuOpen(false);
    setProfile(null);
    router.push("/");
  };

  const links = signedIn
    ? [
        { label: "Store", href: "/store" },
        { label: "Dashboard", href: "/dashboard" },
      ]
    : [{ label: "Store", href: "/store" }];

  const avatar = avatarFor(walletAddress ?? "", profile?.avatarEmoji, profile?.accent);
  const displayName =
    profile?.username || profile?.name || username || (walletAddress ? truncateAddress(walletAddress) : "Creator");

  return (
    <nav
      className="px-4 md:px-10"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 150,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 14,
        paddingBottom: 14,
        background: "color-mix(in srgb, var(--bg) 88%, transparent)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--line, rgba(10,10,10,.14))",
      }}
    >
      {/* Logo → back to marketing landing */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <svg width="18" height="18" viewBox="0 0 12 12">
          <rect x="5" y="0" width="2" height="3" fill="currentColor" />
          <rect x="5" y="9" width="2" height="3" fill="currentColor" />
          <rect x="0" y="5" width="3" height="2" fill="currentColor" />
          <rect x="9" y="5" width="3" height="2" fill="currentColor" />
          <rect x="4" y="4" width="4" height="4" fill="#FFE600" stroke="currentColor" strokeWidth="1" />
        </svg>
        <span style={{ fontFamily: "var(--font-anton)", fontSize: 22, letterSpacing: 0.5, color: "var(--text)" }}>
          KREAV
        </span>
      </Link>

      {/* Links + connect/avatar + theme toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="hidden md:flex" style={{ alignItems: "center", gap: 8 }}>
          {links.map(({ label, href }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                style={{
                  textDecoration: "none",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? "var(--text)" : "var(--muted)",
                  background: active ? "var(--surface-2, rgba(10,10,10,.06))" : "transparent",
                  padding: "7px 12px",
                  borderRadius: "var(--r-sm, 8px)",
                  transition: "color 0.15s, background 0.15s",
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Auth control */}
        {ready && !signedIn && (
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <button
              onClick={connect}
              disabled={connecting}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 0.3,
                background: "#FFE600",
                color: "#0A0A0A",
                border: "1px solid #0A0A0A",
                borderRadius: "var(--r-sm, 8px)",
                padding: "8px 14px",
                cursor: connecting ? "default" : "pointer",
                opacity: connecting ? 0.7 : 1,
              }}
            >
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
            {connectErr && (
              <span
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  maxWidth: 240,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  color: "var(--tone-danger-fg, #b23a00)",
                  textAlign: "right",
                }}
              >
                {connectErr}
              </span>
            )}
          </div>
        )}

        {signedIn && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Account menu"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "transparent",
                border: "1px solid var(--line, rgba(10,10,10,.14))",
                borderRadius: 999,
                padding: "4px 10px 4px 4px",
                cursor: "pointer",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: avatar.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                }}
              >
                {avatar.emoji}
              </span>
              <span className="hidden sm:inline" style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text)" }}>
                {walletAddress ? truncateAddress(walletAddress) : displayName}
              </span>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>▾</span>
            </button>

            {menuOpen && (
              <>
                {/* click-away layer */}
                <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    zIndex: 200,
                    minWidth: 200,
                    background: "var(--card)",
                    color: "var(--card-text)",
                    border: "1px solid var(--line, rgba(10,10,10,.14))",
                    borderRadius: "var(--r, 10px)",
                    boxShadow: "var(--shadow, 0 8px 24px rgba(10,10,10,.18))",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line, rgba(10,10,10,.14))" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>{displayName}</div>
                    {walletAddress && (
                      <div
                        title={walletAddress}
                        style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginTop: 2 }}
                      >
                        {truncateAddress(walletAddress)}
                      </div>
                    )}
                  </div>
                  <MenuItem onClick={() => { setMenuOpen(false); router.push("/dashboard"); }}>Dashboard</MenuItem>
                  <MenuItem onClick={() => { setMenuOpen(false); router.push("/dashboard/settings"); }}>Settings</MenuItem>
                  <MenuItem onClick={disconnect} danger>Disconnect</MenuItem>
                </div>
              </>
            )}
          </div>
        )}

        <button
          onClick={toggle}
          aria-label="Toggle colour theme"
          style={{
            marginLeft: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            lineHeight: 1,
            background: "transparent",
            color: "var(--text)",
            border: "1px solid var(--line, rgba(10,10,10,.14))",
            borderRadius: "var(--r-sm, 8px)",
            padding: "7px 9px",
            cursor: "pointer",
          }}
        >
          {dark ? "☀" : "☾"}
        </button>

        {/* Mobile nav menu */}
        <div className="md:hidden" style={{ position: "relative" }}>
          <button
            onClick={() => setNavOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={navOpen}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              color: "var(--text)",
              border: "1px solid var(--line, rgba(10,10,10,.14))",
              borderRadius: "var(--r-sm, 8px)",
              padding: "7px 8px",
              cursor: "pointer",
            }}
          >
            {navOpen ? (
              <svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="3" y1="3" x2="15" y2="15" />
                <line x1="15" y1="3" x2="3" y2="15" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="2" y1="5" x2="16" y2="5" />
                <line x1="2" y1="9" x2="16" y2="9" />
                <line x1="2" y1="13" x2="16" y2="13" />
              </svg>
            )}
          </button>

          {navOpen && (
            <>
              {/* click-away layer */}
              <div onClick={() => setNavOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  zIndex: 200,
                  minWidth: 180,
                  background: "var(--card)",
                  color: "var(--card-text)",
                  border: "1px solid var(--line, rgba(10,10,10,.14))",
                  borderRadius: "var(--r, 10px)",
                  boxShadow: "var(--shadow, 0 8px 24px rgba(10,10,10,.18))",
                  overflow: "hidden",
                  padding: 6,
                }}
              >
                {links.map(({ label, href }) => {
                  const active = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setNavOpen(false)}
                      style={{
                        display: "block",
                        textDecoration: "none",
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        fontWeight: active ? 700 : 500,
                        color: active ? "var(--card-text)" : "var(--muted)",
                        background: active ? "var(--surface-2, rgba(10,10,10,.06))" : "transparent",
                        padding: "10px 12px",
                        borderRadius: "var(--r-sm, 8px)",
                      }}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        padding: "10px 14px",
        color: danger ? "var(--tone-danger-fg, #b23a00)" : "var(--card-text)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2, rgba(10,10,10,.06))")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

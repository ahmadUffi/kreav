import AppNav from "@/components/AppNav";
import AppFooter from "@/components/AppFooter";

/**
 * Shared layout for the application routes (/store, /signup, /dashboard, …).
 * The marketing landing at "/" is outside this route group and keeps its own
 * full-brutalism composition. `data-surface="app"` activates the refined
 * neo-brutalism token set (see globals.css). Theme is provided by the root layout.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      data-surface="app"
      style={{
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: "var(--font-mono)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        transition: "background 0.3s, color 0.3s",
      }}
    >
      <AppNav />
      <main style={{ flex: 1 }}>{children}</main>
      <AppFooter />
    </div>
  );
}

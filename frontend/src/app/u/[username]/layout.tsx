/**
 * Minimal public layout for creator mini-sites — themed background only, no app
 * nav/footer (this is the shareable Instagram-bio page). `data-surface="app"`
 * activates the refined tokens. Theme is provided by the root layout.
 */
export default function CreatorSiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-surface="app"
      style={{
        background: "var(--bg)",
        color: "var(--text)",
        minHeight: "100vh",
        fontFamily: "var(--font-mono)",
        padding: "48px 20px 80px",
        transition: "background 0.3s, color 0.3s",
      }}
    >
      {children}
    </div>
  );
}

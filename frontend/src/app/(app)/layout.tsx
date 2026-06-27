import AppNav from "@/components/AppNav";
import Footer from "@/components/Footer";

/**
 * Shared layout for the application routes (/store, /signup, /dashboard).
 * The marketing landing at "/" is outside this route group and keeps its own
 * Nav/Hero composition. Theme is provided globally by the root layout.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
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
      <Footer />
    </div>
  );
}

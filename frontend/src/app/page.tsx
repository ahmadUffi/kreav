import { ThemeProvider } from "@/context/theme";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import HowItWorks from "@/components/HowItWorks";
import ProductShowcase from "@/components/ProductShowcase";
import Features from "@/components/Features";
import CreatorSpotlight from "@/components/CreatorSpotlight";
import Waitlist from "@/components/Waitlist";
import Footer from "@/components/Footer";

export default function Page() {
  return (
    <ThemeProvider>
      <div
        style={{
          background: "var(--bg)",
          color: "var(--text)",
          fontFamily: "var(--font-mono)",
          minHeight: "100vh",
          position: "relative",
          overflowX: "hidden",
          transition: "background 0.3s, color 0.3s",
        }}
      >
        <Nav />
        <Hero />
        <Marquee />
        <HowItWorks />
        <ProductShowcase />
        <Features />
        <CreatorSpotlight />
        <Waitlist />
        <Footer />
      </div>
    </ThemeProvider>
  );
}

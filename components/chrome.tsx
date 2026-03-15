import Link from "next/link";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/roadmap", label: "Roadmap" }
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand-mark">
        <span className="brand-kicker">AutoPulse AI</span>
        <span className="brand-title">Automotive Forecasting Portal</span>
      </Link>
      <nav className="site-nav" aria-label="Primary">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <p className="footer-title">AutoPulse AI</p>
        <p className="footer-copy">
          Germany-first automotive forecasting for consultants, SMEs, analysts, and mobility teams.
        </p>
      </div>
      <div className="footer-links">
        <Link href="/explore">Market dashboard</Link>
        <Link href="/roadmap">Feature roadmap</Link>
      </div>
    </footer>
  );
}

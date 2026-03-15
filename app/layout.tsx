import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import "./theme.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoPulse AI",
  description: "Germany-first automotive forecasting portal for registrations intelligence."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="page-shell">
          <div className="backdrop backdrop-one" />
          <div className="backdrop backdrop-two" />
          <div className="backdrop backdrop-grid" />
          <div className="content-frame">
            <SiteHeader />
            <main>{children}</main>
            <SiteFooter />
          </div>
        </div>
      </body>
    </html>
  );
}

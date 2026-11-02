import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FHUK Land Finder",
  description:
    "Off-market UK land sourcing dashboard for Flipping Homes UK — discovery and qualification.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Source+Sans+3:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <main>
          <header className="site-header">
            <a className="brand" href="/">
              Flipping Homes UK
              <span>Land Finder — discovery &amp; qualification</span>
            </a>
            <div className="meta-pill">Phase 0</div>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}

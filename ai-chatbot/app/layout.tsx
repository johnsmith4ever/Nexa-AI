import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEXA AI",
  description: "NEXA — a streaming multi-model AI assistant",
};

// Inline script runs before any paint — reads localStorage and sets data-theme
// to avoid a flash of the wrong theme. The ONE thing we store in localStorage.
const themeScript = `
(function(){
  try{
    var t=localStorage.getItem('nexa-theme');
    if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);return;}
    if(window.matchMedia('(prefers-color-scheme: light)').matches){
      document.documentElement.setAttribute('data-theme','light');
    }
  }catch(e){}
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Suppress hydration mismatch from the inline script */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>
        {/* ── Full-page ambient layer (A) — fixed, z-index -1, behind all UI ── */}
        <div className="bg-orbs grain" aria-hidden>
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <div className="bg-orb bg-orb-3" />
        </div>
        {children}
      </body>
    </html>
  );
}

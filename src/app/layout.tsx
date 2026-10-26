import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { DevStateSwitcher, EntryNotices } from "@/components/Prototype";

export const metadata: Metadata = {
  title: "SmartScheduler — One plan for school, work and life",
  description: "Your classes, work and life on one calendar, and a plan for exactly what to work on in every free gap.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
  width: "device-width",
  initialScale: 1,
  // Lets the bottom bar sit above the iPhone home indicator (env(safe-area-inset-bottom)).
  viewportFit: "cover",
};

// Applies the saved theme before first paint so there is no flash.
const themeScript = `(function(){try{var t=localStorage.getItem('prio:theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','light')}})();`;

// The home page is for newcomers. Opening "/" in a browser that already has its own
// calendars goes straight to the plan before anything is drawn (sample data doesn't
// count, so someone trying the sample can always get back to the home page), and a setup link made before
// the app moved to /app still lands there. The same page at /about never skips ahead,
// which is where Settings → About SmartScheduler leads.
const homeScript = `(function(){try{if(location.pathname!=='/')return;var h=location.hash;if(h.indexOf('#setup=')===0){location.replace('/app'+h);return}var w=JSON.parse(localStorage.getItem('prio:ws')||'null');if(w&&w.feeds&&w.feeds.length&&!w.demo)location.replace('/app')}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: homeScript }} />
      </head>
      <body>
        {children}
        {/* Prototype notice first, then the goal pop-up; each can be reopened from badges / Help. */}
        <EntryNotices />
        <DevStateSwitcher />
      </body>
    </html>
  );
}

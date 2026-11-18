import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import "./activity.css";
import "./auth.css";
import {PreferencesProvider} from './preferences';

export const metadata: Metadata = {
  title: "OnTrack — Stay on task. Stay on time.",
  description: "Công việc rõ ràng, deadline trong tầm tay. Quản lý task và tiến độ trên mọi thiết bị.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:"try{var p=JSON.parse(localStorage.getItem('ontrack-preferences-v1')||'{}');var d=document.documentElement;d.dataset.theme=p.theme==='dark'?'dark':'light';d.style.colorScheme=d.dataset.theme;d.lang=p.language==='en'?'en':'vi';}catch(e){}"}}/></head>
      <body className="antialiased"><PreferencesProvider>{children}</PreferencesProvider></body>
    </html>
  );
}

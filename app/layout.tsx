import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}

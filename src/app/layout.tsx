import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "心灵桥",
  description: "在这里，找到属于你的片刻宁静",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

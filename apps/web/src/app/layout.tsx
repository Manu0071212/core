import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/sidebar";
import I18nProvider from "./components/I18nProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DETI MakerLab",
  description: "The central information system for projects, groups, and equipment requisitions at DETI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <I18nProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 bg-zinc-100 px-3 py-14 sm:p-6 lg:p-10">
              {children}
            </main>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
import type { Metadata } from "next";
import localFont from "next/font/local";
import { DM_Sans } from 'next/font/google'
import "./globals.css";
import Header from "@/components/custom/header";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
})

export const metadata: Metadata = {
  title: "Febet - Delivery Management Platform",
  description: "Your one-stop platform for effortless delivery management—connecting you to the best logistics options in real-time.",
  viewport: {
    width: "device-width",
    initialScale: 1,
  },
  themeColor: "#ff6b00",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-gray-50">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dmSans.variable} antialiased h-full font-sans`} suppressHydrationWarning
      >
        <Header />
        {children}
      </body>
    </html>
  );
}

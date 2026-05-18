import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "SilverTrack Inventory",
  description: "Mobile-first silver inventory management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className={`${inter.variable} font-sans antialiased h-full flex flex-col`}>
        {children}
        <Toaster position="top-center" toastOptions={{
          style: {
            background: '#111827',
            color: '#E5E7EB',
            border: '1px solid rgba(255,255,255,0.08)'
          }
        }} />
      </body>
    </html>
  );
}

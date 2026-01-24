import type { Metadata } from "next";
import { Antic_Didone, Inter } from "next/font/google";
import "../globals.css";
import Navbar from "@/components/Navbar";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Toaster } from 'sonner';

const didot = Antic_Didone({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-didot",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The AC Style | Premier Personal Styling",
  description: "Elevate your confidence with The AC Style. Personal styling, closet detox, and fashion editorial services.",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${didot.variable} ${inter.variable} font-sans bg-ac-sand text-ac-taupe antialiased`} suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster position="top-center" richColors theme="system" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

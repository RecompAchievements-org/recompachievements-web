import { Chakra_Petch, Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  subsets: ["latin"],
  weight: ["600", "700"],
});

// Font CSS variables for <html>; used by the root layout and the global not-found page.
export const fontVariables = `${geistSans.variable} ${geistMono.variable} ${chakraPetch.variable}`;

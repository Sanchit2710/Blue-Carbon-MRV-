import type { Metadata } from "next";
import { Bricolage_Grotesque, Public_Sans } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"] });
const sans = Public_Sans({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BlueCarbon — Blue Carbon MRV",
  description: "Monitoring, reporting and verification for mangrove, seagrass and salt-marsh restoration.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "@repo/ui/globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/providers/QueryProvider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { AppLayoutWrapper } from "@/components/AppLayoutWrapper";
import { SalesRouteGuard } from "@/components/guards/SalesRouteGuard";
import { PasswordChangeGate } from "@/components/guards/PasswordChangeGate";
import { Toaster } from "@/components/ui/toaster";

// Body / UI copy
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Headings / display
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

// Retained for `font-mono` usages across the app
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Ralli Wolf Operations",
  description:
    "Ralli Wolf inventory, materials, warehouse, BOM and purchasing operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full overflow-hidden">
      <body
        className={`${inter.variable} ${plusJakartaSans.variable} ${geistMono.variable} h-full overflow-hidden`}
        suppressHydrationWarning
      >
        <QueryProvider>
          <AuthProvider>
            <PasswordChangeGate>
              <CurrencyProvider>
                <SalesRouteGuard>
                  <AppLayoutWrapper>{children}</AppLayoutWrapper>
                </SalesRouteGuard>
              </CurrencyProvider>
            </PasswordChangeGate>
          </AuthProvider>
        </QueryProvider>
        <Toaster
          position="bottom-right"
          richColors={true}
          closeButton={true}
          duration={5000}
          style={{ zIndex: 9999 }}
        />
      </body>
    </html>
  );
}

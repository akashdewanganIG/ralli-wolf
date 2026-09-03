import type { Metadata } from "next";
import localFont from "next/font/local";
import { Archivo_Black, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "@repo/ui/globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { QueryProvider } from "@/providers/query-provider";
import { CurrencyProvider } from "@/contexts/currency-context";
import { AppLayoutWrapper } from "@/components/app-layout-wrapper";
import { SalesRouteGuard } from "@/components/guards/sales-route-guard";
import { PasswordChangeGate } from "@/components/guards/password-change-gate";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo-black",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-vf.woff",
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${plusJakartaSans.variable} ${archivoBlack.variable} ${geistMono.variable} h-full overflow-hidden`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-full overflow-hidden" suppressHydrationWarning>
        <ThemeProvider>
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
            closeButton={true}
            duration={5000}
            style={{ zIndex: 9999 }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

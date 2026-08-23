import type { Metadata } from "next";
import localFont from "next/font/local";
import { Archivo_Black, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "@repo/ui/globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/providers/QueryProvider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { AppLayoutWrapper } from "@/components/AppLayoutWrapper";
import { SalesRouteGuard } from "@/components/guards/SalesRouteGuard";
import { PasswordChangeGate } from "@/components/guards/PasswordChangeGate";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";

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

// Display face for brand-level headings. Picked to sit close to the Ralli
// Wolf wordmark: an ultra-bold geometric grotesque with broad, round bowls
// rather than a condensed one.
const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo-black",
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
    // The font variables live on <html>, not <body>: Tailwind resolves
    // `@theme` tokens against :root, so a token that chains through
    // var(--font-*) sees nothing if the variable is only declared a level down.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${plusJakartaSans.variable} ${archivoBlack.variable} ${geistMono.variable} h-full overflow-hidden`}
    >
      <head>
        {/* Stamps `.dark` before first paint so a dark-mode user never sees
            a white flash. Must run blocking, hence dangerouslySetInnerHTML
            rather than next/script. */}
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
          {/* Inside the provider so the toast surface follows the theme.
              richColors stays off: <Toaster /> tints each status from the shared
              design tokens instead, which Sonner's own palette does not use. */}
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

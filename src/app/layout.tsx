import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { esES } from "@clerk/localizations"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Conceptos y Diseños",
    template: "%s | Conceptos y Diseños",
  },
  description:
    "Sistema integral de gestión de obras para Conceptos y Diseños — control financiero, facturas, anticipos y rentabilidad en tiempo real.",
  robots: "noindex, nofollow", // Internal tool — not for search engines
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // Prevent zoom on input focus (mobile UX)
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      localization={esES as never}
      appearance={{
        variables: {
          colorPrimary: "#1e3a5f",
          colorTextOnPrimaryBackground: "#f8fafc",
          borderRadius: "0.5rem",
          fontFamily: "Inter, system-ui, sans-serif",
        },
        elements: {
          formButtonPrimary:
            "bg-primary hover:bg-primary/90 text-primary-foreground transition-colors",
          card: "shadow-sm border border-border",
          headerTitle: "text-foreground font-bold",
          socialButtonsBlockButton:
            "border border-border hover:bg-muted transition-colors",
        },
      }}
    >
      <html lang="es" suppressHydrationWarning>
        <body className={`${inter.variable} font-sans antialiased overflow-x-hidden`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}

import type { Metadata } from "next"
import { Outfit, DM_Mono } from "next/font/google"
import "./globals.css"
import DataBootstrap from "@/app/DataBootstrap"

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
})

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "tapin — attendance",
  description: "Tap-and-go RFID attendance system",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${dmMono.variable}`}>
      <body style={{ background: "#0a0c0f" }}>
        <DataBootstrap>{children}</DataBootstrap>
      </body>
    </html>
  )
}

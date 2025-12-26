import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SplitBill - Hitung Patungan dengan Mudah",
  description:
    "Aplikasi untuk scan struk belanja dan hitung patungan secara otomatis. Upload foto struk atau input manual, lalu bagikan hasil split bill ke teman-teman.",
  keywords: [
    "split bill",
    "patungan",
    "scan struk",
    "receipt scanner",
    "hitung tagihan",
  ],
  authors: [{ name: "Danar" }],
  openGraph: {
    title: "SplitBill - Hitung Patungan dengan Mudah",
    description: "Scan struk belanja dan hitung patungan secara otomatis",
    type: "website",
    locale: "id_ID",
  },
  twitter: {
    card: "summary_large_image",
    title: "SplitBill - Hitung Patungan dengan Mudah",
    description: "Scan struk belanja dan hitung patungan secara otomatis",
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Using Inter - excellent x-height for readability (UI Design Tip #11)
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

const fontClasses = `${inter.variable} ${inter.className}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-200"
      lang="id"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Albert+Sans:ital,wght@0,100..900;1,100..900&family=Montserrat+Alternates:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${fontClasses} min-h-screen flex flex-col antialiased`}>
        <main className="flex-1">{children}</main>

        <footer className="w-full bg-slate-950/60 border-t border-slate-800/50 text-slate-400">
          <div className="mx-auto max-w-6xl w-full px-6 py-8 flex items-center justify-between text-sm">
            <div className="font-medium">
              © {new Date().getFullYear()} SplitBill
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-500">Made by Danar</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

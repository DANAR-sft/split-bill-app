import { Montserrat_Alternates, Albert_Sans } from "next/font/google";
import "./globals.css";

const montserratAlternates = Montserrat_Alternates({
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-montserrat-alternates",
});

const albertSans = Albert_Sans({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const fontClasses = `${montserratAlternates.className} ${albertSans.className}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className="bg-gradient-to-b from-black via-slate-900 to-black text-slate-100"
      lang="en"
    >
      <body className={`${fontClasses} min-h-screen flex flex-col`}>
        <main className="flex-1">{children}</main>

        <footer className="w-full bg-black/40 text-slate-400">
          <div className="mx-auto max-w-6xl w-full px-5 py-10 flex items-center justify-between text-sm">
            <div>© {new Date().getFullYear()} SplitBill</div>
            <div className="flex items-center gap-4">
              <span className="text-slate-500">Made by Danar</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

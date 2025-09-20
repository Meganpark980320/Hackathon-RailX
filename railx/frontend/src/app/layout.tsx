import type { Metadata } from "next";
import Providers from "./providers";
import Link from "next/link";
import "../app/globals.css";
import WalletNav from "../components/WalletNav";

export const metadata: Metadata = {
  title: "railx",
  description: "railx frontend",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#070b14] text-white">
        {/* ✅ Providers가 헤더+페이지 전체를 감싸도록 */}
        <Providers>
          {/* 헤더 */}
          <header className="h-14 border-b border-white/10 bg-slate-950/80 backdrop-blur">
            <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
              <Link href="/" className="font-semibold tracking-tight">
                RailX
              </Link>

              {/* <nav className="hidden sm:flex items-center gap-4 text-sm text-white/70">
                <Link href="/transfer" className="hover:text-white">Transfer</Link>
                <Link href="/explore" className="hover:text-white">Explore</Link>
              </nav> */}

              <div className="shrink-0">
                <WalletNav />
              </div>
            </div>
          </header>

          {/* 페이지 */}
          {children}
        </Providers>
      </body>
    </html>
  );
}

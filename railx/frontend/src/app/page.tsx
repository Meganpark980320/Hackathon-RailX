// src/app/page.tsx (서버 컴포넌트)
import { Hero } from "../components/Hero";

export default function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <main className="max-w-7xl mx-auto px-6 py-16">
        <Hero />
      </main>
    </div>
  );
}

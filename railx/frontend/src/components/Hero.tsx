"use client";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function Hero() {
  return (
    <section className="text-center">
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-4xl md:text-6xl font-bold"
      >
        Cross-Border Settlement <span className="text-emerald-300">meets DeFi Liquidity</span>
      </motion.h1>

      <p className="mt-6 text-lg text-white/70 max-w-2xl mx-auto">
        RailX is a bridge & liquidity hub on XRPL-EVM...
      </p>

      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link href="/transfer" className="px-6 py-3 rounded-2xl bg-emerald-400 text-slate-900 font-semibold inline-flex items-center gap-2 hover:bg-emerald-300">
          Transfer <ArrowRight className="size-4" />
        </Link>
        <Link href="/explore" className="px-6 py-3 rounded-2xl border border-white/20 bg-white/5 text-white/90 inline-flex items-center gap-2 hover:bg-white/10">
          Explore <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

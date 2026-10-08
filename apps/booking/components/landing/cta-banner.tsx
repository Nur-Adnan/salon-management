'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, ArrowRight, LayoutDashboard, Sparkles } from 'lucide-react';

export function CtaBanner() {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.08] py-24 md:py-32 bg-[#0c0d12]">
      {/* Background radial glow */}
      <div className="ambient-glow -bottom-32 left-1/2 h-[400px] w-[600px] -translate-x-1/2 bg-[#d4a373]" />

      <div className="relative mx-auto max-w-5xl px-6 text-center lg:px-8">
        <div className="inline-flex items-center gap-2 border border-[#d4a373]/30 bg-[#161920] px-3.5 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#d4a373]" />
          <span className="font-mono text-[10px] tracking-[0.2em] text-[#faedcd] uppercase">
            Experience Haute Hospitality
          </span>
        </div>

        <h2 className="mt-6 font-editorial text-3xl font-bold tracking-tight text-[#f8f9fa] sm:text-5xl lg:text-6xl">
          Elevate Your Sanctuary To Architectural Perfection.
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-[#9ba1a6] sm:text-base">
          Join the prestigious salons and medical aesthetic directors operating on AuraOS. Whether reserving your next bespoke ritual or deploying AuraOS across your multi-branch network, step into the future of luxury wellness today.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/luxe-salon"
            className="group flex items-center gap-3 border border-[#d4a373] bg-[#d4a373] px-8 py-4 text-xs font-bold tracking-widest text-[#0a0b0e] transition-all hover:bg-transparent hover:text-[#d4a373]"
          >
            <Calendar className="h-4 w-4" />
            <span>RESERVE APPOINTMENT NOW</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>

          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-white/[0.15] bg-[#161920]/80 px-6 py-4 text-xs font-medium tracking-widest text-[#f8f9fa] backdrop-blur-md transition-all hover:border-[#d4a373]/60 hover:bg-[#161920]"
          >
            <LayoutDashboard className="h-4 w-4 text-[#d4a373]" />
            <span>LAUNCH SALON ADMIN SUITE</span>
          </a>
        </div>
      </div>
    </section>
  );
}

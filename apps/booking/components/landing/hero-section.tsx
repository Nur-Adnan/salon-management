'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Sparkles, Clock, MapPin, Zap } from 'lucide-react';

export function HeroSection() {
  return (
    <section id="hero" className="relative overflow-hidden border-b border-white/[0.08] pt-12 pb-24 md:pt-20 md:pb-32">
      {/* Ambient background luminescence */}
      <div className="ambient-glow -top-32 left-1/2 h-[450px] w-[700px] -translate-x-1/2 bg-[#d4a373]" />
      <div className="ambient-glow top-40 right-10 h-[350px] w-[450px] bg-[#9e2a2b]" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Top Eyebrow Tag */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3"
        >
          <div className="inline-flex max-w-full flex-wrap items-center gap-2 border border-[#d4a373]/30 bg-[#161920]/80 px-3 py-1.5 backdrop-blur-md">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#d4a373]" />
            <span className="text-[10px] font-medium tracking-wider uppercase text-[#faedcd]">
              Aura OS · Enterprise Wellness
            </span>
          </div>

          <div className="hidden items-center gap-2 text-xs text-[#9ba1a6] sm:flex">
            <MapPin className="h-3.5 w-3.5 text-[#d4a373]" />
            <span>Gulshan Avenue Flagship &amp; Dhanmondi Suites</span>
          </div>
        </motion.div>

        {/* Hero Grid: Editorial Typography Left, Kinetic Interactive Core Right */}
        <div className="mt-8 grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Editorial Headline & Narrative */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7"
          >
            <h1 className="font-editorial text-4xl leading-[1.12] tracking-tight text-[#f8f9fa] sm:text-6xl lg:text-7xl">
              Precision Aesthetics.
              <br />
              <span className="text-gradient-gold italic">Cinematic Hospitality.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#9ba1a6] sm:text-lg">
              The unified operating system engineered for prestigious luxury salons, medical wellness clinics, and bespoke day spas. Unifying distributed sub-second slot resolution, clinical color ledgers, dual-rail fiscal POS, and predictive stock intelligence into one cohesive sanctuary experience.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/luxe-salon"
                className="group relative inline-flex items-center gap-3 border border-[#d4a373] bg-[#d4a373] px-7 py-3.5 text-xs font-semibold tracking-widest text-[#0a0b0e] transition-all duration-300 hover:bg-transparent hover:text-[#d4a373]"
              >
                <span>RESERVE APPOINTMENT</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>

              <a
                href="#concierge"
                className="inline-flex items-center gap-2 border border-white/[0.12] bg-[#161920]/60 px-6 py-3.5 text-xs font-medium tracking-widest text-[#f8f9fa] backdrop-blur-md transition-all hover:border-[#d4a373]/50 hover:bg-[#161920]"
              >
                <Zap className="h-3.5 w-3.5 text-[#d4a373]" />
                TRY LIVE CONCIERGE
              </a>

              <Link
                href="/luxe-salon/portal"
                className="text-xs tracking-wider text-[#9ba1a6] underline decoration-white/20 underline-offset-4 transition-colors hover:text-[#faedcd]"
              >
                Client VIP Portal →
              </Link>
            </div>

            {/* Trust & Performance Pillars */}
            <div className="mt-12 grid grid-cols-3 gap-6 border-t border-white/[0.08] pt-8">
              <div>
                <p className="font-editorial text-2xl font-bold text-[#f8f9fa] sm:text-3xl">0.04<span className="text-sm font-normal text-[#d4a373]">s</span></p>
                <p className="mt-1 text-xs tracking-wider text-[#9ba1a6]">Atomic Slot Resolution</p>
              </div>
              <div>
                <p className="font-editorial text-2xl font-bold text-[#f8f9fa] sm:text-3xl">100<span className="text-sm font-normal text-[#d4a373]">%</span></p>
                <p className="mt-1 text-xs tracking-wider text-[#9ba1a6]">Zero Double-Booking</p>
              </div>
              <div>
                <p className="font-editorial text-2xl font-bold text-[#f8f9fa] sm:text-3xl">৳32<span className="text-sm font-normal text-[#d4a373]">M+</span></p>
                <p className="mt-1 text-xs tracking-wider text-[#9ba1a6]">Luxury GMV Handled</p>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Kinetic Synaptic Core (Architectural Illustration) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative lg:col-span-5"
          >
            <div className="glass-panel-sharp relative p-6 sm:p-8">
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-xs tracking-widest text-[#f8f9fa] uppercase">
                    AURA_NODE_ACTIVE
                  </span>
                </div>
                <span className="font-mono text-[10px] text-[#9ba1a6]">
                  LATENCY: 14MS
                </span>
              </div>

              {/* Kinetic Synaptic Visual */}
              <div className="relative my-6 flex items-center justify-center py-4">
                {/* Concentric Orbital Rings */}
                <div className="relative flex h-64 w-64 items-center justify-center">
                  <div className="absolute h-64 w-64 rounded-full border border-dashed border-[#d4a373]/20 animate-[spin_60s_linear_infinite]" />
                  <div className="absolute h-48 w-48 rounded-full border border-white/[0.08] animate-[spin_40s_linear_infinite_reverse]" />
                  <div className="absolute h-32 w-32 rounded-full border border-[#d4a373]/30 bg-[#161920]/40 backdrop-blur-md" />

                  {/* Center Jewel: Aura Core */}
                  <div className="relative z-10 flex h-16 w-16 items-center justify-center border border-[#d4a373] bg-[#0a0b0e] shadow-[0_0_30px_rgba(212,163,115,0.25)]">
                    <Sparkles className="h-7 w-7 text-[#d4a373]" />
                  </div>

                  {/* Satellite Node 1: Availability Engine */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 border border-white/[0.1] bg-[#111318] px-2.5 py-1 font-mono text-[10px] text-[#faedcd]">
                    ATOMIC_SLOT_RESOLVER
                  </div>

                  {/* Satellite Node 2: Clinical CRM */}
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 border border-white/[0.1] bg-[#111318] px-2.5 py-1 font-mono text-[10px] text-[#faedcd]">
                    CLINICAL_COLOR_LEDGER
                  </div>

                  {/* Satellite Node 3: Fiscal POS */}
                  <div className="absolute -left-4 top-1/2 -translate-y-1/2 border border-white/[0.1] bg-[#111318] px-2 py-1 font-mono text-[10px] text-[#faedcd]">
                    BKASH_NAGAD_POS
                  </div>

                  {/* Satellite Node 4: FIFO Inventory */}
                  <div className="absolute -right-4 top-1/2 -translate-y-1/2 border border-white/[0.1] bg-[#111318] px-2 py-1 font-mono text-[10px] text-[#faedcd]">
                    FIFO_INVENTORY
                  </div>
                </div>
              </div>

              {/* Bottom Telemetry Status */}
              <div className="space-y-2 border-t border-white/[0.08] pt-4 text-xs font-mono">
                <div className="flex items-center justify-between text-[#9ba1a6]">
                  <span>Active Sanctuary</span>
                  <span className="text-[#f8f9fa]">Gulshan Avenue (Dhaka)</span>
                </div>
                <div className="flex items-center justify-between text-[#9ba1a6]">
                  <span>Master Artisans On Duty</span>
                  <span className="text-emerald-400">Sarah, Sophia, Rahim (100% Ready)</span>
                </div>
                <div className="flex items-center justify-between text-[#9ba1a6]">
                  <span>Available Appointments Today</span>
                  <span className="text-[#d4a373] font-bold">37 Slots Open</span>
                </div>
              </div>

              {/* Action Button inside card */}
              <div className="mt-5">
                <Link
                  href="/luxe-salon"
                  className="flex w-full items-center justify-center gap-2 border border-white/[0.1] bg-white/[0.03] py-2.5 text-xs font-medium tracking-wider text-[#f8f9fa] transition-colors hover:border-[#d4a373]/60 hover:bg-white/[0.06]"
                >
                  <Clock className="h-3.5 w-3.5 text-[#d4a373]" />
                  SELECT DATE &amp; ARTISAN DIRECTLY
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Check, Sparkles, Clock, Calendar, ArrowRight, ShieldCheck, HeartHandshake } from 'lucide-react';

interface SanctuaryBranch {
  id: string;
  name: string;
  location: string;
  features: string;
}

interface RitualService {
  id: string;
  name: string;
  category: string;
  duration: number;
  priceMinor: number;
  depositMinor: number;
  description: string;
}

interface Artisan {
  id: string;
  name: string;
  title: string;
  rating: string;
}

export function LiveConciergeSimulator() {
  const branches: SanctuaryBranch[] = [
    {
      id: '660000000000000000000010',
      name: 'Gulshan Avenue Flagship',
      location: 'Plot 42, Road 11, Gulshan-1, Dhaka',
      features: 'Full Clinical Suite · VIP Hydro-Lounge',
    },
    {
      id: '660000000000000000000011',
      name: 'Dhanmondi Botanical Sanctuary',
      location: 'House 28, Road 7/A, Dhanmondi, Dhaka',
      features: 'Aromatherapy Suites · Botanical Garden View',
    },
  ];

  const rituals: RitualService[] = [
    {
      id: '660000000000000000000040',
      name: 'Executive Haircut & Styling',
      category: 'Couture Hair',
      duration: 45,
      priceMinor: 150000,
      depositMinor: 50000,
      description: 'Consultation, botanical scalp therapy, custom scissor architecture, and styling finish.',
    },
    {
      id: '660000000000000000000041',
      name: 'Diamond Glow Hydrafacial',
      category: 'Medical Aesthetics',
      duration: 45,
      priceMinor: 350000,
      depositMinor: 100000,
      description: 'Triple-vortex clinical extraction, peptide infusion, and cryogenic lymphatic drainage.',
    },
    {
      id: 'bridal-glow',
      name: 'Bridal Royal Ceremony Bundle',
      category: 'Signature Ceremonies',
      duration: 120,
      priceMinor: 1200000,
      depositMinor: 300000,
      description: 'Comprehensive couture styling, 24K gold hydration ritual, and clinical glow prep.',
    },
  ];

  const artisans: Artisan[] = [
    { id: '660000000000000000000021', name: 'Sarah Khan', title: 'Senior Stylist & Creative Lead', rating: '4.99' },
    { id: '660000000000000000000020', name: 'Sophia Rahman', title: 'Master Aesthetic Director', rating: '5.00' },
    { id: 'any', name: 'First Available Master Artisan', title: 'Optimal Earliest Schedule', rating: '5.00' },
  ];

  const [selectedBranch, setSelectedBranch] = useState<SanctuaryBranch>(branches[0]!);
  const [selectedRitual, setSelectedRitual] = useState<RitualService>(rituals[0]!);
  const [selectedArtisan, setSelectedArtisan] = useState<Artisan>(artisans[0]!);

  const bdt = (poisha: number) => `৳${(poisha / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const vatAmount = selectedRitual.priceMinor * 0.15;
  const grandTotal = selectedRitual.priceMinor + vatAmount;

  return (
    <section id="concierge" className="relative border-b border-white/[0.08] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center">
          <span className="font-mono text-xs tracking-[0.25em] text-[#d4a373] uppercase">
            Interactive Treatment Concierge
          </span>
          <h2 className="mt-3 font-editorial text-3xl font-bold tracking-tight text-[#f8f9fa] sm:text-5xl">
            Experience Sub-Second Scheduling.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#9ba1a6] sm:text-base">
            Select your sanctuary, desired ritual, and master artisan. Watch AuraOS resolve real-time availability, calculate transparent pricing, and prepare your reservation instantenously.
          </p>
        </div>

        {/* Interactive Architecture Console */}
        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Controls Left Column */}
          <div className="space-y-8 lg:col-span-7">
            {/* 1. Branch Selector */}
            <div>
              <p className="font-mono text-xs tracking-wider text-[#9ba1a6] uppercase">
                Step 1 · Choose Sanctuary Location
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {branches.map((b) => {
                  const isSelected = selectedBranch.id === b.id;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBranch(b)}
                      className={`flex flex-col items-start p-4 text-left transition-all ${
                        isSelected
                          ? 'border border-[#d4a373] bg-[#161920]'
                          : 'border border-white/[0.08] bg-[#111318]/60 hover:border-white/[0.2]'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-medium text-sm text-[#f8f9fa]">{b.name}</span>
                        {isSelected && <Check className="h-4 w-4 text-[#d4a373]" />}
                      </div>
                      <span className="mt-1 text-xs text-[#9ba1a6]">{b.location}</span>
                      <span className="mt-2 text-[10px] font-mono text-[#d4a373]/80">{b.features}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Ritual Selector */}
            <div>
              <p className="font-mono text-xs tracking-wider text-[#9ba1a6] uppercase">
                Step 2 · Select Bespoke Ritual
              </p>
              <div className="mt-3 flex flex-col gap-3">
                {rituals.map((r) => {
                  const isSelected = selectedRitual.id === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRitual(r)}
                      className={`flex flex-col p-4 text-left transition-all sm:flex-row sm:items-center sm:justify-between ${
                        isSelected
                          ? 'border border-[#d4a373] bg-[#161920]'
                          : 'border border-white/[0.08] bg-[#111318]/60 hover:border-white/[0.2]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono tracking-wider text-[#d4a373] uppercase">
                            {r.category}
                          </span>
                          <span className="text-xs text-[#9ba1a6]">· {r.duration} min</span>
                        </div>
                        <h4 className="mt-1 font-medium text-sm text-[#f8f9fa]">{r.name}</h4>
                        <p className="mt-1 text-xs text-[#9ba1a6]">{r.description}</p>
                      </div>

                      <div className="mt-3 flex items-center justify-between sm:mt-0 sm:flex-col sm:items-end">
                        <span className="font-editorial text-lg font-bold text-[#f8f9fa]">
                          {bdt(r.priceMinor)}
                        </span>
                        <span className="text-[10px] text-[#9ba1a6]">
                          Deposit {bdt(r.depositMinor)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Artisan Selector */}
            <div>
              <p className="font-mono text-xs tracking-wider text-[#9ba1a6] uppercase">
                Step 3 · Preferred Master Artisan
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {artisans.map((a) => {
                  const isSelected = selectedArtisan.id === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelectedArtisan(a)}
                      className={`flex flex-col items-start p-3.5 text-left transition-all ${
                        isSelected
                          ? 'border border-[#d4a373] bg-[#161920]'
                          : 'border border-white/[0.08] bg-[#111318]/60 hover:border-white/[0.2]'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xs font-semibold text-[#f8f9fa]">{a.name}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-[#d4a373]" />}
                      </div>
                      <span className="mt-1 text-[11px] text-[#9ba1a6]">{a.title}</span>
                      <span className="mt-2 font-mono text-[10px] text-[#faedcd]">★ {a.rating} / 5.0</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Real-Time Reservation Ledger Right Column */}
          <div className="lg:col-span-5">
            <div className="glass-panel-sharp sticky top-28 p-6 sm:p-8">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <span className="font-mono text-xs tracking-widest text-[#d4a373] uppercase">
                  CONFIRMATION_TELEMETRY
                </span>
                <span className="font-mono text-[10px] text-emerald-400">
                  SLOTS_AVAILABLE
                </span>
              </div>

              {/* Summary Items */}
              <div className="mt-6 space-y-4">
                <div>
                  <span className="text-[10px] font-mono tracking-wider text-[#9ba1a6] uppercase">
                    Selected Sanctuary
                  </span>
                  <p className="font-medium text-sm text-[#f8f9fa]">{selectedBranch.name}</p>
                </div>

                <div className="border-t border-white/[0.06] pt-3">
                  <span className="text-[10px] font-mono tracking-wider text-[#9ba1a6] uppercase">
                    Bespoke Treatment
                  </span>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-[#f8f9fa]">{selectedRitual.name}</p>
                    <span className="font-mono text-xs text-[#d4a373]">{selectedRitual.duration}m</span>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-3">
                  <span className="text-[10px] font-mono tracking-wider text-[#9ba1a6] uppercase">
                    Assigned Master Artist
                  </span>
                  <p className="font-medium text-sm text-[#f8f9fa]">{selectedArtisan.name}</p>
                  <p className="text-xs text-[#9ba1a6]">{selectedArtisan.title}</p>
                </div>

                {/* Fiscal Breakdown */}
                <div className="border-t border-white/[0.08] pt-4 font-mono text-xs space-y-2">
                  <div className="flex justify-between text-[#9ba1a6]">
                    <span>Treatment Fee</span>
                    <span>{bdt(selectedRitual.priceMinor)}</span>
                  </div>
                  <div className="flex justify-between text-[#9ba1a6]">
                    <span>Applicable VAT (15%)</span>
                    <span>{bdt(vatAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/[0.08] pt-2 text-sm font-bold text-[#f8f9fa]">
                    <span>Estimated Total</span>
                    <span className="text-[#faedcd]">{bdt(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-[#d4a373]">
                    <span>Due at Booking (Deposit)</span>
                    <span className="font-bold">{bdt(selectedRitual.depositMinor)}</span>
                  </div>
                </div>

                {/* Guarantees */}
                <div className="space-y-1.5 border-t border-white/[0.08] pt-4 text-[11px] text-[#9ba1a6]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Free cancellation up to 2 hours before scheduled slot</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-[#d4a373]" />
                    <span>Earn 10 Loyalty Points per ৳100 spent</span>
                  </div>
                </div>

                {/* Action CTA */}
                <div className="pt-4">
                  <Link
                    href={`/luxe-salon?branch=${selectedBranch.id}`}
                    className="flex w-full items-center justify-center gap-2 border border-[#d4a373] bg-[#d4a373] py-3 text-xs font-bold tracking-widest text-[#0a0b0e] transition-all hover:bg-transparent hover:text-[#d4a373]"
                  >
                    <span>PROCEED WITH THIS RESERVATION</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <p className="mt-2 text-center text-[10px] text-[#9ba1a6]">
                    Locks slot instantly in AuraOS distributed calendar
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

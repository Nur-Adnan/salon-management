'use client';

import { motion } from 'framer-motion';
import { CalendarClock, Sparkles, CreditCard, Boxes, Users, UserCheck } from 'lucide-react';

interface Pillar {
  number: string;
  category: string;
  title: string;
  description: string;
  technicalGuarantee: string;
  icon: any;
}

export function ArchitecturalPillars() {
  const pillars: Pillar[] = [
    {
      number: '01',
      category: 'DISTRIBUTED SCHEDULING',
      title: 'Atomic Availability Engine',
      description:
        'Sub-second calendar matrix computing staff shifts, room resources, and multi-treatment buffer transitions. Guaranteed zero double-booking through Redis distributed mutex locks and atomic MongoDB replica-set transactions.',
      technicalGuarantee: '0.04s Slot Query · ACID Transaction Integrity',
      icon: CalendarClock,
    },
    {
      number: '02',
      category: 'MEDICAL & COSMETIC INTELLIGENCE',
      title: 'Clinical Aesthetic CRM & Charting',
      description:
        'Precision records for bespoke color formulas, patch-test chemical allergies, and clinical before/after photography. Built-in compliance workflows enforce explicit digital photo consent scopes before marketing exposure.',
      technicalGuarantee: 'Audit-Proof Consent Scopes · Formula Versioning',
      icon: Sparkles,
    },
    {
      number: '03',
      category: 'FISCAL INFRASTRUCTURE',
      title: 'Dual-Rail Point of Sale (POS)',
      description:
        'Offline-resilient cash register engineered for rapid checkout. Seamlessly split tenders across bKash, Nagad, Cards, and Cash with instant staff revenue attribution, tip allocation, and automated VAT reconciliation.',
      technicalGuarantee: 'Split-Tender Settlement · Offline Queue Sync',
      icon: CreditCard,
    },
    {
      number: '04',
      category: 'SUPPLY CHAIN OPTIMIZATION',
      title: 'FIFO Perishable Inventory',
      description:
        'Real-time stock tracking with First-In, First-Out (FIFO) lot allocation, perishable expiration countdowns, barcode lookups, and automated supplier purchase order generation when stock falls below reorder points.',
      technicalGuarantee: 'Lot Traceability · Automated Reorder Triggers',
      icon: Boxes,
    },
    {
      number: '05',
      category: 'WORKFORCE OPERATIONS',
      title: 'Staff Sovereignty & Payroll Engine',
      description:
        'Shift attendance clock-in with tamper-proof timestamps. Real-time commission ledger automatically computes tiered service rates, retail product spiffs, and tip distributions into monthly salary slips.',
      technicalGuarantee: 'Transparent Commission Ledger · Shift Auditing',
      icon: Users,
    },
    {
      number: '06',
      category: 'GUEST EXPERIENCES',
      title: 'VIP Client Sovereign Portal',
      description:
        'Passwordless phone OTP authentication gives clients a biometric digital concierge. Guests manage upcoming bookings, review past treatments, track loyalty points (10 pts / ৳100), and redeem digital gift cards.',
      technicalGuarantee: 'Rate-Limited OTP Authentication · Real-Time Wallet',
      icon: UserCheck,
    },
  ];

  return (
    <section id="pillars" className="relative border-b border-white/[0.08] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col items-start md:flex-row md:items-end md:justify-between">
          <div>
            <span className="font-mono text-xs tracking-[0.25em] text-[#d4a373] uppercase">
              Architectural Foundations
            </span>
            <h2 className="mt-3 font-editorial text-3xl font-bold tracking-tight text-[#f8f9fa] sm:text-5xl">
              Engineered For Sanctuary Sovereignty.
            </h2>
          </div>
          <p className="mt-4 max-w-md text-sm text-[#9ba1a6] md:mt-0">
            A cohesive modular monolith operating system designed to replace fractured third-party SaaS point solutions with unified precision.
          </p>
        </div>

        {/* Sharp Architectural Grid */}
        <div className="mt-16 grid grid-cols-1 border-t border-l border-white/[0.08] md:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p, idx) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.number}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                className="group relative flex flex-col justify-between border-r border-b border-white/[0.08] bg-[#0d0e12]/60 p-8 transition-colors duration-300 hover:bg-[#14161d]"
              >
                <div>
                  {/* Top Bar: Number + Category */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#d4a373]">
                      {p.number}
                    </span>
                    <span className="font-mono text-[10px] tracking-wider text-[#9ba1a6] uppercase">
                      {p.category}
                    </span>
                  </div>

                  {/* Icon & Title */}
                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center border border-white/[0.1] bg-[#161920] transition-colors group-hover:border-[#d4a373]">
                      <Icon className="h-4 w-4 text-[#d4a373]" />
                    </div>
                    <h3 className="font-editorial text-xl font-bold text-[#f8f9fa] group-hover:text-[#faedcd]">
                      {p.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="mt-4 text-xs leading-relaxed text-[#9ba1a6]">
                    {p.description}
                  </p>
                </div>

                {/* Bottom Technical Guarantee */}
                <div className="mt-8 border-t border-white/[0.06] pt-4">
                  <span className="font-mono text-[10px] tracking-wider text-[#faedcd]/80">
                    GUARANTEE: {p.technicalGuarantee}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

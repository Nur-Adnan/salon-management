'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Database, CreditCard, Bell, CalendarCheck, CheckCircle2, ChevronRight } from 'lucide-react';

interface PipelineStage {
  id: string;
  step: string;
  title: string;
  latency: string;
  icon: any;
  summary: string;
  technicalDetails: string[];
}

export function KineticPipelineDiagram() {
  const stages: PipelineStage[] = [
    {
      id: 'intake',
      step: 'STAGE 01',
      title: 'Guest Intake & Cryptographic Request',
      latency: '2ms',
      icon: CalendarCheck,
      summary: 'Incoming booking request verified via phone number OTP signature or anonymous guest token.',
      technicalDetails: [
        'Rate limiting enforced via Redis sliding window (60 req / min)',
        'Input payload schema validated via NestJS class-validator DTOs',
        'Customer record resolved or provisioned in MongoDB customers collection',
      ],
    },
    {
      id: 'mutex',
      step: 'STAGE 02',
      title: 'Distributed Concurrency Mutex',
      latency: '12ms',
      icon: Lock,
      summary: 'Acquires distributed lock for selected staff member, treatment room, and time interval.',
      technicalDetails: [
        'Redis distributed lock ensures atomicity across concurrent bookings',
        'Evaluates bufferBeforeMin and bufferAfterMin sanitation transitions',
        'Guaranteed zero double-booking under high concurrent load',
      ],
    },
    {
      id: 'replica',
      step: 'STAGE 03',
      title: 'ACID ReplicaSet Transaction',
      latency: '34ms',
      icon: Database,
      summary: 'Appointment document inserted atomically with audit log and status set to confirmed.',
      technicalDetails: [
        'MongoDB ReplicaSet (rs0) transaction ensures all-or-nothing guarantee',
        'Staff calendar projection indexed by start/end timestamps',
        'Waitlist automatic resolution triggered if a conflicting slot cancelled',
      ],
    },
    {
      id: 'fiscal',
      step: 'STAGE 04',
      title: 'Dual-Rail Fiscal Allocation',
      latency: '18ms',
      icon: CreditCard,
      summary: 'Deposit and future treatment balances mapped directly to POS cash register.',
      technicalDetails: [
        'Deposit recorded via bKash, Nagad, Card, or Loyalty Point ledger',
        'Outstanding customer due balance updated in CRM profile view',
        'Real-time staff commission ledger pre-calculates projected commission',
      ],
    },
    {
      id: 'telemetry',
      step: 'STAGE 05',
      title: 'Real-Time Telemetry & Dispatch',
      latency: '8ms',
      icon: Bell,
      summary: 'SMS, WhatsApp, and staff calendar push notifications dispatched instantaneously.',
      technicalDetails: [
        'SMS gateway dispatches branded booking confirmation with direct reschedule link',
        'Admin calendar updates via server-sent events without manual refresh',
        'Calendar ICS export payload generated for client native calendar integration',
      ],
    },
  ];

  const [activeStage, setActiveStage] = useState<PipelineStage>(stages[0]!);

  return (
    <section id="architecture" className="relative border-b border-white/[0.08] py-24 md:py-32 bg-[#090a0d]">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <span className="font-mono text-xs tracking-[0.25em] text-[#d4a373] uppercase">
            Transactional Architecture
          </span>
          <h2 className="mt-3 font-editorial text-3xl font-bold tracking-tight text-[#f8f9fa] sm:text-5xl">
            Atomic Booking Execution Pipeline.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#9ba1a6] sm:text-base">
            Every guest reservation passes through a 5-stage distributed transaction pipeline engineered for zero downtime, strict multi-tenant isolation, and sub-second execution.
          </p>
        </div>

        {/* Pipeline Progression Steps (Interactive) */}
        <div className="mt-16 grid grid-cols-1 gap-2 sm:grid-cols-5 border border-white/[0.08] bg-[#111318]/60 p-2">
          {stages.map((stage) => {
            const isActive = activeStage.id === stage.id;
            const Icon = stage.icon;
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStage(stage)}
                className={`flex flex-col items-start p-4 text-left transition-all ${
                  isActive
                    ? 'border border-[#d4a373] bg-[#161920]'
                    : 'border border-transparent hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-mono text-[10px] text-[#d4a373]">{stage.step}</span>
                  <span className="font-mono text-[10px] text-[#9ba1a6]">{stage.latency}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-[#d4a373]' : 'text-[#9ba1a6]'}`} />
                  <span className="font-medium text-xs text-[#f8f9fa] line-clamp-1">{stage.title}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detailed Stage Deep-Dive Card */}
        <div className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStage.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="glass-panel-sharp p-8 sm:p-10"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="border border-[#d4a373]/30 bg-[#161920] px-2.5 py-1 font-mono text-[10px] text-[#faedcd]">
                      {activeStage.step}
                    </span>
                    <span className="font-mono text-xs text-emerald-400">
                      LATENCY BENCHMARK: {activeStage.latency}
                    </span>
                  </div>
                  <h3 className="mt-3 font-editorial text-2xl font-bold text-[#f8f9fa] sm:text-3xl">
                    {activeStage.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#9ba1a6]">
                    {activeStage.summary}
                  </p>
                </div>

                <div className="border border-white/[0.08] bg-[#0c0d11] p-5 lg:min-w-[320px]">
                  <p className="font-mono text-[11px] text-[#d4a373] uppercase tracking-wider">
                    Distributed Guarantees
                  </p>
                  <ul className="mt-3 space-y-2 text-xs text-[#9ba1a6]">
                    {activeStage.technicalDetails.map((detail, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-400 shrink-0" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

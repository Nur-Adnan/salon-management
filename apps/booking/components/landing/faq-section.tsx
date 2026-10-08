'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

export function FaqSection() {
  const faqs: FaqItem[] = [
    {
      question: 'How does AuraOS guarantee zero double-bookings during peak hours?',
      answer:
        'AuraOS uses a dual-layer concurrency architecture: a Redis distributed lock guards the specific staff member, room resource, and time interval for the duration of the reservation process, while MongoDB ReplicaSet multi-document transactions ensure all schedule updates, customer ledgers, and audit trails commit atomically.',
    },
    {
      question: 'How does the POS register handle bKash, Nagad, and Card split-tenders?',
      answer:
        'Our Point of Sale register features native multi-rail tender support. A single checkout invoice can be split across bKash, Nagad QR, credit cards, cash, and digital gift cards in arbitrary proportions with real-time verification and transaction reconciliation.',
    },
    {
      question: 'How are clinical treatment notes and chemical allergy warnings managed?',
      answer:
        'Every customer profile maintains an auditable clinical chart including patch-test chemical allergies, color formulation notes (swatches, developer ratios, processing time), and high-resolution before/after photography with legally-binding client consent scopes.',
    },
    {
      question: 'Can guests reschedule or cancel appointments without calling the front desk?',
      answer:
        'Yes. Guests access their private self-service portal using passwordless phone OTP verification. They can view upcoming appointments, reschedule within the allowable cancellation window, review treatment receipts, and check their loyalty points.',
    },
    {
      question: 'How does the inventory system prevent product stockouts and expired cosmetics?',
      answer:
        'The inventory engine enforces First-In, First-Out (FIFO) lot allocation with automatic expiration date tracking. When stock falls below custom reorder thresholds, AuraOS automatically drafts supplier purchase orders.',
    },
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative border-b border-white/[0.08] py-24 md:py-32">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <span className="font-mono text-xs tracking-[0.25em] text-[#d4a373] uppercase">
            Clarity &amp; Technical Detail
          </span>
          <h2 className="mt-3 font-editorial text-3xl font-bold tracking-tight text-[#f8f9fa] sm:text-5xl">
            Frequently Explored Inquiries.
          </h2>
        </div>

        <div className="mt-16 divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={index} className="py-6">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between text-left text-base font-medium text-[#f8f9fa] transition-colors hover:text-[#faedcd]"
                >
                  <span className="font-editorial text-lg sm:text-xl">{faq.question}</span>
                  <div className="ml-4 flex h-7 w-7 shrink-0 items-center justify-center border border-white/[0.1] text-[#d4a373]">
                    {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="mt-4 text-sm leading-relaxed text-[#9ba1a6]">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

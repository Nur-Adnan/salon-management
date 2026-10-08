'use client';

import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  sanctuary: string;
}

export function SanctuarySocialProof() {
  const testimonials: Testimonial[] = [
    {
      quote:
        'AuraOS eliminated our booking collisions entirely. The clinical color formula ledger means our VIP guests get identical precision across both our Gulshan and Dhanmondi locations without relying on paper charts.',
      author: 'Farhana Chowdhury',
      role: 'Creative Director & Founder',
      sanctuary: 'Luxe Salon & Aesthetic Sanctuary (Dhaka)',
    },
    {
      quote:
        'The dual-rail POS with integrated bKash and Nagad split-tenders doubled our front-desk checkout velocity. Our stylists now track their daily commission and tips live directly from their mobile portal.',
      author: 'Naveed Al-Hassan',
      role: 'Operations & Managing Partner',
      sanctuary: 'The Royal Spa Suites',
    },
    {
      quote:
        'The passwordless OTP client portal increased repeat rebooking by 38%. Our guests love having their complete treatment history and loyalty wallet in one clean, biometric screen.',
      author: 'Dr. Samira Khan',
      role: 'Lead Dermatological Aesthetician',
      sanctuary: 'Aura Medical Wellness',
    },
  ];

  return (
    <section id="sanctuaries" className="relative border-b border-white/[0.08] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center">
          <span className="font-mono text-xs tracking-[0.25em] text-[#d4a373] uppercase">
            Proven In Prestige Sanctuaries
          </span>
          <h2 className="mt-3 font-editorial text-3xl font-bold tracking-tight text-[#f8f9fa] sm:text-5xl">
            Trusted By Elite Wellness Directors.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#9ba1a6]">
            Hear how Bangladesh’s premier luxury salons and clinical aesthetic practices run their daily operations with AuraOS.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {testimonials.map((t, idx) => (
            <motion.div
              key={t.author}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="glass-panel-sharp flex flex-col justify-between p-8"
            >
              <div>
                <div className="flex items-center gap-1 text-[#d4a373]">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-[#d4a373]" />
                  ))}
                </div>
                <p className="mt-6 text-sm leading-relaxed text-[#f8f9fa] italic font-editorial">
                  "{t.quote}"
                </p>
              </div>

              <div className="mt-8 border-t border-white/[0.06] pt-4">
                <p className="text-xs font-bold text-[#f8f9fa]">{t.author}</p>
                <p className="text-[11px] text-[#9ba1a6]">{t.role}</p>
                <p className="text-[10px] font-mono text-[#d4a373] mt-0.5">{t.sanctuary}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

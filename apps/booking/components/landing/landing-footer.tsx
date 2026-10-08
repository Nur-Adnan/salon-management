'use client';

import Link from 'next/link';
import { Sparkles, MapPin, Phone, Mail, Globe, Shield } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#07080a] text-xs text-[#9ba1a6]">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Brand Column */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center border border-[#d4a373]/40 bg-[#161920]">
                <Sparkles className="h-4 w-4 text-[#d4a373]" />
              </div>
              <span className="font-editorial text-xl font-bold tracking-widest text-[#f8f9fa]">
                AURA
              </span>
            </div>
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-[#9ba1a6]">
              The high-performance operating system designed for prestige luxury salons, aesthetic clinics, and boutique wellness sanctuaries.
            </p>

            <div className="mt-6 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[11px] text-emerald-400">
                AuraOS Core: All Services Operational (12ms)
              </span>
            </div>
          </div>

          {/* Column 2: Guest Reservations */}
          <div className="lg:col-span-3">
            <h4 className="font-mono text-xs font-bold tracking-widest text-[#f8f9fa] uppercase">
              Sanctuary Access
            </h4>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link href="/luxe-salon" className="transition-colors hover:text-[#d4a373]">
                  Reserve Appointment (Online)
                </Link>
              </li>
              <li>
                <Link href="/luxe-salon/portal" className="transition-colors hover:text-[#d4a373]">
                  VIP Client Self-Service Portal
                </Link>
              </li>
              <li>
                <a href="#concierge" className="transition-colors hover:text-[#d4a373]">
                  Live Treatment Concierge
                </a>
              </li>
              <li>
                <span className="text-[#9ba1a6]/60">Gulshan Avenue Flagship (Dhaka)</span>
              </li>
              <li>
                <span className="text-[#9ba1a6]/60">Dhanmondi Botanical Suite</span>
              </li>
            </ul>
          </div>

          {/* Column 3: Platform Architecture */}
          <div className="lg:col-span-3">
            <h4 className="font-mono text-xs font-bold tracking-widest text-[#f8f9fa] uppercase">
              Platform Modules
            </h4>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[#d4a373]">
                  Salon Admin &amp; Management Suite
                </a>
              </li>
              <li>
                <a href="#pillars" className="transition-colors hover:text-[#d4a373]">
                  Atomic Scheduling Engine
                </a>
              </li>
              <li>
                <a href="#pillars" className="transition-colors hover:text-[#d4a373]">
                  Clinical Color Formula CRM
                </a>
              </li>
              <li>
                <a href="#pillars" className="transition-colors hover:text-[#d4a373]">
                  Multi-Rail Point of Sale (POS)
                </a>
              </li>
              <li>
                <a href="#pillars" className="transition-colors hover:text-[#d4a373]">
                  FIFO Perishable Inventory
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Compliance & Support */}
          <div className="lg:col-span-2">
            <h4 className="font-mono text-xs font-bold tracking-widest text-[#f8f9fa] uppercase">
              Governance
            </h4>
            <ul className="mt-4 space-y-2.5">
              <li className="flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-[#d4a373]" />
                <span>Photo Consent Standards</span>
              </li>
              <li>
                <span>HIPAA &amp; GDPR Compliant</span>
              </li>
              <li>
                <span>Multi-Tenant Data Isolation</span>
              </li>
              <li>
                <span>Bangladesh VAT Compliance</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between border-t border-white/[0.06] pt-8 sm:flex-row">
          <p className="text-[11px] text-[#9ba1a6]">
            &copy; {new Date().getFullYear()} Aura Luxury Wellness Platform. All rights reserved.
          </p>
          <div className="mt-4 flex gap-6 text-[11px] sm:mt-0">
            <span className="hover:text-[#f8f9fa]">Privacy Shield</span>
            <span className="hover:text-[#f8f9fa]">Terms of Service</span>
            <span className="hover:text-[#f8f9fa]">Security Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

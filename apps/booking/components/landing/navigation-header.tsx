'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Calendar, UserCheck, LayoutDashboard, Menu, X, ArrowUpRight } from 'lucide-react';

export function NavigationHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Rituals', href: '#rituals' },
    { label: 'Live Concierge', href: '#concierge' },
    { label: 'Operating System', href: '#pillars' },
    { label: 'Architecture', href: '#architecture' },
    { label: 'Sanctuaries', href: '#sanctuaries' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#0a0b0e]/80 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        {/* Brand Monogram */}
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border border-[#d4a373]/40 bg-[#161920] transition-colors group-hover:border-[#d4a373]">
            <Sparkles className="h-5 w-5 text-[#d4a373] transition-transform duration-300 group-hover:scale-110" />
          </div>
          <div className="flex flex-col">
            <span className="font-editorial text-xl font-bold tracking-widest text-[#f8f9fa] group-hover:text-[#faedcd]">
              AURA
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#9ba1a6]">
              Haute Wellness OS
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="group relative text-sm tracking-wider text-[#9ba1a6] transition-colors hover:text-[#f8f9fa]"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-[#d4a373] transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>

        {/* Action CTAs */}
        <div className="hidden items-center gap-4 lg:flex">
          <Link
            href="/luxe-salon/portal"
            className="flex items-center gap-2 border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-xs font-medium tracking-wider text-[#f8f9fa] transition-all hover:border-[#d4a373]/50 hover:bg-white/[0.08]"
          >
            <UserCheck className="h-3.5 w-3.5 text-[#d4a373]" />
            VIP PORTAL
          </Link>

          <Link
            href="/luxe-salon"
            className="group relative flex items-center gap-2 overflow-hidden border border-[#d4a373] bg-[#d4a373] px-5 py-2 text-xs font-semibold tracking-wider text-[#0a0b0e] transition-all duration-300 hover:bg-transparent hover:text-[#d4a373]"
          >
            <Calendar className="h-3.5 w-3.5" />
            RESERVE RITUAL
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>

          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-[#9ba1a6] transition-colors hover:text-[#f8f9fa]"
            title="Open Salon Admin Suite"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Admin
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex h-10 w-10 items-center justify-center border border-white/[0.1] text-[#f8f9fa] md:hidden"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-white/[0.08] bg-[#0e1015] px-6 py-6 md:hidden"
          >
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1 text-sm tracking-wider text-[#9ba1a6] hover:text-[#f8f9fa]"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.08] pt-4">
                <Link
                  href="/luxe-salon"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 border border-[#d4a373] bg-[#d4a373] py-2.5 text-xs font-semibold tracking-wider text-[#0a0b0e]"
                >
                  <Calendar className="h-4 w-4" />
                  RESERVE RITUAL
                </Link>
                <Link
                  href="/luxe-salon/portal"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 border border-white/[0.1] py-2.5 text-xs font-medium tracking-wider text-[#f8f9fa]"
                >
                  <UserCheck className="h-4 w-4 text-[#d4a373]" />
                  CLIENT VIP PORTAL
                </Link>
                <a
                  href="http://localhost:3000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2 text-xs text-[#9ba1a6]"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Open Admin Suite
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

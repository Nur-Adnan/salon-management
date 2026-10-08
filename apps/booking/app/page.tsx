import type { Metadata } from 'next';
import { SmoothScrollProvider } from '@/components/landing/smooth-scroll-provider';
import { NavigationHeader } from '@/components/landing/navigation-header';
import { HeroSection } from '@/components/landing/hero-section';
import { LiveConciergeSimulator } from '@/components/landing/live-concierge-simulator';
import { ArchitecturalPillars } from '@/components/landing/architectural-pillars';
import { KineticPipelineDiagram } from '@/components/landing/kinetic-pipeline-diagram';
import { SanctuarySocialProof } from '@/components/landing/sanctuary-social-proof';
import { FaqSection } from '@/components/landing/faq-section';
import { CtaBanner } from '@/components/landing/cta-banner';
import { LandingFooter } from '@/components/landing/landing-footer';

export const metadata: Metadata = {
  title: 'Aura Luxury Wellness OS | Premier Salon & Medical Spa Operating System',
  description:
    'The unified operating system engineered for prestige luxury salons, medical aesthetics, and boutique wellness sanctuaries. Sub-second booking, clinical color ledgers, dual-rail fiscal POS, and predictive stock intelligence.',
  openGraph: {
    title: 'Aura Luxury Wellness OS | Haute Salon Architecture',
    description:
      'Where clinical precision meets five-star luxury hospitality. Atomic scheduling, clinical charting, and dual-rail fiscal Point of Sale.',
    url: 'http://localhost:3001',
    siteName: 'Aura Luxury Wellness OS',
    locale: 'en_US',
    type: 'website',
  },
};

export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Aura Luxury Wellness OS',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Cloud / Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BDT',
    },
    description:
      'Enterprise operating system for luxury salons and medical spas featuring sub-second slot resolution, clinical color ledgers, and dual-rail POS.',
  };

  return (
    <SmoothScrollProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="relative min-h-screen overflow-x-hidden bg-[#0a0b0e] text-[#f8f9fa] selection:bg-[#d4a373] selection:text-[#0a0b0e]">
        {/* Top Translucent Navigation Header */}
        <NavigationHeader />

        <main id="main-content">
          {/* Hero Section with Kinetic Core */}
          <HeroSection />

          {/* Interactive Live Concierge Simulator */}
          <LiveConciergeSimulator />

          {/* Six Architectural Pillars */}
          <ArchitecturalPillars />

          {/* Transaction & Concurrency Pipeline Diagram */}
          <KineticPipelineDiagram />

          {/* Social Proof & Sanctuaries */}
          <SanctuarySocialProof />

          {/* Technical & Operational FAQ */}
          <FaqSection />

          {/* Final Call to Action Banner */}
          <CtaBanner />
        </main>

        {/* Haute Wellness Footer */}
        <LandingFooter />
      </div>
    </SmoothScrollProvider>
  );
}

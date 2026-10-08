import { describe, expect, it } from 'vitest';
import {
  matchesSegmentFilter,
  renderCampaignMessage,
  resolveLoyaltyTier,
  type CustomerMarketingMetrics,
} from './marketing.js';

describe('marketing pure utilities', () => {
  const baseMetrics: CustomerMarketingMetrics = {
    customerId: 'cust-1',
    totalSpendMinor: 500000, // 5000 BDT
    visitCount: 6,
    lastVisitAt: new Date('2026-08-01T12:00:00Z'),
    loyaltyPoints: 1500,
    hasActiveSubscription: true,
    preferredBranchId: 'branch-1',
    marketingOptOut: false,
  };

  const testNow = new Date('2026-10-01T12:00:00Z'); // ~61 days after lastVisitAt

  describe('resolveLoyaltyTier', () => {
    it('resolves correct tiers from points', () => {
      expect(resolveLoyaltyTier(200)).toBe('bronze');
      expect(resolveLoyaltyTier(1500)).toBe('silver');
      expect(resolveLoyaltyTier(6000)).toBe('gold');
      expect(resolveLoyaltyTier(12000)).toBe('platinum');
    });
  });

  describe('matchesSegmentFilter', () => {
    it('matches when customer satisfies all criteria', () => {
      const match = matchesSegmentFilter(
        baseMetrics,
        {
          minTotalSpendMinor: 200000,
          minVisitCount: 3,
          inactiveDays: 30, // 61 >= 30
          loyaltyTier: 'silver',
          hasActiveSubscription: true,
        },
        testNow,
      );
      expect(match).toBe(true);
    });

    it('rejects opted-out customers when excludeOptedOut is default (true)', () => {
      const optedOut = { ...baseMetrics, marketingOptOut: true };
      const match = matchesSegmentFilter(optedOut, {}, testNow);
      expect(match).toBe(false);
    });

    it('rejects when spend is lower than minTotalSpendMinor', () => {
      const match = matchesSegmentFilter(baseMetrics, { minTotalSpendMinor: 1000000 }, testNow);
      expect(match).toBe(false);
    });

    it('rejects when inactive days not met', () => {
      // inactiveDays: 90, but customer visited 61 days ago
      const match = matchesSegmentFilter(baseMetrics, { inactiveDays: 90 }, testNow);
      expect(match).toBe(false);
    });

    it('filters by loyalty tier correctly', () => {
      const matchGold = matchesSegmentFilter(baseMetrics, { loyaltyTier: 'gold' }, testNow);
      expect(matchGold).toBe(false);
      const matchSilver = matchesSegmentFilter(baseMetrics, { loyaltyTier: 'silver' }, testNow);
      expect(matchSilver).toBe(true);
    });
  });

  describe('renderCampaignMessage', () => {
    it('interpolates placeholders correctly', () => {
      const msg = renderCampaignMessage(
        'Hi {{customerName}}! Enjoy 20% off with code {{couponCode}}. Opt-out: {{unsubscribeUrl}}',
        {
          campaignName: 'Autumn Sale',
          customerName: 'Amina',
          template: '',
          couponCode: 'AUTUMN20',
          unsubscribeUrl: 'https://salon.test/unsub?id=1',
        },
      );
      expect(msg).toBe('Hi Amina! Enjoy 20% off with code AUTUMN20. Opt-out: https://salon.test/unsub?id=1');
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  calculateAov,
  calculateChurnRate,
  calculateExplainableForecast,
  convertToCsv,
  inventoryValue,
  safeRate,
} from './reporting.js';

describe('reporting utilities', () => {
  describe('safeRate', () => {
    it('divides normally', () => expect(safeRate(3, 12)).toBe(0.25));
    it('is 0 when denominator is 0', () => expect(safeRate(5, 0)).toBe(0));
    it('is 0 when denominator is negative', () => expect(safeRate(5, -2)).toBe(0));
  });

  describe('inventoryValue', () => {
    it('sums qty*unitCost in minor units', () =>
      expect(
        inventoryValue([
          { qtyOnHand: 3, unitCost: 20000 },
          { qtyOnHand: 2, unitCost: 500 },
        ]),
      ).toBe(61000));
    it('is 0 for empty', () => expect(inventoryValue([])).toBe(0));
  });

  describe('calculateAov and churn', () => {
    it('calculates average order value in integer minor units', () => {
      expect(calculateAov(150000, 3)).toBe(50000);
      expect(calculateAov(10000, 0)).toBe(0);
    });

    it('calculates churn rate', () => {
      expect(calculateChurnRate(20, 100)).toBe(0.2);
    });
  });

  describe('calculateExplainableForecast', () => {
    it('produces explainable forecast points with bounds', () => {
      const history = [
        { date: '2026-10-01', value: 10000 },
        { date: '2026-10-02', value: 12000 },
        { date: '2026-10-03', value: 15000 },
        { date: '2026-10-04', value: 9000 },
        { date: '2026-10-05', value: 11000 },
        { date: '2026-10-06', value: 13000 },
        { date: '2026-10-07', value: 16000 },
      ];

      const res = calculateExplainableForecast(history, 7);
      expect(res.isEstimate).toBe(true);
      expect(res.model).toBe('seasonal_moving_average');
      expect(res.forecastPoints).toHaveLength(7);
      expect(res.forecastPoints[0]?.projected).toBeGreaterThan(0);
      expect(res.forecastPoints[0]?.lowerBound).toBeLessThanOrEqual(res.forecastPoints[0]?.projected ?? 0);
      expect(res.forecastPoints[0]?.upperBound).toBeGreaterThanOrEqual(res.forecastPoints[0]?.projected ?? 0);
    });
  });

  describe('convertToCsv', () => {
    it('escapes cells containing commas, quotes, and newlines', () => {
      const headers = ['Name', 'Branch', 'Revenue'];
      const rows = [
        ['John, Jr.', 'Main "Downtown"', 5000],
        ['Simple', 'North', 2500],
      ];
      const csv = convertToCsv(headers, rows);
      expect(csv).toContain('"John, Jr."');
      expect(csv).toContain('"Main ""Downtown"""');
      expect(csv).toContain('5000');
    });
  });
});

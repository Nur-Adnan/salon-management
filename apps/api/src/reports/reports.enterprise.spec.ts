import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { ExportService } from './export.service.js';
import { ForecastingService } from './forecasting.service.js';
import { RollupService } from './rollup.service.js';

describe('Phase 11 Enterprise Analytics & Rollups', () => {
  describe('RollupService', () => {
    let service: RollupService;
    let mockRollups: any;
    let mockSales: any;
    let mockAppointments: any;
    let mockCustomers: any;
    let mockEarnings: any;
    let mockStock: any;
    let mockBranches: any;

    beforeEach(() => {
      mockRollups = {
        find: vi.fn(),
        findOneAndUpdate: vi.fn(),
      };
      mockSales = {
        aggregate: vi.fn(),
        distinct: vi.fn(),
      };
      mockAppointments = { aggregate: vi.fn() };
      mockCustomers = { countDocuments: vi.fn() };
      mockEarnings = {};
      mockStock = { aggregate: vi.fn() };
      mockBranches = { find: vi.fn(), findOne: vi.fn() };

      service = new RollupService(
        mockRollups,
        mockSales,
        mockAppointments,
        mockCustomers,
        mockEarnings as any,
        mockStock,
        mockBranches,
      );
    });

    it('generates a branch daily rollup with revenue, AOV, and appointments', async () => {
      const tenantId = new Types.ObjectId();
      const branchId = new Types.ObjectId();

      mockBranches.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: branchId, timezone: 'Asia/Dhaka' }),
      });

      mockSales.aggregate.mockResolvedValue([
        {
          gross: 120000,
          discounts: 10000,
          net: 110000,
          tax: 5000,
          tips: 2000,
          salesCount: 2,
          customerIds: [new Types.ObjectId(), new Types.ObjectId()],
        },
      ]);

      mockAppointments.aggregate.mockResolvedValue([
        { _id: 'completed', count: 2 },
        { _id: 'cancelled', count: 1 },
      ]);

      mockCustomers.countDocuments.mockResolvedValue(1);
      mockStock.aggregate.mockResolvedValue([{ totalQty: 50, lowStock: 2 }]);

      const expectedDoc = {
        tenantId,
        branchId,
        date: '2026-10-10',
        revenue: { net: 110000, salesCount: 2, averageOrderValue: 55000 },
      };
      mockRollups.findOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(expectedDoc),
      });

      const res = await service.generateDailyRollup(tenantId, '2026-10-10', branchId);
      expect(res).toBe(expectedDoc);
      expect(mockRollups.findOneAndUpdate).toHaveBeenCalledWith(
        { tenantId, branchId, date: '2026-10-10' },
        expect.objectContaining({
          $set: expect.objectContaining({
            revenue: expect.objectContaining({ net: 110000, salesCount: 2, averageOrderValue: 55000 }),
            appointments: expect.objectContaining({ total: 3, completed: 2, cancelled: 1 }),
          }),
        }),
        { upsert: true, new: true },
      );
    });

    it('retrieves dashboard summary from materialized rollups', async () => {
      const tenantId = new Types.ObjectId();
      const branchId = new Types.ObjectId();

      const rollupsList = [
        {
          date: '2026-10-01',
          revenue: { net: 50000, salesCount: 1 },
          appointments: { total: 2, completed: 1, cancelled: 1, noShows: 0 },
        },
        {
          date: '2026-10-02',
          revenue: { net: 100000, salesCount: 2 },
          appointments: { total: 3, completed: 3, cancelled: 0, noShows: 0 },
        },
      ];

      mockRollups.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(rollupsList),
        }),
      });

      const summary = await service.getDashboardSummary(tenantId, '2026-10-01', '2026-10-02', branchId);
      expect(summary.totalRevenue).toBe(150000);
      expect(summary.totalSales).toBe(3);
      expect(summary.averageOrderValue).toBe(50000);
      expect(summary.appointments.total).toBe(5);
      expect(summary.appointments.completed).toBe(4);
      expect(summary.appointments.completionRate).toBe(0.8);
    });

    it('calculates churn metrics accurately', async () => {
      const tenantId = new Types.ObjectId();
      mockCustomers.countDocuments.mockResolvedValue(100);
      mockSales.distinct.mockResolvedValue(['cust-1', 'cust-2', 'cust-3']); // 3 active

      const churn = await service.getChurnMetrics(tenantId, 60);
      expect(churn.totalCustomers).toBe(100);
      expect(churn.activeCount).toBe(3);
      expect(churn.inactiveCount).toBe(97);
      expect(churn.churnRate).toBe(0.97);
    });
  });

  describe('ForecastingService', () => {
    it('produces explainable forecast from historical rollups', async () => {
      const mockRollups = {
        find: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              exec: vi.fn().mockResolvedValue([
                { date: '2026-10-01', revenue: { net: 10000 }, appointments: { total: 2 } },
                { date: '2026-10-02', revenue: { net: 20000 }, appointments: { total: 4 } },
                { date: '2026-10-03', revenue: { net: 15000 }, appointments: { total: 3 } },
              ]),
            }),
          }),
        }),
      };

      const forecaster = new ForecastingService(mockRollups as any);
      const res = await forecaster.getForecast(new Types.ObjectId(), 'sales', 7);

      expect(res.isEstimate).toBe(true);
      expect(res.model).toBe('seasonal_moving_average');
      expect(res.forecastPoints).toHaveLength(7);
      expect(res.historicalDays).toBe(3);
    });
  });

  describe('ExportService', () => {
    const exportService = new ExportService();

    it('exports sales report to CSV format', () => {
      const data = {
        buckets: [
          { bucket: '2026-10-01', gross: 10000, discounts: 500, tax: 500, tips: 1000, total: 11000, count: 2 },
        ],
      };
      const result = exportService.exportReport('sales', data, 'csv');
      expect(result.mimeType).toBe('text/csv');
      expect(result.content).toContain('Date / Bucket');
      expect(result.content).toContain('2026-10-01');
      expect(result.content).toContain('11000');
    });

    it('exports staff performance to Excel format', () => {
      const data = [
        { staffId: 'staff-1', netAttributed: 50000, commission: 5000, tips: 1000, hoursWorked: 8, saleCount: 4 },
      ];
      const result = exportService.exportReport('staff', data, 'excel');
      expect(result.mimeType).toBe('application/vnd.ms-excel');
      expect(result.content).toContain('Staff ID');
      expect(result.content).toContain('staff-1');
      expect(result.content).toContain('50000');
    });
  });
});

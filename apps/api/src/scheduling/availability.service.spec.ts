import { describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { AvailabilityService } from './availability.service.js';

describe('AvailabilityService (Stage B Refinements)', () => {
  const tenantId = new Types.ObjectId();
  const branchId = new Types.ObjectId();
  const staffId = new Types.ObjectId().toHexString();
  const serviceId = new Types.ObjectId().toHexString();
  const date = '2026-05-10'; // Sunday

  const mockContext = {
    get: () => ({ tenantId: tenantId.toHexString(), branchId: branchId.toHexString() }),
  };

  const mockBranch = {
    _id: branchId,
    tenantId,
    timezone: 'Asia/Dhaka',
    slotMinutes: 30,
    workingHours: [
      { closed: false, open: '09:00', close: '18:00' }, // 0: Sun
    ],
  };

  const mockService = {
    _id: new Types.ObjectId(serviceId),
    tenantId,
    durationMin: 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    eligibleStaffIds: [], // eligible for all staff by default
  };

  it('excludes staff who are on approved leave', async () => {
    const branchesModel = {
      findOne: () => ({ exec: () => Promise.resolve(mockBranch) }),
    };
    const servicesModel = {
      findOne: () => ({ exec: () => Promise.resolve(mockService) }),
    };
    const leavesModel = {
      findOne: () => ({
        exec: () =>
          Promise.resolve({
            staffId: new Types.ObjectId(staffId),
            startDate: '2026-05-01',
            endDate: '2026-05-15',
            status: 'approved',
          }),
      }),
    };
    const shiftsModel = {
      findOne: () => ({ exec: () => Promise.resolve(null) }),
    };
    const reservationsModel = {
      find: () => ({ exec: () => Promise.resolve([]) }),
    };

    const service = new AvailabilityService(
      reservationsModel as never,
      branchesModel as never,
      servicesModel as never,
      shiftsModel as never,
      leavesModel as never,
      mockContext as never,
    );

    const slots = await service.staffAvailability(staffId, serviceId, date);
    expect(slots).toEqual([]);
  });

  it('excludes staff who are not eligible for the service', async () => {
    const branchesModel = {
      findOne: () => ({ exec: () => Promise.resolve(mockBranch) }),
    };
    const otherStaffId = new Types.ObjectId();
    const servicesModel = {
      findOne: () => ({
        exec: () =>
          Promise.resolve({
            ...mockService,
            eligibleStaffIds: [otherStaffId], // staffId is not in this list
          }),
      }),
    };
    const leavesModel = {
      findOne: () => ({ exec: () => Promise.resolve(null) }),
    };
    const shiftsModel = {
      findOne: () => ({ exec: () => Promise.resolve(null) }),
    };
    const reservationsModel = {
      find: () => ({ exec: () => Promise.resolve([]) }),
    };

    const service = new AvailabilityService(
      reservationsModel as never,
      branchesModel as never,
      servicesModel as never,
      shiftsModel as never,
      leavesModel as never,
      mockContext as never,
    );

    const slots = await service.staffAvailability(staffId, serviceId, date);
    expect(slots).toEqual([]);
  });

  it('respects staff break times by omitting overlapping slots', async () => {
    const branchesModel = {
      findOne: () => ({ exec: () => Promise.resolve(mockBranch) }),
    };
    const servicesModel = {
      findOne: () => ({ exec: () => Promise.resolve(mockService) }),
    };
    const leavesModel = {
      findOne: () => ({ exec: () => Promise.resolve(null) }),
    };
    const shiftsModel = {
      findOne: () => ({
        exec: () =>
          Promise.resolve({
            staffId: new Types.ObjectId(staffId),
            branchId,
            dayOfWeek: 0,
            open: '09:00',
            close: '18:00',
            breaks: [{ start: '13:00', end: '14:00', description: 'Lunch' }],
            isOff: false,
          }),
      }),
    };
    const reservationsModel = {
      find: () => ({ exec: () => Promise.resolve([]) }),
    };

    const service = new AvailabilityService(
      reservationsModel as never,
      branchesModel as never,
      servicesModel as never,
      shiftsModel as never,
      leavesModel as never,
      mockContext as never,
    );

    // Freeze date to past so slots in May 2026 are not filtered by Date.now()
    vi.setSystemTime(new Date('2026-05-01T00:00:00Z'));

    const slots = await service.staffAvailability(staffId, serviceId, date);
    expect(slots.length).toBeGreaterThan(0);

    // 13:00 to 14:00 is lunch break in Asia/Dhaka (+06:00).
    // A 60-minute service starting at 13:00 (+06:00) = 07:00 UTC would overlap lunch.
    // Ensure no slot starts at 07:00 UTC or 07:30 UTC
    const lunchStartIso = new Date('2026-05-10T13:00:00+06:00').toISOString();
    const lunchMidIso = new Date('2026-05-10T13:30:00+06:00').toISOString();
    expect(slots).not.toContain(lunchStartIso);
    expect(slots).not.toContain(lunchMidIso);

    vi.useRealTimers();
  });
});

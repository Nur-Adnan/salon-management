import type { AppointmentDocument } from './schemas/appointment.schema.js';
import type { WaitlistEntryDocument } from './schemas/waitlist.schema.js';

export const serializeAppointment = (a: AppointmentDocument) => ({
  id: String(a._id),
  branchId: String(a.branchId),
  customerId: String(a.customerId),
  status: a.status,
  source: a.source,
  depositAmount: {
    amount: a.depositAmount?.amount ?? 0,
    currency: a.depositAmount?.currency ?? 'BDT',
  },
  notes: a.notes ?? null,
  lines: a.lines.map((l) => ({
    serviceId: String(l.serviceId),
    staffId: String(l.staffId),
    resourceId: l.resourceId ? String(l.resourceId) : null,
    start: l.start.toISOString(),
    end: l.end.toISOString(),
  })),
});

export const serializeWaitlist = (w: WaitlistEntryDocument) => ({
  id: String(w._id),
  customerId: String(w.customerId),
  serviceId: w.serviceId ? String(w.serviceId) : null,
  staffId: w.staffId ? String(w.staffId) : null,
  desiredDate: w.desiredDate ?? null,
  note: w.note ?? null,
  status: w.status,
});

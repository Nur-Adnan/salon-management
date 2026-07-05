import { ROLES } from '@salon/shared';
import { Button } from '@salon/ui';
import { apiFetch } from '@/lib/api';
import { inviteMember, setCompensation } from '../actions';

interface Membership {
  id: string;
  userId: string | null;
  invitedEmail: string | null;
  branchId: string | null;
  role: string;
  status: string;
}

interface Compensation {
  commissionRateBps: number;
  baseSalaryMinor: number;
  hourlyRateMinor: number;
}

const inputCls =
  'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';
const bdt = (poisha: number) => (poisha / 100).toFixed(2);

export default async function TeamPage() {
  const res = await apiFetch<Membership[]>('/invitations');
  if (res.status === 403) {
    return <p className="opacity-70">You do not have permission to manage team members.</p>;
  }
  const members = res.data ?? [];

  // Compensation only applies to members who've actually joined (a userId,
  // status: active) — an invite has no employment record to attach a rate to
  // yet. Fetched per-member since /staff/:id/compensation is a per-user read.
  const active = members.filter((m): m is Membership & { userId: string } => Boolean(m.userId) && m.status === 'active');
  const compResults = await Promise.all(
    active.map((m) => apiFetch<Compensation>(`/staff/${m.userId}/compensation`)),
  );
  const compByUserId = new Map(active.map((m, i) => [m.userId, compResults[i]?.data ?? null]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Team</h1>
      <ul className="flex flex-col gap-2 text-sm">
        {members.map((m) => {
          const comp = m.userId ? compByUserId.get(m.userId) : undefined;
          return (
            <li key={m.id} className="flex flex-col gap-1 border-b border-default-100 pb-2">
              <div>
                {m.invitedEmail ?? m.userId} · <span className="text-brand">{m.role}</span> ·{' '}
                <span className="opacity-50">{m.status}</span>
              </div>
              {m.userId && m.status === 'active' ? (
                <form
                  action={setCompensation.bind(null, m.userId)}
                  className="flex flex-wrap items-center gap-2 text-xs opacity-80"
                >
                  <span className="opacity-60">Commission</span>
                  <input
                    name="commissionPercent"
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    defaultValue={comp ? comp.commissionRateBps / 100 : 0}
                    className={`${inputCls} w-20`}
                  />
                  <span className="opacity-60">% · Base salary</span>
                  <input
                    name="baseSalaryBdt"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={comp ? bdt(comp.baseSalaryMinor) : '0'}
                    className={`${inputCls} w-24`}
                  />
                  <span className="opacity-60">৳ · Hourly</span>
                  <input
                    name="hourlyRateBdt"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={comp ? bdt(comp.hourlyRateMinor) : '0'}
                    className={`${inputCls} w-24`}
                  />
                  <span className="opacity-60">৳/hr</span>
                  <Button type="submit">Save</Button>
                </form>
              ) : null}
            </li>
          );
        })}
        {members.length === 0 ? <li className="opacity-50">No members yet.</li> : null}
      </ul>

      <form action={inviteMember} className="flex max-w-md flex-wrap gap-2">
        <input
          name="email"
          type="email"
          placeholder="invitee@email.com"
          className={inputCls}
          required
        />
        <select name="role" className={inputCls} defaultValue="stylist">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input name="branchId" placeholder="branch id (optional)" className={inputCls} />
        <Button type="submit">Invite</Button>
      </form>
    </div>
  );
}

import { ROLES } from '@salon/shared';
import { Button } from '@salon/ui';
import { apiFetch } from '@/lib/api';
import { inviteMember } from '../actions';

interface Membership {
  id: string;
  userId: string | null;
  invitedEmail: string | null;
  branchId: string | null;
  role: string;
  status: string;
}

const inputCls =
  'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';

export default async function TeamPage() {
  const res = await apiFetch<Membership[]>('/invitations');
  if (res.status === 403) {
    return <p className="opacity-70">You do not have permission to manage team members.</p>;
  }
  const members = res.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Team</h1>
      <ul className="text-sm">
        {members.map((m) => (
          <li key={m.id}>
            {m.invitedEmail ?? m.userId} · <span className="text-brand">{m.role}</span> ·{' '}
            <span className="opacity-50">{m.status}</span>
          </li>
        ))}
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

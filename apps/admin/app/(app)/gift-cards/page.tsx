import { Button } from '@salon/ui';
import { apiFetch } from '@/lib/api';
import { cancelGiftCard, issueGiftCard } from './actions';

interface GiftCard {
  id: string;
  code: string;
  initialAmount: { amount: number };
  balance: { amount: number };
  status: string;
  expiresAt: string | null;
}

const box = 'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';
const bdt = (poisha: number) => `৳${(poisha / 100).toFixed(2)}`;

export default async function GiftCardsPage() {
  const res = await apiFetch<GiftCard[]>('/gift-cards');
  if (res.status === 403) return <p className="opacity-70">Select a workspace above to manage gift cards.</p>;
  const cards = res.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Gift cards</h1>

      <ul className="flex flex-col gap-1 text-sm">
        {cards.map((c) => (
          <li key={c.id} className="flex items-center gap-3 font-mono">
            <span>{c.code}</span>
            <span className="opacity-60">{bdt(c.balance.amount)} / {bdt(c.initialAmount.amount)}</span>
            <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs">{c.status}</span>
            {c.status === 'active' ? (
              <form action={cancelGiftCard.bind(null, c.id)}>
                <button type="submit" className="text-xs text-danger opacity-60 hover:opacity-100">
                  cancel
                </button>
              </form>
            ) : null}
          </li>
        ))}
        {cards.length === 0 ? <li className="opacity-50">No gift cards issued yet.</li> : null}
      </ul>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Issue a gift card</h2>
        <form action={issueGiftCard} className="flex max-w-sm gap-2">
          <input name="amount" type="number" min={1} step="0.01" placeholder="Amount (BDT)" className={box} required />
          <Button type="submit">Issue</Button>
        </form>
      </section>
    </div>
  );
}

import { Button } from '@salon/ui';
import { apiFetch } from '@/lib/api';
import {
  addTreatmentPhoto,
  adjustLoyalty,
  cancelSubscription,
  createReferral,
  createTreatmentRecord,
  issueGiftCard,
  renewSubscription,
  setPhotoConsent,
  subscribeCustomer,
  updateProfile,
} from '../actions';

interface Money {
  amount: number;
}
interface Named {
  en: string;
  bn: string | null;
}
interface Consent {
  status: string;
  scope: string[];
  method: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
}
interface Photo {
  id: string;
  url: string;
  type: string;
  consent: Consent;
}
interface Treatment {
  id: string;
  colorFormula: string | null;
  notes: string | null;
  allergies: string[];
  photos: Photo[];
  createdAt: string | null;
}
interface Appt {
  id: string;
  status: string;
  lines: { start: string }[];
}
interface Sale {
  id: string;
  invoiceNumber: string;
  total: Money;
  paymentStatus: string;
  status: string;
  createdAt: string | null;
}
interface GiftCard {
  id: string;
  code: string;
  balance: Money;
  status: string;
}
interface Subscription {
  id: string;
  planId: string;
  status: string;
  billingState: string;
  nextBillingDate: string;
}
interface Referral {
  id: string;
  referredCustomerId: string;
  status: string;
  rewardPoints: number;
}
interface Profile {
  customer: { id: string; name: string; phone: string; email: string | null; preferenceNotes: string | null; allergies: string[]; referralCode: string | null };
  dueBalance: number;
  loyaltyBalance: number;
  appointments: Appt[];
  sales: Sale[];
  treatments: Treatment[];
  giftCards: GiftCard[];
  subscriptions: Subscription[];
  referralsMade: Referral[];
}
interface Plan {
  id: string;
  name: Named;
  price: Money;
  billingPeriodDays: number;
}

const box = 'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';
const bdt = (poisha: number) => `৳${(poisha / 100).toFixed(2)}`;
const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await apiFetch<Profile>(`/customers/${id}/profile`);
  if (res.status === 403) return <p className="opacity-70">Select a workspace above.</p>;
  if (!res.data) return <p className="opacity-70">Customer not found.</p>;
  const p = res.data;
  const plans = (await apiFetch<Plan[]>('/subscription-plans')).data ?? [];

  const updateProfileBound = updateProfile.bind(null, id);
  const createTreatmentRecordBound = createTreatmentRecord.bind(null, id);
  const adjustLoyaltyBound = adjustLoyalty.bind(null, id);
  const issueGiftCardBound = issueGiftCard.bind(null, id);
  const subscribeBound = subscribeCustomer.bind(null, id);
  const referralBound = createReferral.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-bold">{p.customer.name}</h1>
        <p className="text-sm opacity-60">
          {p.customer.phone} {p.customer.email ? `· ${p.customer.email}` : ''}
        </p>
      </header>

      <div className="flex flex-wrap gap-6 rounded-large border border-default-200 p-4 text-sm">
        <Stat label="Loyalty points" value={String(p.loyaltyBalance)} />
        <Stat label="Due balance" value={bdt(p.dueBalance)} strong={p.dueBalance > 0} />
        <Stat label="Referral code" value={p.customer.referralCode ?? '— none yet —'} />
        <Stat label="Allergies" value={p.customer.allergies.join(', ') || '— none —'} />
      </div>

      {/* Preferences */}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Preferences</h2>
        <form action={updateProfileBound} className="flex max-w-2xl flex-wrap gap-2">
          <input name="preferenceNotes" defaultValue={p.customer.preferenceNotes ?? ''} placeholder="Preference notes" className={`${box} flex-1`} />
          <input name="allergies" defaultValue={p.customer.allergies.join(', ')} placeholder="Allergies, comma separated" className={`${box} flex-1`} />
          <Button type="submit">Save</Button>
        </form>
      </section>

      {/* Loyalty */}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Loyalty ({p.loyaltyBalance} pts)</h2>
        <form action={adjustLoyaltyBound} className="flex max-w-lg gap-2">
          <input name="points" type="number" placeholder="± points" className={`${box} w-28`} required />
          <input name="note" placeholder="reason" className={`${box} flex-1`} />
          <Button type="submit">Adjust</Button>
        </form>
      </section>

      {/* Referral */}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Refer a friend</h2>
        <form action={referralBound} className="flex max-w-lg gap-2">
          <input name="referrerCode" placeholder="Referrer's code (R-XXXXXXXX)" className={`${box} flex-1`} required />
          <Button type="submit">Record referral</Button>
        </form>
        {p.referralsMade.length > 0 ? (
          <ul className="text-sm opacity-70">
            {p.referralsMade.map((r) => (
              <li key={r.id}>
                referred a customer · {r.status} {r.status === 'rewarded' ? `(+${r.rewardPoints} pts)` : ''}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Gift cards */}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Gift cards</h2>
        <ul className="text-sm">
          {p.giftCards.map((g) => (
            <li key={g.id} className="font-mono">
              {g.code} · {bdt(g.balance.amount)} · {g.status}
            </li>
          ))}
          {p.giftCards.length === 0 ? <li className="opacity-50">None issued to this customer.</li> : null}
        </ul>
        <form action={issueGiftCardBound} className="flex max-w-sm gap-2">
          <input name="amount" type="number" min={1} step="0.01" placeholder="Amount (BDT)" className={box} required />
          <Button type="submit">Issue gift card</Button>
        </form>
      </section>

      {/* Subscriptions */}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Subscriptions</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {p.subscriptions.map((sub) => {
            const plan = plans.find((pl) => pl.id === sub.planId);
            const renewBound = renewSubscription.bind(null, id, sub.id);
            const cancelBound = cancelSubscription.bind(null, id, sub.id);
            return (
              <li key={sub.id} className="flex flex-wrap items-center gap-2 border-b border-default-100 pb-2">
                <span className="font-medium">{plan?.name.en ?? 'plan'}</span>
                <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs">{sub.status}</span>
                <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs">{sub.billingState}</span>
                <span className="opacity-50 text-xs">next: {dt(sub.nextBillingDate)}</span>
                {sub.status === 'active' ? (
                  <>
                    <form action={renewBound} className="flex gap-1">
                      <input name="amount" type="number" step="0.01" placeholder={plan ? (plan.price.amount / 100).toFixed(2) : '0.00'} className={`${box} w-24`} />
                      <select name="method" className={box} defaultValue="cash">
                        <option value="cash">cash</option>
                        <option value="card">card</option>
                        <option value="bkash">bkash</option>
                        <option value="nagad">nagad</option>
                        <option value="due">due</option>
                      </select>
                      <Button type="submit">Renew</Button>
                    </form>
                    <form action={cancelBound}>
                      <button type="submit" className="text-xs text-danger opacity-60 hover:opacity-100">
                        cancel
                      </button>
                    </form>
                  </>
                ) : null}
              </li>
            );
          })}
          {p.subscriptions.length === 0 ? <li className="opacity-50">No subscriptions.</li> : null}
        </ul>
        <form action={subscribeBound} className="flex max-w-lg gap-2">
          <select name="planId" className={box} required>
            <option value="">— choose a plan —</option>
            {plans.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.name.en} · {bdt(pl.price.amount)} / {pl.billingPeriodDays}d
              </option>
            ))}
          </select>
          <Button type="submit">Subscribe</Button>
        </form>
      </section>

      {/* Treatment records */}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Treatment records</h2>
        {p.treatments.map((t) => {
          const addPhotoBound = addTreatmentPhoto.bind(null, id, t.id);
          return (
            <div key={t.id} className="flex flex-col gap-2 rounded-large border border-default-200 p-3 text-sm">
              <div className="flex flex-wrap gap-3">
                <span className="opacity-50">{dt(t.createdAt)}</span>
                {t.colorFormula ? <span>formula: {t.colorFormula}</span> : null}
                {t.allergies.length > 0 ? <span className="text-danger">allergies: {t.allergies.join(', ')}</span> : null}
              </div>
              {t.notes ? <p className="opacity-70">{t.notes}</p> : null}

              <div className="flex flex-wrap gap-2">
                {t.photos.map((photo) => (
                  <div key={photo.id} className="flex flex-col gap-1 rounded-medium border border-default-200 p-2">
                    <span className="text-xs opacity-50">
                      {photo.type} · consent: {photo.consent.status}
                      {photo.consent.scope.length > 0 ? ` (${photo.consent.scope.join(', ')})` : ''}
                    </span>
                    <div className="flex gap-1">
                      {photo.consent.status === 'pending' ? (
                        <>
                          <ConsentButton customerId={id} recordId={t.id} photoId={photo.id} action="grant" scope={['clinical_record']} label="grant (chart)" />
                          <ConsentButton customerId={id} recordId={t.id} photoId={photo.id} action="grant" scope={['clinical_record', 'marketing']} label="grant (+marketing)" />
                          <ConsentButton customerId={id} recordId={t.id} photoId={photo.id} action="decline" label="decline" />
                        </>
                      ) : null}
                      {photo.consent.status === 'granted' ? (
                        <ConsentButton customerId={id} recordId={t.id} photoId={photo.id} action="revoke" label="revoke" />
                      ) : null}
                      {(photo.consent.status === 'declined' || photo.consent.status === 'revoked') ? (
                        <ConsentButton customerId={id} recordId={t.id} photoId={photo.id} action="grant" scope={['clinical_record']} label="re-grant" />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <form action={addPhotoBound} className="flex gap-2">
                <input name="url" placeholder="photo URL" className={`${box} flex-1`} required />
                <select name="type" className={box} defaultValue="before">
                  <option value="before">before</option>
                  <option value="after">after</option>
                </select>
                <Button type="submit">Add photo</Button>
              </form>
            </div>
          );
        })}
        <form action={createTreatmentRecordBound} className="flex flex-wrap gap-2">
          <input name="colorFormula" placeholder="Color formula" className={box} />
          <input name="notes" placeholder="Notes" className={`${box} flex-1`} />
          <input name="allergies" placeholder="Allergies, comma separated" className={box} />
          <Button type="submit">Log treatment</Button>
        </form>
      </section>

      {/* Timeline */}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Timeline</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium opacity-70">Appointments</h3>
            <ul className="text-sm">
              {p.appointments.map((a) => (
                <li key={a.id}>
                  {dt(a.lines[0]?.start ?? null)} · {a.status}
                </li>
              ))}
              {p.appointments.length === 0 ? <li className="opacity-50">None yet.</li> : null}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium opacity-70">Sales</h3>
            <ul className="text-sm">
              {p.sales.map((sale) => (
                <li key={sale.id} className="font-mono">
                  {sale.invoiceNumber} · {bdt(sale.total.amount)} · {sale.status === 'voided' ? 'voided' : sale.paymentStatus}
                </li>
              ))}
              {p.sales.length === 0 ? <li className="opacity-50">None yet.</li> : null}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase opacity-50">{label}</span>
      <span className={strong ? 'font-bold text-danger' : 'font-medium'}>{value}</span>
    </div>
  );
}

function ConsentButton({
  customerId,
  recordId,
  photoId,
  action,
  scope,
  label,
}: {
  customerId: string;
  recordId: string;
  photoId: string;
  action: 'grant' | 'decline' | 'revoke';
  scope?: string[];
  label: string;
}) {
  const bound = setPhotoConsent.bind(null, customerId, recordId, photoId, action, scope);
  return (
    <form action={bound}>
      <button type="submit" className="rounded border border-default-300 px-1.5 py-0.5 text-xs hover:border-brand">
        {label}
      </button>
    </form>
  );
}

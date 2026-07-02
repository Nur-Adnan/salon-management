'use client';

import { PAYMENT_METHODS, lineTotals, money, saleTotals } from '@salon/shared';
import { Button } from '@salon/ui';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { type BarcodeProduct, type CheckoutPayment, checkout, lookupBarcode } from './actions';

interface CatalogItem {
  kind: 'service' | 'product' | 'package';
  id: string;
  label: string;
  unitPrice: number; // poisha
  taxable: boolean;
}
interface Opt {
  id: string;
  name: string;
}
interface CartLine {
  key: string;
  kind: 'service' | 'product' | 'package';
  refId: string;
  label: string;
  unitPrice: number;
  taxable: boolean;
  quantity: number;
  discount: number; // poisha
  staffId: string;
}
interface SaleView {
  invoiceNumber: string;
  total: { amount: number };
  paymentStatus: string;
}

const box =
  'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';
const bdt = (poisha: number) => `৳${(poisha / 100).toFixed(2)}`;
const toPoisha = (taka: string) => Math.round((Number(taka) || 0) * 100);

let seq = 0;
const nextKey = () => `l${seq++}`;

export function PosScreen({
  catalog,
  staff,
  customers,
  vatRateBps,
}: {
  catalog: CatalogItem[];
  staff: Opt[];
  customers: Opt[];
  vatRateBps: number;
}) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pick, setPick] = useState(catalog[0]?.id ?? '');
  const [barcode, setBarcode] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [tipTaka, setTipTaka] = useState('0');
  const [couponCode, setCouponCode] = useState('');
  const [payments, setPayments] = useState<CheckoutPayment[]>([]);
  const [payMethod, setPayMethod] = useState('cash');
  const [payTaka, setPayTaka] = useState('');
  const [payGiftCardCode, setPayGiftCardCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<SaleView | null>(null);

  const tip = toPoisha(tipTaka);

  const totals = useMemo(() => {
    const lines = cart.map((c) => ({
      unitPrice: money(c.unitPrice),
      quantity: c.quantity,
      discount: money(c.discount),
      taxable: c.taxable,
      taxRateBps: vatRateBps,
    }));
    return saleTotals(lines, money(tip));
  }, [cart, tip, vatRateBps]);

  const paid = payments.reduce((n, p) => n + p.amount, 0);
  const remaining = Math.max(0, totals.total.amount - paid);

  function addFromPick() {
    const item = catalog.find((c) => c.id === pick);
    if (!item) return;
    addItem(item);
  }
  function addItem(item: CatalogItem) {
    setCart((c) => [
      ...c,
      {
        key: nextKey(),
        kind: item.kind,
        refId: item.id,
        label: item.label,
        unitPrice: item.unitPrice,
        taxable: item.taxable,
        quantity: 1,
        discount: 0,
        staffId: '',
      },
    ]);
  }
  async function scan() {
    setMsg(null);
    const p: BarcodeProduct | null = await lookupBarcode(barcode);
    if (!p) {
      setMsg(`no product for barcode "${barcode}"`);
      return;
    }
    addItem({
      kind: 'product',
      id: p.id,
      label: p.name.en,
      unitPrice: p.retailPrice.amount,
      taxable: p.taxable,
    });
    setBarcode('');
  }
  function patch(key: string, patch: Partial<CartLine>) {
    setCart((c) => c.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function remove(key: string) {
    setCart((c) => c.filter((l) => l.key !== key));
  }
  function addPayment() {
    const amount = payTaka ? toPoisha(payTaka) : remaining;
    if (amount <= 0) return;
    if (payMethod === 'gift_card' && !payGiftCardCode.trim()) {
      setMsg('enter the gift card code');
      return;
    }
    setPayments((p) => [
      ...p,
      { method: payMethod, amount, providerRef: payMethod === 'gift_card' ? payGiftCardCode.trim() : undefined },
    ]);
    setPayTaka('');
    setPayGiftCardCode('');
  }

  function pay() {
    setMsg(null);
    if (cart.length === 0) {
      setMsg('cart is empty');
      return;
    }
    startTx(async () => {
      const r = await checkout({
        customerId: customerId || undefined,
        lines: cart.map((c) => ({
          kind: c.kind,
          refId: c.refId,
          quantity: c.quantity,
          discount: c.discount,
          staffId: c.staffId || undefined,
        })),
        tip,
        payments,
        couponCode: couponCode.trim() || undefined,
        note: undefined,
      });
      if (r.ok) {
        setDone(r.sale as SaleView);
        setCart([]);
        setPayments([]);
        setTipTaka('0');
        setCustomerId('');
        setCouponCode('');
        router.refresh();
      } else {
        setMsg(r.error ?? 'checkout failed');
      }
    });
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md rounded-large border border-default-200 p-6 text-center">
        <h2 className="text-xl font-bold text-brand">Sale complete ✓</h2>
        <p className="mt-2 font-mono text-lg">{done.invoiceNumber}</p>
        <p className="mt-1">
          {bdt(done.total.amount)} · <span className="opacity-70">{done.paymentStatus}</span>
        </p>
        <Button type="button" className="mt-4" onPress={() => setDone(null)}>
          New sale
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      {/* Cart + add */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <select value={pick} onChange={(e) => setPick(e.target.value)} className={box}>
            {catalog.map((c) => (
              <option key={`${c.kind}:${c.id}`} value={c.id}>
                {c.kind === 'service' ? '✂️' : c.kind === 'product' ? '📦' : '🎁'} {c.label} ·{' '}
                {bdt(c.unitPrice)}
              </option>
            ))}
          </select>
          <Button type="button" onPress={addFromPick}>
            Add
          </Button>
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && scan()}
            placeholder="Scan barcode…"
            className={box}
          />
          <Button type="button" onPress={scan}>
            Scan
          </Button>
        </div>

        <ul className="flex flex-col gap-2">
          {cart.map((l) => {
            const t = lineTotals({
              unitPrice: money(l.unitPrice),
              quantity: l.quantity,
              discount: money(l.discount),
              taxable: l.taxable,
              taxRateBps: vatRateBps,
            });
            return (
              <li
                key={l.key}
                className="flex flex-wrap items-center gap-2 border-b border-default-100 pb-2 text-sm"
              >
                <span className="min-w-32 flex-1 font-medium">{l.label}</span>
                <input
                  type="number"
                  min={1}
                  value={l.quantity}
                  onChange={(e) => patch(l.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                  className={`${box} w-16`}
                  title="qty"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={l.discount / 100}
                  onChange={(e) => patch(l.key, { discount: toPoisha(e.target.value) })}
                  className={`${box} w-24`}
                  title="discount ৳"
                />
                <select
                  value={l.staffId}
                  onChange={(e) => patch(l.key, { staffId: e.target.value })}
                  className={`${box} w-32`}
                  title="staff"
                >
                  <option value="">— staff —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <span className="w-24 text-right font-mono">{bdt(t.total.amount)}</span>
                <button
                  type="button"
                  onClick={() => remove(l.key)}
                  className="text-danger opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            );
          })}
          {cart.length === 0 ? <li className="opacity-50">Cart is empty. Add items above.</li> : null}
        </ul>
      </section>

      {/* Totals + payment */}
      <aside className="flex h-fit flex-col gap-3 rounded-large border border-default-200 p-4">
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={box}>
          <option value="">Walk-in (no customer)</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <input
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          placeholder="Coupon code (applied at charge time)"
          className={box}
        />

        <dl className="flex flex-col gap-1 text-sm">
          <Row label="Subtotal" value={bdt(totals.subtotal.amount)} />
          <Row label="Discount" value={`− ${bdt(totals.discountTotal.amount)}`} />
          <Row label={`Tax (${(vatRateBps / 100).toFixed(0)}%)`} value={bdt(totals.taxTotal.amount)} />
          <div className="flex items-center justify-between">
            <span>Tip</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={tipTaka}
              onChange={(e) => setTipTaka(e.target.value)}
              className={`${box} w-24 text-right`}
            />
          </div>
          <div className="mt-1 flex justify-between border-t border-default-200 pt-1 text-base font-bold">
            <span>Total</span>
            <span className="font-mono">{bdt(totals.total.amount)}</span>
          </div>
        </dl>

        <div className="flex flex-col gap-1">
          {payments.map((p, idx) => (
            <div key={`${p.method}-${idx}`} className="flex justify-between text-sm">
              <span className="capitalize opacity-70">
                {p.method}
                {p.providerRef ? ` (${p.providerRef})` : ''}
              </span>
              <span className="font-mono">
                {bdt(p.amount)}{' '}
                <button
                  type="button"
                  onClick={() => setPayments((ps) => ps.filter((_, i) => i !== idx))}
                  className="text-danger opacity-60"
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-medium">
            <span>Remaining</span>
            <span className="font-mono">{bdt(remaining)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={box}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {payMethod === 'gift_card' ? (
            <input
              value={payGiftCardCode}
              onChange={(e) => setPayGiftCardCode(e.target.value)}
              placeholder="Gift card code"
              className={`${box} w-32`}
            />
          ) : null}
          <input
            type="number"
            min={0}
            step="0.01"
            value={payTaka}
            onChange={(e) => setPayTaka(e.target.value)}
            placeholder={`${(remaining / 100).toFixed(2)}`}
            className={`${box} w-24`}
          />
          <Button type="button" onPress={addPayment}>
            + Pay
          </Button>
        </div>

        <Button type="button" isDisabled={pending || cart.length === 0} onPress={pay}>
          {pending ? 'Processing…' : `Charge ${bdt(totals.total.amount)}`}
        </Button>
        {msg ? <p className="text-sm text-danger">{msg}</p> : null}
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="opacity-70">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

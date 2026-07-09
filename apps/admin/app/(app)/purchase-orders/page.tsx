import { Button } from '@salon/ui';
import { apiFetch } from '@/lib/api';
import { cancelPurchaseOrder, createPurchaseOrder, receivePurchaseOrder } from './actions';

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  status: 'draft' | 'received' | 'cancelled';
  lines: { productId: string; quantity: number; unitCost: { amount: number } }[];
  totalCost: { amount: number };
  receivedAt: string | null;
}
interface Supplier {
  id: string;
  name: string;
}
interface Product {
  id: string;
  name: { en: string };
}

const box = 'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';
const bdt = (poisha: number) => `৳${(poisha / 100).toFixed(2)}`;
const badge: Record<PurchaseOrder['status'], string> = {
  draft: 'bg-default-100 opacity-70',
  received: 'bg-brand/10 text-brand',
  cancelled: 'bg-danger/10 text-danger',
};

export default async function PurchaseOrdersPage() {
  const [poRes, supRes, prodRes] = await Promise.all([
    apiFetch<PurchaseOrder[]>('/purchase-orders'),
    apiFetch<Supplier[]>('/suppliers'),
    apiFetch<Product[]>('/catalog/products'),
  ]);
  if (poRes.status === 403) return <p className="opacity-70">Select a workspace above to manage purchase orders.</p>;

  const pos = poRes.data ?? [];
  const suppliers = supRes.data ?? [];
  const products = prodRes.data ?? [];
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Purchase Orders</h1>

      <ul className="flex flex-col gap-1 text-sm">
        {pos.map((po) => (
          <li key={po.id} className="flex flex-wrap items-center gap-3">
            <span className="font-mono font-bold">{po.poNumber}</span>
            <span className="opacity-70">{supplierName.get(po.supplierId) ?? po.supplierId}</span>
            <span className="opacity-50">{po.lines.length} line(s)</span>
            <span className="opacity-70">{bdt(po.totalCost.amount)}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${badge[po.status]}`}>{po.status}</span>
            {po.status === 'draft' ? (
              <>
                <form action={receivePurchaseOrder.bind(null, po.id)}>
                  <button type="submit" className="text-xs text-brand opacity-70 hover:opacity-100">
                    receive
                  </button>
                </form>
                <form action={cancelPurchaseOrder.bind(null, po.id)}>
                  <button type="submit" className="text-xs text-danger opacity-60 hover:opacity-100">
                    cancel
                  </button>
                </form>
              </>
            ) : null}
          </li>
        ))}
        {pos.length === 0 ? <li className="opacity-50">No purchase orders yet.</li> : null}
      </ul>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">New purchase order</h2>
        <form action={createPurchaseOrder} className="flex max-w-3xl flex-col gap-2">
          <select name="supplierId" className={box} required>
            <option value="">Select supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select name={`product${i}`} className={box}>
                <option value="">Line {i + 1}: product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name.en}
                  </option>
                ))}
              </select>
              <input name={`qty${i}`} type="number" min={1} placeholder="qty" className={`${box} w-24`} />
              <input name={`cost${i}`} type="number" min={0} step="0.01" placeholder="unit cost BDT" className={`${box} w-40`} />
            </div>
          ))}
          <input name="note" placeholder="Note" className={`${box} w-full max-w-md`} />
          <div>
            <Button type="submit">Create draft PO</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

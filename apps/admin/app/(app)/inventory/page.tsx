import { Button } from '@salon/ui';
import { apiFetch } from '@/lib/api';
import { adjustStock, setReorder, setStock } from './actions';

interface StockLevel {
  productId: string;
  qtyOnHand: number;
  reorderPoint: number;
}
interface Product {
  id: string;
  name: { en: string };
}

const box = 'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';
const REASONS = ['recount', 'wastage', 'damage', 'correction'] as const;

export default async function InventoryPage() {
  const [stockRes, productsRes] = await Promise.all([
    apiFetch<StockLevel[]>('/inventory/stock'),
    apiFetch<Product[]>('/catalog/products'),
  ]);
  if (stockRes.status === 403) return <p className="opacity-70">Select a workspace above to manage inventory.</p>;

  const stock = stockRes.data ?? [];
  const products = productsRes.data ?? [];
  const nameOf = new Map(products.map((p) => [p.id, p.name.en]));
  const productOptions = (
    <>
      <option value="">Select product</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name.en}
        </option>
      ))}
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Inventory</h1>

      <ul className="flex flex-col gap-1 text-sm">
        {stock.map((row) => {
          const low = row.reorderPoint > 0 && row.qtyOnHand <= row.reorderPoint;
          return (
            <li key={row.productId} className="flex flex-wrap items-center gap-3">
              <span className="font-medium">{nameOf.get(row.productId) ?? row.productId}</span>
              <span className="opacity-70">on hand: {row.qtyOnHand}</span>
              <span className="opacity-50">reorder ≤ {row.reorderPoint || '—'}</span>
              {low ? <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">low stock</span> : null}
            </li>
          );
        })}
        {stock.length === 0 ? <li className="opacity-50">No stock rows yet.</li> : null}
      </ul>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Set on-hand</h2>
        <form action={setStock} className="flex flex-wrap items-center gap-2">
          <select name="productId" className={box} required>
            {productOptions}
          </select>
          <input name="qtyOnHand" type="number" placeholder="qty on hand" className={`${box} w-36`} required />
          <Button type="submit">Set stock</Button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Reorder point</h2>
        <form action={setReorder} className="flex flex-wrap items-center gap-2">
          <select name="productId" className={box} required>
            {productOptions}
          </select>
          <input name="reorderPoint" type="number" min={0} placeholder="reorder ≤" className={`${box} w-36`} required />
          <Button type="submit">Set reorder</Button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Adjust stock</h2>
        <form action={adjustStock} className="flex max-w-3xl flex-wrap items-center gap-2">
          <select name="productId" className={box} required>
            {productOptions}
          </select>
          <input name="qtyDelta" type="number" placeholder="+/- delta" className={`${box} w-28`} required />
          <select name="reason" className={box} defaultValue="recount">
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input name="note" placeholder="Note" className={`${box} w-56`} />
          <Button type="submit">Adjust</Button>
        </form>
      </section>
    </div>
  );
}

import { apiFetch } from '@/lib/api';

interface InventoryReport {
  items: { productId: string; name: { en: string }; qtyOnHand: number; reorderPoint: number; unitCost: number; value: number }[];
  totalValue: number;
  lowStockCount: number;
  poSpendBySupplier: { supplierId: string; spend: number }[];
}

const bdt = (p: number) => `৳${(p / 100).toFixed(2)}`;

export default async function InventoryReportPage() {
  const res = await apiFetch<InventoryReport>('/reports/inventory-value');
  if (res.status === 403) return <p className="opacity-70">You don’t have access to reports.</p>;
  const r = res.data;
  if (!r) return <p className="opacity-70">Select a workspace above.</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Inventory value</h1>

      <div className="flex flex-wrap gap-6 text-sm">
        <div className="rounded-medium border border-default-200 px-4 py-3"><div className="opacity-60">Total stock value</div><div className="text-lg font-bold">{bdt(r.totalValue)}</div></div>
        <div className="rounded-medium border border-default-200 px-4 py-3"><div className="opacity-60">Low-stock items</div><div className="text-lg font-bold">{r.lowStockCount}</div></div>
      </div>

      <table className="w-full max-w-3xl text-sm">
        <thead className="text-left opacity-60"><tr><th className="py-1">Product</th><th>On hand</th><th>Unit cost</th><th>Value</th></tr></thead>
        <tbody>
          {r.items.map((i) => (
            <tr key={i.productId} className="border-t border-default-200">
              <td className="py-1">{i.name?.en ?? i.productId}</td><td>{i.qtyOnHand}</td><td>{bdt(i.unitCost)}</td><td>{bdt(i.value)}</td>
            </tr>
          ))}
          {r.items.length === 0 ? <tr><td colSpan={4} className="py-2 opacity-50">No stock rows.</td></tr> : null}
        </tbody>
      </table>

      <section className="text-sm">
        <h2 className="font-semibold">Purchase spend by supplier (received POs)</h2>
        <ul className="opacity-80">
          {r.poSpendBySupplier.map((p) => <li key={p.supplierId} className="font-mono">…{p.supplierId.slice(-6)}: {bdt(p.spend)}</li>)}
          {r.poSpendBySupplier.length === 0 ? <li className="opacity-50">No received purchase orders.</li> : null}
        </ul>
      </section>
    </div>
  );
}

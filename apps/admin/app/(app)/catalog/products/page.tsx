import { formatMoney } from '@salon/shared';
import { Button } from '@salon/ui';
import { apiFetch } from '@/lib/api';
import { createProduct, createProductCategory, deleteProduct } from '../actions';

interface Named {
  en: string;
  bn: string | null;
}
interface Category {
  id: string;
  name: Named;
}
interface Product {
  id: string;
  name: Named;
  sku: string;
  barcode: string | null;
  retailPrice: { amount: number };
  cost: { amount: number };
  taxable: boolean;
  expiryTracked: boolean;
}

const i = 'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';

export default async function ProductsPage() {
  const res = await apiFetch<Product[]>('/catalog/products');
  if (res.status === 403) return <p className="opacity-70">Select a workspace above to manage the catalog.</p>;
  const products = res.data ?? [];
  const categories = (await apiFetch<Category[]>('/catalog/product-categories')).data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Products</h1>

      <ul className="flex flex-col gap-1 text-sm">
        {products.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <span className="font-medium">{p.name.en}</span>
            <span className="opacity-50">{p.sku}</span>
            {p.barcode ? <span className="opacity-40">{p.barcode}</span> : null}
            <span className="text-brand">{formatMoney({ amount: p.retailPrice.amount, currency: 'BDT' })}</span>
            {p.expiryTracked ? <span className="opacity-50">· expiry</span> : null}
            <form action={deleteProduct.bind(null, p.id)}>
              <button type="submit" className="text-danger opacity-60 hover:opacity-100">
                ✕
              </button>
            </form>
          </li>
        ))}
        {products.length === 0 ? <li className="opacity-50">No products yet.</li> : null}
      </ul>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Add product</h2>
        <form action={createProduct} className="flex max-w-3xl flex-wrap items-center gap-2">
          <input name="en" placeholder="Name (EN)" className={i} required />
          <input name="bn" placeholder="নাম (BN)" className={i} />
          <select name="categoryId" className={i} defaultValue="">
            <option value="">— category —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name.en}
              </option>
            ))}
          </select>
          <input name="sku" placeholder="SKU" className={`${i} w-28`} required />
          <input name="barcode" placeholder="barcode" className={`${i} w-32`} />
          <input name="retailPrice" type="number" min={0} step="0.01" placeholder="retail BDT" className={`${i} w-28`} required />
          <input name="cost" type="number" min={0} step="0.01" placeholder="cost BDT" className={`${i} w-28`} required />
          <label className="flex items-center gap-1 text-sm">
            <input name="taxable" type="checkbox" defaultChecked /> taxable
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input name="expiryTracked" type="checkbox" /> expiry
          </label>
          <Button type="submit">Add</Button>
        </form>

        <form action={createProductCategory} className="flex max-w-sm gap-2">
          <input name="en" placeholder="New category (EN)" className={i} required />
          <Button type="submit">Add category</Button>
        </form>
      </section>
    </div>
  );
}

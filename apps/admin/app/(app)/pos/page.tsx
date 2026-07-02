import { apiFetch } from '@/lib/api';
import { getActiveScope } from '@/lib/active-scope';
import { PosScreen } from './pos-screen';

interface Named {
  en: string;
  bn: string | null;
}
interface Svc {
  id: string;
  name: Named;
  price: { amount: number };
  taxable: boolean;
  active: boolean;
}
interface Prod {
  id: string;
  name: Named;
  retailPrice: { amount: number };
  taxable: boolean;
  active: boolean;
}
interface Pkg {
  id: string;
  name: Named;
  price: { amount: number };
  active: boolean;
}
interface Staff {
  id: string;
  name: string;
}
interface Cust {
  id: string;
  name: string;
}
interface Branch {
  id: string;
  vatRateBps: number;
}

export default async function PosPage() {
  const first = await apiFetch<Svc[]>('/catalog/services');
  if (first.status === 403) {
    return <p className="opacity-70">Select a workspace + branch above to open the register.</p>;
  }
  const services = (first.data ?? []).filter((s) => s.active);
  const products = ((await apiFetch<Prod[]>('/catalog/products')).data ?? []).filter((p) => p.active);
  const packages = ((await apiFetch<Pkg[]>('/catalog/packages')).data ?? []).filter((p) => p.active);
  const staff = (await apiFetch<Staff[]>('/staff')).data ?? [];
  const customers = (await apiFetch<Cust[]>('/customers')).data ?? [];
  const branches = (await apiFetch<Branch[]>('/branches')).data ?? [];

  const scope = await getActiveScope();
  const vatRateBps = branches.find((b) => b.id === scope.branchId)?.vatRateBps ?? 0;

  const catalog = [
    ...services.map((s) => ({ kind: 'service' as const, id: s.id, label: s.name.en, unitPrice: s.price.amount, taxable: s.taxable })),
    ...products.map((p) => ({ kind: 'product' as const, id: p.id, label: p.name.en, unitPrice: p.retailPrice.amount, taxable: p.taxable })),
    ...packages.map((p) => ({ kind: 'package' as const, id: p.id, label: p.name.en, unitPrice: p.price.amount, taxable: true })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Point of Sale</h1>
      {catalog.length === 0 ? (
        <p className="opacity-60">Add services or products to the catalog first.</p>
      ) : (
        <PosScreen catalog={catalog} staff={staff} customers={customers} vatRateBps={vatRateBps} />
      )}
    </div>
  );
}

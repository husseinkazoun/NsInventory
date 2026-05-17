import { Plus } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { products } from '../lib/mockData'
import { formatNumber } from '../lib/format'

export default function Products() {
  return (
    <>
      <PageHeader
        pretitle="Operations · Inventory"
        title="Products"
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-ns-blue px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-ns-blue/90 focus:outline-none focus:ring-4 focus:ring-ns-blue/25"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Product
          </button>
        }
      />

      <div className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="text-left font-semibold px-4 py-3">Code</th>
                <th className="text-left font-semibold px-4 py-3">Name</th>
                <th className="text-left font-semibold px-4 py-3">Category</th>
                <th className="text-right font-semibold px-4 py-3">Quantity</th>
                <th className="text-right font-semibold px-4 py-3">Alert at</th>
                <th className="text-right font-semibold px-4 py-3">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ns-border-soft">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-ns-blue-tint/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.code}</td>
                  <td className="px-4 py-3 text-ns-navy font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.category}</td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      p.quantity <= p.alert ? 'text-rose-600' : 'text-ns-navy'
                    }`}
                  >
                    {formatNumber(p.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {formatNumber(p.alert)}
                  </td>
                  <td className="px-4 py-3 text-right text-ns-navy">
                    ${p.price.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Mocked data. Full CRUD, import/export, and filtering will land once the API is wired.
      </p>
    </>
  )
}

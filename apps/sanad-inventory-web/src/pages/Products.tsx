import { useMemo, useState } from 'react'
import { Plus, Search, PackageSearch } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { products } from '../lib/mockData'
import { formatNumber } from '../lib/format'

type StockFilter = 'all' | 'low' | 'ok'

const fieldInput =
  'h-9 px-3 rounded-lg border border-ns-border-soft bg-white text-sm text-ns-navy placeholder:text-slate-400 focus:outline-none focus:border-ns-blue focus:ring-4 focus:ring-ns-blue/15'

export default function Products() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [stock, setStock] = useState<StockFilter>('all')

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false
      if (category !== 'all' && p.category !== category) return false
      if (stock === 'low' && p.quantity > p.alert) return false
      if (stock === 'ok' && p.quantity <= p.alert) return false
      return true
    })
  }, [query, category, stock])

  const lowStockCount = useMemo(
    () => products.filter((p) => p.quantity <= p.alert).length,
    [],
  )

  function resetFilters() {
    setQuery('')
    setCategory('all')
    setStock('all')
  }

  return (
    <>
      <PageHeader
        pretitle="Operations · Inventory"
        title="Products"
        actions={
          <Button Icon={Plus}>New Product</Button>
        }
      />

      {/* Filters row */}
      <div className="mb-4 rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"
            />
            <input
              type="search"
              aria-label="Search products"
              placeholder="Search by name or code…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={`${fieldInput} pl-9 w-full`}
            />
          </div>

          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={fieldInput}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div
            role="radiogroup"
            aria-label="Stock filter"
            className="inline-flex rounded-lg border border-ns-border-soft bg-white p-0.5 text-sm"
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'low', label: `Low stock${lowStockCount ? ` (${lowStockCount})` : ''}` },
                { id: 'ok',  label: 'In stock' },
              ] as const
            ).map((opt) => {
              const active = stock === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setStock(opt.id)}
                  className={[
                    'px-3 h-8 rounded-md text-xs font-medium transition-colors',
                    active
                      ? 'bg-ns-blue-tint text-ns-blue'
                      : 'text-slate-600 hover:text-ns-navy',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {(query || category !== 'all' || stock !== 'all') && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-slate-500 hover:text-ns-blue underline-offset-2 hover:underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          Icon={PackageSearch}
          title="No products match"
          description="Try a different keyword, category, or stock filter."
          action={
            <Button variant="secondary" onClick={resetFilters}>
              Reset filters
            </Button>
          }
        />
      ) : (
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
                  <th className="text-left font-semibold px-4 py-3">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ns-border-soft">
                {filtered.map((p) => {
                  const isLow = p.quantity <= p.alert
                  return (
                    <tr
                      key={p.id}
                      className={[
                        'transition-colors',
                        isLow ? 'bg-rose-50/40 hover:bg-rose-50' : 'hover:bg-ns-blue-tint/40',
                      ].join(' ')}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.code}</td>
                      <td className="px-4 py-3 text-ns-navy font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-slate-600">{p.category}</td>
                      <td
                        className={`px-4 py-3 text-right font-semibold tabular-nums ${
                          isLow ? 'text-rose-600' : 'text-ns-navy'
                        }`}
                      >
                        {formatNumber(p.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 tabular-nums">
                        {formatNumber(p.alert)}
                      </td>
                      <td className="px-4 py-3 text-right text-ns-navy tabular-nums">
                        ${p.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {isLow ? (
                          <Badge tone="critical">Low</Badge>
                        ) : (
                          <Badge tone="success">In stock</Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">
        Showing {filtered.length} of {products.length} products. Mock data — CRUD, import/export, and live filters will land once the API is wired.
      </p>
    </>
  )
}

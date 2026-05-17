const numberFormatter = new Intl.NumberFormat('en-US')

export function formatNumber(n: number): string {
  return numberFormatter.format(n)
}

export function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const day = 1000 * 60 * 60 * 24
  const days = Math.floor(diffMs / day)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString()
}

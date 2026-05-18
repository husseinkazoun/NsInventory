type Props = {
  size?: number
  className?: string
}

export function BrandMark({ size = 36, className = '' }: Props) {
  return (
    <img
      src="/icons/sanad-inventory-tile.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={`rounded-md shadow-sm ${className}`.trim()}
    />
  )
}

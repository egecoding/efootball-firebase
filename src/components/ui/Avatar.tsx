import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm: { px: 28, cls: 'h-7 w-7 text-xs' },
  md: { px: 36, cls: 'h-9 w-9 text-sm' },
  lg: { px: 48, cls: 'h-12 w-12 text-base' },
  xl: { px: 80, cls: 'h-20 w-20 text-2xl' },
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const { px, cls } = sizeMap[size]
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  if (src) {
    return (
      <div
        className={cn(
          'relative rounded-full overflow-hidden flex-shrink-0',
          cls,
          className
        )}
      >
        <Image
          src={src}
          alt={name ?? 'Avatar'}
          fill
          className="object-cover"
          sizes={`${px}px`}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex-shrink-0 flex items-center justify-center font-semibold bg-brand-500 text-white',
        cls,
        className
      )}
    >
      {initials}
    </div>
  )
}

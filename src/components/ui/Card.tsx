import { cn } from '@/lib/utils/cn'
import { type HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
}

function Card({ className, hover = false, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm',
        hover &&
          'cursor-pointer transition-shadow hover:shadow-md hover:border-brand-500/50',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-5 pt-5 pb-3', className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-5 pb-5', className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2',
        className
      )}
      {...props}
    />
  )
}

export { Card, CardHeader, CardContent, CardFooter }

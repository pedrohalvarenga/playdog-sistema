import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'purple' | 'orange' | 'teal' | 'gray' | 'green' | 'red'
  className?: string
}

export default function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        {
          'bg-purple-100 text-brand-purple': variant === 'purple',
          'bg-orange-100 text-brand-orange': variant === 'orange',
          'bg-teal-100 text-teal-700': variant === 'teal',
          'bg-gray-100 text-gray-600': variant === 'gray',
          'bg-green-100 text-green-700': variant === 'green',
          'bg-red-100 text-red-600': variant === 'red',
        },
        className
      )}
    >
      {children}
    </span>
  )
}

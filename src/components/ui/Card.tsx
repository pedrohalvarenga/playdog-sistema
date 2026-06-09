import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export default function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-3xl shadow-sm border border-gray-100 p-4',
        onClick && 'cursor-pointer active:scale-98 transition-transform',
        className
      )}
    >
      {children}
    </div>
  )
}

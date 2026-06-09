'use client'

import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'teal'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-brand-purple text-white hover:bg-brand-purple-light': variant === 'primary',
            'bg-brand-orange text-white hover:opacity-90': variant === 'secondary',
            'bg-brand-teal text-gray-900 hover:opacity-90': variant === 'teal',
            'bg-red-500 text-white hover:bg-red-600': variant === 'danger',
            'bg-transparent text-brand-purple border-2 border-brand-purple hover:bg-purple-50': variant === 'ghost',
          },
          {
            'px-3 py-2 text-sm': size === 'sm',
            'px-5 py-3 text-base': size === 'md',
            'px-6 py-4 text-lg w-full': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : null}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export default Button

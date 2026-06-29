import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'outline' | 'ghost'
    size?: 'default' | 'sm' | 'lg' | 'icon'
    asChild?: boolean
  }

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
    if (asChild) {
        // Simple mock of Radix UI Slot
        const child = React.Children.only(children) as React.ReactElement
        return React.cloneElement(child, {
            ...props,
            className: cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 dark:focus-visible:ring-gray-300 disabled:pointer-events-none disabled:opacity-50",
                {
                  "bg-indigo-600 dark:bg-indigo-500 text-white shadow hover:bg-indigo-700 dark:hover:bg-indigo-600": variant === "default",
                  "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white dark:text-gray-200": variant === "outline",
                  "hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white dark:text-gray-200": variant === "ghost",
                  "h-9 px-4 py-2": size === "default",
                  "h-8 rounded-md px-3 text-xs": size === "sm",
                  "h-10 rounded-md px-8": size === "lg",
                  "h-9 w-9": size === "icon",
                },
                className,
                (child.props as { className?: string }).className
            ),
            ref: ref
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
    }

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 dark:focus-visible:ring-gray-300 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-indigo-600 dark:bg-indigo-500 text-white shadow hover:bg-indigo-700 dark:hover:bg-indigo-600": variant === "default",
            "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white dark:text-gray-200": variant === "outline",
            "hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white dark:text-gray-200": variant === "ghost",
            "h-9 px-4 py-2": size === "default",
            "h-8 rounded-md px-3 text-xs": size === "sm",
            "h-10 rounded-md px-8": size === "lg",
                  "h-9 w-9": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button }

// src/components/ui/Input.tsx
import { forwardRef, type InputHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '#/utils/cn'

export const inputVariants = cva(
    "flex w-full rounded-md border bg-stone-50 dark:bg-stone-900/50 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-purple-400 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    {
        variants: {
            variant: {
                default:
                    "border-stone-300 dark:border-stone-700 hover:border-stone-400 dark:hover:border-stone-600",
                error:
                    "border-red-500 dark:border-red-500 text-red-900 dark:text-red-100 focus-visible:outline-red-500",
            },
            size: {
                sm: "h-8 px-2.5 text-xs",
                md: "h-10 px-3 text-sm",
                lg: "h-12 px-4 text-base",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "md",
        },
    }
)

export interface InputProps
    extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
    isError?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, variant, size, isError, type = "text", ...props }, ref) => {
        // Allows passing either variant="error" or a boolean `isError` prop
        const activeVariant = isError ? "error" : variant

        return (
            <input
                type={type}
                ref={ref}
                className={cn(inputVariants({ variant: activeVariant, size, className }))}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

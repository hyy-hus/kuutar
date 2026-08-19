import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '#/utils/cn'

export const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-purple-400 focus:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer whitespace-nowrap",
    {
        variants: {
            variant: {
                default:
                    ["bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900",
                        "dark:hover:bg-stone-300 border border-transparent shadow-xs"],
                outline:
                    "border-2 border-stone-600 dark:border-stone-600 bg-transparent hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-900 dark:text-stone-100",
                secondary:
                    "bg-stone-200 text-stone-900 hover:bg-stone-300 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700",
                ghost:
                    "hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200",
                danger:
                    "bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 shadow-xs",
            },
            size: {
                sm: "h-8 px-3 text-xs",
                md: "h-10 px-4 text-sm",
                lg: "h-12 px-6 text-base",
                icon: "h-9 w-9 p-0",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "md",
        },
    }
)

export interface ButtonProps
    extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                ref={ref}
                className={cn(buttonVariants({ variant, size, className }))}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

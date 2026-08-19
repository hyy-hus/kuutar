import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines multiple class names or conditional class objects into a single string
 * and resolves conflicting Tailwind CSS utility classes.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

import { ChevronDown } from "lucide-react";
import { forwardRef, type SelectHTMLAttributes } from "react";
import { inputVariants } from "#/components/Input";
import { cn } from "#/utils/cn";

export interface SelectProps
	extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
	/** `sm` (h-8) for filter bars and table rows, `md` (h-10) in forms */
	size?: "sm" | "md";
	isError?: boolean;
	/** Classes for the wrapper; defaults to full width, pass `w-auto` in a `FilterBar` */
	wrapperClassName?: string;
}

/**
 * Styled native select with a custom chevron. Pass `<option>`s as children;
 * give it an accessible name with `aria-label` or a `<label htmlFor>`.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
	(
		{ className, size = "md", isError, wrapperClassName, children, ...props },
		ref,
	) => (
		<div className={cn("relative inline-flex w-full", wrapperClassName)}>
			<select
				ref={ref}
				className={cn(
					inputVariants({ variant: isError ? "error" : "default", size }),
					"appearance-none cursor-pointer pr-8",
					className,
				)}
				{...props}
			>
				{children}
			</select>
			<ChevronDown
				aria-hidden="true"
				size={size === "sm" ? 14 : 16}
				className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-600 dark:text-stone-400"
			/>
		</div>
	),
);
Select.displayName = "Select";

import { forwardRef, type TextareaHTMLAttributes } from "react";
import { inputVariants } from "#/components/Input";
import { cn } from "#/utils/cn";

export interface TextareaProps
	extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	isError?: boolean;
}

/** Multi-line text field styled like `Input` */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, isError, rows = 4, ...props }, ref) => (
		<textarea
			ref={ref}
			rows={rows}
			className={cn(
				inputVariants({ variant: isError ? "error" : "default", size: "md" }),
				"h-auto min-h-20 py-2 resize-y",
				className,
			)}
			{...props}
		/>
	),
);
Textarea.displayName = "Textarea";

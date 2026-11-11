import type { ReactNode } from "react";
import { ToggleChip } from "#/components/Chip";
import { cn } from "#/utils/cn";

export interface ChipSelectOption {
	value: string;
	label: ReactNode;
}

export interface ChipSelectProps {
	options: ChipSelectOption[];
	/** Selected values */
	value: string[];
	onChange: (value: string[]) => void;
	/** Accessible name of the group */
	"aria-label": string;
	className?: string;
}

/** Multi-select as a group of toggle chips; for about 20 options or fewer */
export function ChipSelect({
	options,
	value,
	onChange,
	"aria-label": ariaLabel,
	className,
}: ChipSelectProps) {
	const toggle = (optionValue: string) =>
		onChange(
			value.includes(optionValue)
				? value.filter((v) => v !== optionValue)
				: [...value, optionValue],
		);
	return (
		<fieldset
			aria-label={ariaLabel}
			className={cn("m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0", className)}
		>
			{options.map((option) => (
				<ToggleChip
					key={option.value}
					selected={value.includes(option.value)}
					onClick={() => toggle(option.value)}
				>
					{option.label}
				</ToggleChip>
			))}
		</fieldset>
	);
}

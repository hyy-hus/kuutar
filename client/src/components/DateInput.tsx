import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { Input, type InputProps } from "#/components/Input";

export type DateInputProps = Omit<InputProps, "type">;

/**
 * Date field (value `YYYY-MM-DD`) using the native picker. `lang` follows the
 * UI language so browsers that honour it show the matching format.
 */
export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
	(props, ref) => {
		const { i18n } = useTranslation();
		return (
			<Input
				ref={ref}
				type="date"
				lang={i18n.resolvedLanguage ?? i18n.language}
				{...props}
			/>
		);
	},
);
DateInput.displayName = "DateInput";

import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { Input, type InputProps } from "#/components/Input";

export type DateTimeInputProps = Omit<InputProps, "type">;

/**
 * Date and time field (value `YYYY-MM-DDTHH:mm`, local time; see
 * `formatDateTimeLocal`) using the native picker. `lang` follows the UI language.
 */
export const DateTimeInput = forwardRef<HTMLInputElement, DateTimeInputProps>(
	(props, ref) => {
		const { i18n } = useTranslation();
		return (
			<Input
				ref={ref}
				type="datetime-local"
				lang={i18n.resolvedLanguage ?? i18n.language}
				{...props}
			/>
		);
	},
);
DateTimeInput.displayName = "DateTimeInput";

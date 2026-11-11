import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SegmentedControl } from "#/components/SegmentedControl";
import { cn } from "#/utils/cn";

export type Theme = "light" | "dark";

interface ThemeSwitcherProps {
	value: Theme;
	onChange: (theme: Theme) => void;
	/** Stretch to the container and share the width between the segments */
	fullWidth?: boolean;
}

/** Light | Dark switch in the same style as the language switcher */
export function ThemeSwitcher({
	value,
	onChange,
	fullWidth,
}: ThemeSwitcherProps) {
	const { t } = useTranslation();
	return (
		<SegmentedControl<Theme>
			aria-label={t("teema", "Teema")}
			value={value}
			onChange={onChange}
			className={cn(
				fullWidth && "w-full [&>button]:flex-1 [&>button]:justify-center",
			)}
			options={[
				{
					value: "light",
					label: (
						<>
							<Sun size={13} aria-hidden="true" />
							{t("teemaVaalea", "Vaalea")}
						</>
					),
				},
				{
					value: "dark",
					label: (
						<>
							<Moon size={13} aria-hidden="true" />
							{t("teemaTumma", "Tumma")}
						</>
					),
				},
			]}
		/>
	);
}

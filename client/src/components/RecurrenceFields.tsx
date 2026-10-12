import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatYYYYMMDD, parseLocalDate, useDateFormatter } from "#/utils/date";
import {
	listSeriesStarts,
	NO_RECURRENCE,
	nthWeekdayOfMonth,
	nthWeekdayOfYear,
	type RecurrencePreset,
	type RRuleConfig,
} from "#/utils/rruleUtils";
import { Input } from "./Input";

interface RecurrenceFieldsProps {
	/** Start of the first occurrence (datetime-local string). The presets are relative to it. */
	startTime: string;
	value: RRuleConfig;
	onChange: (value: RRuleConfig) => void;
	/** Cap on how many dates the exceptions list shows */
	maxExceptionRows?: number;
}

const SELECT_CLASS =
	"w-full px-2 py-1.5 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-sm";
const LABEL_CLASS = "text-[11px] text-stone-600 dark:text-stone-400";

/**
 * Recurrence controls shared by reservations, restrictions and reservable blocks: a preset, how
 * the series ends and the dates excluded from it. State lives in the parent form.
 */
export function RecurrenceFields({
	startTime,
	value,
	onChange,
	maxExceptionRows = 60,
}: RecurrenceFieldsProps) {
	const { t, i18n } = useTranslation();
	const { formatWeekday, formatDateOnly } = useDateFormatter();
	const locale = i18n.resolvedLanguage ?? i18n.language;

	const parsedStart = startTime ? new Date(startTime) : null;
	const start =
		parsedStart && !Number.isNaN(parsedStart.getTime()) ? parsedStart : null;
	// Labels need some date to describe; without a start date they describe today
	const anchor = start ?? new Date();

	const ordinal = (n: number): string => {
		switch (n) {
			case 1:
				return t("ensimminen", "ensimmäinen");
			case 2:
				return t("toinen", "toinen");
			case 3:
				return t("kolmas", "kolmas");
			case 4:
				return t("neljs", "neljäs");
			case -1:
				return t("viimeinen", "viimeinen");
			default:
				return t("n", { count: n, ordinal: true, defaultValue: "{{count}}." });
		}
	};

	// English capitalizes weekday names, Finnish and Swedish don't
	const weekdayName = formatWeekday(anchor);
	const weekday = locale.startsWith("en")
		? weekdayName
		: weekdayName.toLowerCase();
	const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(
		anchor,
	);
	const dayMonth = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "long",
	}).format(anchor);

	const presetLabels: Record<Exclude<RecurrencePreset, "none">, string> = {
		daily: t("pivittin", "Päivittäin"),
		weekdays: t("jokaArkipivMape", "Joka arkipäivä (ma–pe)"),
		weekly: t("jokaWeekday", "Joka {{weekday}}", { weekday }),
		monthlyDay: t("kuukaudenDayPiv", "Kuukauden {{day}}. päivä", {
			day: anchor.getDate(),
		}),
		monthlyNthWeekday: t(
			"kuukaudenNthWeekday",
			"Kuukauden {{nth}} {{weekday}}",
			{ nth: ordinal(nthWeekdayOfMonth(anchor)), weekday },
		),
		yearlyDate: t("jokaVuosiDate", "Joka vuosi {{date}}", { date: dayMonth }),
		yearlyNthWeekday: t(
			"jokaVuosiNthWeekdayMonth",
			"Joka vuosi: {{nth}} {{weekday}}, {{month}}",
			{ nth: ordinal(nthWeekdayOfMonth(anchor)), weekday, month },
		),
		yearlyNthWeekdayOfYear: t(
			"vuodenNthWeekday",
			"Vuoden {{nth}} {{weekday}}",
			{ nth: ordinal(nthWeekdayOfYear(anchor)), weekday },
		),
		custom: t("mukautettuToisto", "Mukautettu toisto"),
	};

	const presetOrder: Exclude<RecurrencePreset, "none" | "custom">[] = [
		"daily",
		"weekdays",
		"weekly",
		"monthlyDay",
		"monthlyNthWeekday",
		"yearlyDate",
		"yearlyNthWeekday",
		"yearlyNthWeekdayOfYear",
	];

	const endMode = value.count ? "count" : "until";
	const untilStr = value.until ? formatYYYYMMDD(value.until) : "";

	const candidates = useMemo(
		() => (start ? listSeriesStarts(startTime, value) : []),
		[start, startTime, value],
	);
	const excluded = new Set(value.exdates.map((d) => d.getTime()));

	const toggleExdate = (date: Date, include: boolean) => {
		const rest = value.exdates.filter((d) => d.getTime() !== date.getTime());
		onChange({ ...value, exdates: include ? rest : [...rest, date] });
	};

	return (
		<div className="space-y-2">
			<div className="grid grid-cols-2 gap-2">
				<div className="space-y-1">
					<label htmlFor="recurrence_preset" className={LABEL_CLASS}>
						{t("toistuvuusjakso", "Toistuvuusjakso")}
					</label>
					<select
						id="recurrence_preset"
						value={value.preset}
						onChange={(e) => {
							const preset = e.target.value as RecurrencePreset;
							// Exceptions belong to the dates of one pattern, so they don't carry over
							onChange(
								preset === "none"
									? NO_RECURRENCE
									: { ...value, preset, exdates: [] },
							);
						}}
						className={SELECT_CLASS}
					>
						<option value="none">{t("eiToistoa", "Ei toistoa")}</option>
						{presetOrder.map((preset) => (
							<option key={preset} value={preset}>
								{presetLabels[preset]}
							</option>
						))}
						{value.preset === "custom" && (
							<option value="custom">{presetLabels.custom}</option>
						)}
					</select>
				</div>

				{value.preset !== "none" && (
					<div className="space-y-1">
						<label htmlFor="recurrence_end_mode" className={LABEL_CLASS}>
							{t("toistoPttyy", "Toisto päättyy")}
						</label>
						<select
							id="recurrence_end_mode"
							value={endMode}
							onChange={(e) =>
								onChange({
									...value,
									count: e.target.value === "count" ? 10 : null,
								})
							}
							className={SELECT_CLASS}
						>
							<option value="until">{t("pivmrn", "Päivämäärään")}</option>
							<option value="count">
								{t("toistojenJlkeen", "Toistojen jälkeen")}
							</option>
						</select>
					</div>
				)}
			</div>

			{value.preset !== "none" && (
				<div className="space-y-1">
					{endMode === "until" ? (
						<>
							<label htmlFor="recurrence_until" className={LABEL_CLASS}>
								{t("viimeinenPiv", "Viimeinen päivä")}
							</label>
							<Input
								id="recurrence_until"
								type="date"
								value={untilStr}
								onChange={(e) =>
									onChange({
										...value,
										until: e.target.value
											? parseLocalDate(e.target.value)
											: null,
									})
								}
							/>
						</>
					) : (
						<>
							<label htmlFor="recurrence_count" className={LABEL_CLASS}>
								{t("toistojenMr", "Toistojen määrä")}
							</label>
							<Input
								id="recurrence_count"
								type="number"
								min={2}
								max={500}
								value={value.count ?? ""}
								onChange={(e) =>
									onChange({
										...value,
										count: Math.max(
											2,
											Math.min(500, Number(e.target.value) || 2),
										),
									})
								}
							/>
						</>
					)}
				</div>
			)}

			{value.preset !== "none" && candidates.length > 1 && (
				<details className="text-xs">
					<summary className="cursor-pointer text-stone-700 dark:text-stone-300">
						{value.exdates.length > 0
							? t("poikkeuksetCount", "Poikkeukset ({{count}})", {
									count: value.exdates.length,
								})
							: t("poikkeukset", "Poikkeukset")}
					</summary>
					<p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
						{t(
							"poistaValintaNiiltPiviltJoinaToistoaEiPidet",
							"Poista valinta niiltä päiviltä, joina toistoa ei pidetä.",
						)}
					</p>
					<ul className="mt-1 max-h-40 overflow-y-auto space-y-0.5">
						{candidates.slice(0, maxExceptionRows).map((date) => {
							const id = `recurrence_occ_${date.getTime()}`;
							return (
								<li key={date.getTime()} className="flex items-center gap-2">
									<input
										id={id}
										type="checkbox"
										checked={!excluded.has(date.getTime())}
										onChange={(e) => toggleExdate(date, e.target.checked)}
									/>
									<label htmlFor={id}>
										{formatWeekday(date)} {formatDateOnly(date)}
									</label>
								</li>
							);
						})}
					</ul>
				</details>
			)}
		</div>
	);
}

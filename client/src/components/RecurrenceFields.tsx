import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatYYYYMMDD, parseLocalDate, useDateFormatter } from "#/utils/date";
import {
	listSeriesStarts,
	NO_RECURRENCE,
	type RecurrenceFreq,
	type RRuleConfig,
	recurrenceDefaults,
} from "#/utils/rruleUtils";
import { Input } from "./Input";

interface RecurrenceFieldsProps {
	/** Start of the first occurrence (datetime-local string). Yearly repeats and the defaults follow it. */
	startTime: string;
	value: RRuleConfig;
	onChange: (value: RRuleConfig) => void;
	/** Cap on how many dates the exceptions list shows */
	maxExceptionRows?: number;
}

const SELECT_CLASS =
	"w-full px-2 py-1.5 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-sm";
const LABEL_CLASS = "text-[11px] text-stone-600 dark:text-stone-400";

/** Monday first; the numbers are what Date#getDay returns */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WORKDAYS = [1, 2, 3, 4, 5];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const NTH_OPTIONS = [1, 2, 3, 4, -1];

/** A date that falls on the given weekday (2026-01-04 is a Sunday) */
const dateOfWeekday = (day: number) => new Date(2026, 0, 4 + day);

/**
 * Recurrence controls shared by reservations, restrictions and reservable blocks: what the series
 * repeats on, how it ends and the dates excluded from it. State lives in the parent form.
 */
export function RecurrenceFields({
	startTime,
	value,
	onChange,
	maxExceptionRows = 60,
}: RecurrenceFieldsProps) {
	const { t, i18n } = useTranslation();
	const { formatWeekday, formatWeekdayShort, formatDateOnly } =
		useDateFormatter();
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
			default:
				return t("viimeinen", "viimeinen");
		}
	};

	const monthName = (month: number) =>
		new Intl.DateTimeFormat(locale, { month: "long" }).format(
			new Date(2026, month - 1, 1),
		);

	const setFreq = (freq: RecurrenceFreq) => {
		if (freq === "none") {
			onChange(NO_RECURRENCE);
			return;
		}
		// Leaving "no recurrence" starts from the start date: its weekday, day of the month, ...
		const defaults =
			value.freq === "none" ? recurrenceDefaults(anchor) : undefined;
		// Exceptions belong to the dates of one pattern, so they don't carry over
		onChange({ ...value, ...defaults, freq, exdates: [] });
	};

	/** Changing the pattern changes which dates exist, so old exceptions no longer apply */
	const setPattern = (patch: Partial<RRuleConfig>) =>
		onChange({ ...value, ...patch, exdates: [] });

	const toggleWeekday = (day: number, on: boolean) => {
		const days = on
			? [...value.weekdays, day]
			: value.weekdays.filter((d) => d !== day);
		// A weekly series needs at least one day
		if (days.length === 0) return;
		setPattern({ weekdays: [...new Set(days)].sort() });
	};

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
					<label htmlFor="recurrence_freq" className={LABEL_CLASS}>
						{t("toistuvuusjakso", "Toistuvuusjakso")}
					</label>
					<select
						id="recurrence_freq"
						value={value.freq}
						onChange={(e) => setFreq(e.target.value as RecurrenceFreq)}
						className={SELECT_CLASS}
					>
						<option value="none">{t("eiToistoa", "Ei toistoa")}</option>
						<option value="weekly">
							{t(
								"viikoittainValittuinaPivin",
								"Viikoittain valittuina päivinä",
							)}
						</option>
						<option value="monthly">
							{t("kuukausittain", "Kuukausittain")}
						</option>
						<option value="yearly">{t("vuosittain", "Vuosittain")}</option>
						{value.freq === "custom" && (
							<option value="custom">
								{t("mukautettuToisto", "Mukautettu toisto")}
							</option>
						)}
					</select>
				</div>

				{value.freq !== "none" && (
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

			{value.freq === "weekly" && (
				<fieldset className="space-y-1">
					<legend className={LABEL_CLASS}>
						{t("viikonpivt", "Viikonpäivät")}
					</legend>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
						{WEEK_ORDER.map((day) => {
							const id = `recurrence_weekday_${day}`;
							return (
								<span key={day} className="flex items-center gap-1">
									<input
										id={id}
										type="checkbox"
										checked={value.weekdays.includes(day)}
										onChange={(e) => toggleWeekday(day, e.target.checked)}
									/>
									<label htmlFor={id} title={formatWeekday(dateOfWeekday(day))}>
										{formatWeekdayShort(dateOfWeekday(day))}
									</label>
								</span>
							);
						})}
					</div>
					<div className="flex gap-3 text-[11px]">
						<button
							type="button"
							className="underline text-stone-600 dark:text-stone-400"
							onClick={() => setPattern({ weekdays: WORKDAYS })}
						>
							{t("arkipivt", "Arkipäivät")}
						</button>
						<button
							type="button"
							className="underline text-stone-600 dark:text-stone-400"
							onClick={() => setPattern({ weekdays: ALL_DAYS })}
						>
							{t("jokaPiv", "Joka päivä")}
						</button>
					</div>
				</fieldset>
			)}

			{value.freq === "monthly" && (
				<div className="grid grid-cols-2 gap-2">
					<div className="space-y-1">
						<label htmlFor="recurrence_monthly_mode" className={LABEL_CLASS}>
							{t("kuukaudenToistuvuus", "Kuukauden toistuvuus")}
						</label>
						<select
							id="recurrence_monthly_mode"
							value={value.monthlyMode}
							onChange={(e) =>
								setPattern({
									monthlyMode: e.target.value as RRuleConfig["monthlyMode"],
								})
							}
							className={SELECT_CLASS}
						>
							<option value="day">
								{t("kuukaudenTiettyPiv", "Kuukauden tiettynä päivänä")}
							</option>
							<option value="nthWeekday">
								{t("kuukaudenTietyViikonpiv", "Kuukauden tietty viikonpäivä")}
							</option>
						</select>
					</div>

					{value.monthlyMode === "day" ? (
						<div className="space-y-1">
							<label htmlFor="recurrence_month_day" className={LABEL_CLASS}>
								{t("pivKuukaudessa", "Päivä")}
							</label>
							<select
								id="recurrence_month_day"
								value={value.monthDay}
								onChange={(e) =>
									setPattern({ monthDay: Number(e.target.value) })
								}
								className={SELECT_CLASS}
							>
								{MONTH_DAYS.map((day) => (
									<option key={day} value={day}>
										{`${day}.`}
									</option>
								))}
								<option value={-1}>
									{t("viimeinenPiv", "Viimeinen päivä")}
								</option>
							</select>
						</div>
					) : (
						<div className="grid grid-cols-2 gap-2">
							<div className="space-y-1">
								<label htmlFor="recurrence_nth" className={LABEL_CLASS}>
									{t("kerta", "Monesko")}
								</label>
								<select
									id="recurrence_nth"
									value={value.nth}
									onChange={(e) => setPattern({ nth: Number(e.target.value) })}
									className={SELECT_CLASS}
								>
									{NTH_OPTIONS.map((n) => (
										<option key={n} value={n}>
											{ordinal(n)}
										</option>
									))}
								</select>
							</div>
							<div className="space-y-1">
								<label htmlFor="recurrence_nth_weekday" className={LABEL_CLASS}>
									{t("viikonpiv", "Viikonpäivä")}
								</label>
								<select
									id="recurrence_nth_weekday"
									value={value.nthWeekday}
									onChange={(e) =>
										setPattern({ nthWeekday: Number(e.target.value) })
									}
									className={SELECT_CLASS}
								>
									{WEEK_ORDER.map((day) => (
										<option key={day} value={day}>
											{formatWeekday(dateOfWeekday(day))}
										</option>
									))}
								</select>
							</div>
						</div>
					)}
				</div>
			)}

			{value.freq === "yearly" && (
				<div className="grid grid-cols-2 gap-2">
					<div className="space-y-1">
						<label htmlFor="recurrence_year_month" className={LABEL_CLASS}>
							{t("kuukausi", "Kuukausi")}
						</label>
						<select
							id="recurrence_year_month"
							value={value.yearMonth}
							onChange={(e) =>
								setPattern({ yearMonth: Number(e.target.value) })
							}
							className={SELECT_CLASS}
						>
							{MONTHS.map((month) => (
								<option key={month} value={month}>
									{monthName(month)}
								</option>
							))}
						</select>
					</div>
					<div className="space-y-1">
						<label htmlFor="recurrence_year_day" className={LABEL_CLASS}>
							{t("pivKuukaudessa", "Päivä")}
						</label>
						<select
							id="recurrence_year_day"
							value={value.yearDay}
							onChange={(e) => setPattern({ yearDay: Number(e.target.value) })}
							className={SELECT_CLASS}
						>
							{MONTH_DAYS.map((day) => (
								<option key={day} value={day}>
									{`${day}.`}
								</option>
							))}
						</select>
					</div>
				</div>
			)}

			{value.freq !== "none" && (
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

			{value.freq !== "none" && candidates.length > 1 && (
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

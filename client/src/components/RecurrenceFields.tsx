import { Repeat } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { ToggleChip } from "#/components/Chip";
import { DateInput } from "#/components/DateInput";
import { Input } from "#/components/Input";
import { Select } from "#/components/Select";
import { formatYYYYMMDD, parseLocalDate, useDateFormatter } from "#/utils/date";
import { WEEK_ORDER, weekdayRuns } from "#/utils/recurrenceSummary";
import {
	listSeriesStarts,
	NO_RECURRENCE,
	type RecurrenceFreq,
	type RRuleConfig,
	recurrenceDefaults,
} from "#/utils/rruleUtils";

interface RecurrenceFieldsProps {
	/** Start of the first occurrence (datetime-local string). Yearly repeats and the defaults follow it. */
	startTime: string;
	value: RRuleConfig;
	onChange: (value: RRuleConfig) => void;
	/** Cap on how many dates the exceptions list shows */
	maxExceptionRows?: number;
}

const LABEL_CLASS = "block text-sm font-medium text-ink";
const CHECKBOX_CLASS =
	"size-4 shrink-0 accent-purple-600 dark:accent-purple-400";

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

	const excludedCount = value.exdates.length;
	const occurrenceCount = Math.max(candidates.length - excludedCount, 0);

	const weekdayName = (day: number) => formatWeekdayShort(dateOfWeekday(day));

	/** One sentence describing the series, e.g. "Toistuu viikoittain ma–su 5.10.2026–31.12.2027, 453 kertaa" */
	const summary = (() => {
		if (value.freq === "none" || candidates.length === 0) return null;
		let pattern: string;
		switch (value.freq) {
			case "weekly":
				pattern = t("toistuuViikoittain", "Toistuu viikoittain {{days}}", {
					days: weekdayRuns(value.weekdays)
						.map((run) =>
							run.from === run.to
								? weekdayName(run.from)
								: `${weekdayName(run.from)}–${weekdayName(run.to)}`,
						)
						.join(", "),
				});
				break;
			case "monthly":
				pattern =
					value.monthlyMode === "day"
						? value.monthDay === -1
							? t(
									"toistuuKuukausittainViimeinen",
									"Toistuu kuukausittain kuukauden viimeisenä päivänä",
								)
							: t(
									"toistuuKuukausittainPaiva",
									"Toistuu kuukausittain {{day}}. päivä",
									{ day: value.monthDay },
								)
						: t(
								"toistuuKuukausittainNth",
								"Toistuu kuukausittain: {{nth}} {{weekday}}",
								{
									nth: ordinal(value.nth),
									weekday: formatWeekday(
										dateOfWeekday(value.nthWeekday),
									).toLowerCase(),
								},
							);
				break;
			case "yearly":
				pattern = t("toistuuVuosittain", "Toistuu vuosittain {{date}}", {
					date: new Intl.DateTimeFormat(locale, {
						day: "numeric",
						month: "long",
					}).format(new Date(2026, value.yearMonth - 1, value.yearDay)),
				});
				break;
			default:
				pattern = t("toistuuMukautetusti", "Toistuu mukautetun säännön mukaan");
		}
		const first = candidates[0];
		const last = candidates[candidates.length - 1];
		const times = t("toistoKertaa", "{{count}} kertaa", {
			count: occurrenceCount,
		});
		return `${pattern} ${formatDateOnly(first)}–${formatDateOnly(last)}, ${times}`;
	})();

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div className="space-y-1">
					<label htmlFor="recurrence_freq" className={LABEL_CLASS}>
						{t("toistuvuusjakso", "Toistuvuusjakso")}
					</label>
					<Select
						id="recurrence_freq"
						value={value.freq}
						onChange={(e) => setFreq(e.target.value as RecurrenceFreq)}
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
					</Select>
				</div>

				{value.freq !== "none" && (
					<div className="space-y-1">
						<label htmlFor="recurrence_end_mode" className={LABEL_CLASS}>
							{t("toistoPttyy", "Toisto päättyy")}
						</label>
						<Select
							id="recurrence_end_mode"
							value={endMode}
							onChange={(e) =>
								onChange({
									...value,
									count: e.target.value === "count" ? 10 : null,
								})
							}
						>
							<option value="until">{t("pivmrn", "Päivämäärään")}</option>
							<option value="count">
								{t("toistojenJlkeen", "Toistojen jälkeen")}
							</option>
						</Select>
					</div>
				)}
			</div>

			{value.freq === "weekly" && (
				<fieldset className="m-0 min-w-0 space-y-2 border-0 p-0">
					<legend className={LABEL_CLASS}>
						{t("viikonpivt", "Viikonpäivät")}
					</legend>
					<div className="flex flex-wrap items-center gap-2">
						{WEEK_ORDER.map((day) => {
							const date = dateOfWeekday(day);
							const selected = value.weekdays.includes(day);
							return (
								<ToggleChip
									key={day}
									id={`recurrence_weekday_${day}`}
									role="checkbox"
									aria-checked={selected}
									aria-label={formatWeekdayShort(date)}
									title={formatWeekday(date)}
									selected={selected}
									className="min-w-10 justify-center"
									onClick={() => toggleWeekday(day, !selected)}
								>
									{formatWeekdayShort(date)}
								</ToggleChip>
							);
						})}
						<span aria-hidden="true" className="mx-1 h-5 w-px bg-line-subtle" />
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setPattern({ weekdays: WORKDAYS })}
						>
							{t("arkipivt", "Arkipäivät")}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setPattern({ weekdays: ALL_DAYS })}
						>
							{t("jokaPiv", "Joka päivä")}
						</Button>
					</div>
				</fieldset>
			)}

			{value.freq === "monthly" && (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<div className="space-y-1">
						<label htmlFor="recurrence_monthly_mode" className={LABEL_CLASS}>
							{t("kuukaudenToistuvuus", "Kuukauden toistuvuus")}
						</label>
						<Select
							id="recurrence_monthly_mode"
							value={value.monthlyMode}
							onChange={(e) =>
								setPattern({
									monthlyMode: e.target.value as RRuleConfig["monthlyMode"],
								})
							}
						>
							<option value="day">
								{t("kuukaudenTiettyPiv", "Kuukauden tiettynä päivänä")}
							</option>
							<option value="nthWeekday">
								{t("kuukaudenTietyViikonpiv", "Kuukauden tietty viikonpäivä")}
							</option>
						</Select>
					</div>

					{value.monthlyMode === "day" ? (
						<div className="space-y-1">
							<label htmlFor="recurrence_month_day" className={LABEL_CLASS}>
								{t("pivKuukaudessa", "Päivä")}
							</label>
							<Select
								id="recurrence_month_day"
								value={value.monthDay}
								onChange={(e) =>
									setPattern({ monthDay: Number(e.target.value) })
								}
							>
								{MONTH_DAYS.map((day) => (
									<option key={day} value={day}>
										{`${day}.`}
									</option>
								))}
								<option value={-1}>
									{t("viimeinenPiv", "Viimeinen päivä")}
								</option>
							</Select>
						</div>
					) : (
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1">
								<label htmlFor="recurrence_nth" className={LABEL_CLASS}>
									{t("kerta", "Monesko")}
								</label>
								<Select
									id="recurrence_nth"
									value={value.nth}
									onChange={(e) => setPattern({ nth: Number(e.target.value) })}
								>
									{NTH_OPTIONS.map((n) => (
										<option key={n} value={n}>
											{ordinal(n)}
										</option>
									))}
								</Select>
							</div>
							<div className="space-y-1">
								<label htmlFor="recurrence_nth_weekday" className={LABEL_CLASS}>
									{t("viikonpiv", "Viikonpäivä")}
								</label>
								<Select
									id="recurrence_nth_weekday"
									value={value.nthWeekday}
									onChange={(e) =>
										setPattern({ nthWeekday: Number(e.target.value) })
									}
								>
									{WEEK_ORDER.map((day) => (
										<option key={day} value={day}>
											{formatWeekday(dateOfWeekday(day))}
										</option>
									))}
								</Select>
							</div>
						</div>
					)}
				</div>
			)}

			{value.freq === "yearly" && (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<div className="space-y-1">
						<label htmlFor="recurrence_year_month" className={LABEL_CLASS}>
							{t("kuukausi", "Kuukausi")}
						</label>
						<Select
							id="recurrence_year_month"
							value={value.yearMonth}
							onChange={(e) =>
								setPattern({ yearMonth: Number(e.target.value) })
							}
						>
							{MONTHS.map((month) => (
								<option key={month} value={month}>
									{monthName(month)}
								</option>
							))}
						</Select>
					</div>
					<div className="space-y-1">
						<label htmlFor="recurrence_year_day" className={LABEL_CLASS}>
							{t("pivKuukaudessa", "Päivä")}
						</label>
						<Select
							id="recurrence_year_day"
							value={value.yearDay}
							onChange={(e) => setPattern({ yearDay: Number(e.target.value) })}
						>
							{MONTH_DAYS.map((day) => (
								<option key={day} value={day}>
									{`${day}.`}
								</option>
							))}
						</Select>
					</div>
				</div>
			)}

			{value.freq !== "none" && (
				<div className="space-y-1 sm:max-w-[calc(50%-0.375rem)]">
					{endMode === "until" ? (
						<>
							<label htmlFor="recurrence_until" className={LABEL_CLASS}>
								{t("viimeinenPiv", "Viimeinen päivä")}
							</label>
							<DateInput
								id="recurrence_until"
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

			{summary && (
				<p
					aria-live="polite"
					className="flex items-start gap-2 rounded-md bg-surface-muted p-3 text-sm text-ink"
				>
					<Repeat size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
					<span>{summary}</span>
				</p>
			)}

			{value.freq !== "none" && candidates.length > 1 && (
				<details className="group rounded-md border border-line-subtle bg-surface">
					<summary className="focus-ring flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-ink">
						{t(
							"poikkeuksetMaara",
							"Poikkeukset ({{excluded}} / {{total}} päivää)",
							{ excluded: excludedCount, total: candidates.length },
						)}
					</summary>
					<div className="space-y-2 border-t border-line-subtle p-3">
						<p className="text-xs text-ink-muted">
							{t(
								"poistaValintaNiiltPiviltJoinaToistoaEiPidet",
								"Poista valinta niiltä päiviltä, joina toistoa ei pidetä.",
							)}
						</p>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={excludedCount === 0}
								onClick={() => onChange({ ...value, exdates: [] })}
							>
								{t("valitseKaikki", "Valitse kaikki")}
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={excludedCount === candidates.length}
								onClick={() => onChange({ ...value, exdates: [...candidates] })}
							>
								{t("eiYhtaan", "Ei yhtään")}
							</Button>
						</div>
						{occurrenceCount === 0 && (
							<p className="text-xs text-status-danger-ink">
								{t(
									"kaikkiPaivatPoissuljettu",
									"Kaikki päivät on poissuljettu, joten toistoa ei synny.",
								)}
							</p>
						)}
						<ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-line-subtle bg-surface-raised p-2">
							{candidates.slice(0, maxExceptionRows).map((date) => {
								const id = `recurrence_occ_${date.getTime()}`;
								return (
									<li key={date.getTime()}>
										<label
											htmlFor={id}
											className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm tabular-nums hover:bg-surface-muted"
										>
											<input
												id={id}
												type="checkbox"
												className={CHECKBOX_CLASS}
												checked={!excluded.has(date.getTime())}
												onChange={(e) => toggleExdate(date, e.target.checked)}
											/>
											<span>
												{formatWeekday(date)} {formatDateOnly(date)}
											</span>
										</label>
									</li>
								);
							})}
						</ul>
						{candidates.length > maxExceptionRows && (
							<p className="text-xs text-ink-muted">
								{t(
									"poikkeuksetNaytetaanEnsimmaiset",
									"Listassa näytetään ensimmäiset {{count}} päivää.",
									{ count: maxExceptionRows },
								)}
							</p>
						)}
					</div>
				</details>
			)}
		</div>
	);
}

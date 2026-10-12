import { CheckCircle2, Eye, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Group } from "#/hooks/useGroups";
import type { ResourceAccessSummary } from "#/utils/resourceAccess";

interface AccessSummaryProps {
	summary: ResourceAccessSummary;
	groups: Group[] | undefined;
}

/** Plain-language statement of who can see, reserve and get confirmed for a resource */
export function AccessSummary({ summary, groups }: AccessSummaryProps) {
	const { t } = useTranslation();

	const names = (ids: string[]) =>
		ids
			.map((id) => groups?.find((g) => g.id === id)?.name)
			.filter(Boolean)
			.join(", ");

	const audience = (a: ResourceAccessSummary["see"]) => {
		switch (a.kind) {
			case "everyone":
				return t("kaikkiMyosVieraat", "Kaikki, myös kirjautumattomat");
			case "admins":
				return t("vainYllapitajat", "Vain ylläpitäjät");
			case "groups":
				return t("ryhmatJaYllapitajat", "{{groups}} ja ylläpitäjät", {
					groups: names(a.groupIds),
				});
		}
	};

	const confirm = () => {
		switch (summary.confirm.kind) {
			case "approval":
				return t("vahvistusYllapitajalta", "Ylläpitäjän hyväksynnällä");
			case "everyone":
				return t("vahvistuuHeti", "Heti ilman hyväksyntää");
			case "groups":
				return t(
					"vahvistuuHetiRyhmille",
					"Heti ryhmille {{groups}}, muille ylläpitäjän hyväksynnällä",
					{ groups: names(summary.confirm.groupIds) },
				);
		}
	};

	const rows: { icon: ReactNode; label: string; value: string }[] = [
		{
			icon: <Eye size={14} />,
			label: t("yhteenvetoNakee", "Näkee resurssin"),
			value: audience(summary.see),
		},
		{
			icon: <Users size={14} />,
			label: t("yhteenvetoVaraa", "Voi varata"),
			value: audience(summary.reserve),
		},
		{
			icon: <CheckCircle2 size={14} />,
			label: t("yhteenvetoVahvistuu", "Varaus vahvistuu"),
			value: confirm(),
		},
	];

	return (
		<dl
			aria-label={t("yhteenvetoOtsikko", "Kuka voi tehdä mitä")}
			className="p-3 space-y-1.5 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 rounded-md"
		>
			{rows.map((row) => (
				<div key={row.label} className="flex items-start gap-2 text-xs">
					<span className="mt-0.5 text-purple-600 dark:text-purple-400 shrink-0">
						{row.icon}
					</span>
					<dt className="font-medium text-stone-700 dark:text-stone-300 w-32 shrink-0">
						{row.label}
					</dt>
					<dd className="text-stone-900 dark:text-stone-100">{row.value}</dd>
				</div>
			))}
		</dl>
	);
}

import { CheckCircle2, Eye, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Callout } from "#/components/Callout";
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
		<Callout
			variant="info"
			title={t("yhteenvetoOtsikko", "Kuka voi tehdä mitä")}
		>
			<dl className="mt-1.5 space-y-1.5">
				{rows.map((row) => (
					<div key={row.label} className="flex items-start gap-2 text-sm">
						<span className="mt-0.5 shrink-0">{row.icon}</span>
						<dt className="w-36 shrink-0 font-medium">{row.label}</dt>
						<dd>{row.value}</dd>
					</div>
				))}
			</dl>
		</Callout>
	);
}

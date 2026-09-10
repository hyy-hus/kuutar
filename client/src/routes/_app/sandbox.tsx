// src/routes/sandbox.tsx
import { createFileRoute } from "@tanstack/react-router";
import { Plus, RefreshCcw, Search, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Input } from "#/components/Input";

export const Route = createFileRoute("/_app/sandbox")({
	component: SandboxPage,
});

function SandboxPage() {
	const { t } = useTranslation();
	return (
		<div className="p-8 max-w-4xl space-y-12">
			<h1 className="text-2xl font-bold">
				{t("componentSandbox", "Component Sandbox")}
			</h1>

			{/* Button Section */}
			<section className="space-y-4">
				<h2 className="text-lg font-semibold">{t("buttons", "Buttons")}</h2>
				<div className="flex flex-wrap gap-4 items-center">
					<Button variant="default">{t("default", "Default")}</Button>
					<Button variant="secondary">{t("secondary", "Secondary")}</Button>
					<Button variant="outline">{t("outline", "Outline")}</Button>
					<Button variant="ghost">{t("ghost", "Ghost")}</Button>
					<Button variant="danger">
						<Trash2 size={16} />
						<span>{t("poista", "Poista")}</span>
					</Button>
					<Button>
						<span>{t("pivit", "Päivitä")}</span>
						<RefreshCcw size={16} />
					</Button>
					<Button size="icon">
						<Plus size={16} />
					</Button>
					<Button size="sm"> small </Button>
					<Button size="md"> medium </Button>
					<Button size="lg"> large </Button>
				</div>
			</section>

			{/* Input Section */}
			<section className="space-y-6 max-w-lg">
				<h2 className="text-lg font-semibold">{t("inputs", "Inputs")}</h2>

				{/* Sizes */}
				<div className="space-y-3">
					<span className="text-xs font-mono text-stone-500">
						{t("sizesSmMdLg", "Sizes (sm, md, lg)")}
					</span>
					<Input
						size="sm"
						placeholder={t("pieniSyteSm", "Pieni syöte (sm)...")}
					/>
					<Input
						size="md"
						placeholder={t("normaaliSyteMd", "Normaali syöte (md)...")}
					/>
					<Input
						size="lg"
						placeholder={t("suuriSyteLg", "Suuri syöte (lg)...")}
					/>
				</div>

				{/* States */}
				<div className="space-y-3">
					<span className="text-xs font-mono text-stone-500">
						{t("statesErrorDisabled", "States (Error, Disabled)")}
					</span>
					<Input
						isError
						defaultValue="Virheellinen sähköposti"
						placeholder={t("sytShkposti", "Syötä sähköposti...")}
					/>
					<Input disabled value="Pois käytöstä" />
				</div>

				{/* Form Group Examples */}
				<div className="space-y-3">
					<span className="text-xs font-mono text-stone-500">
						{t("inlineFormAlignment", "Inline Form Alignment")}
					</span>
					<div className="flex gap-2">
						<Input placeholder="Etsi..." />
						<Button>
							<Search size={16} />
							<span>{t("hae", "Hae")}</span>
						</Button>
					</div>
				</div>
			</section>
		</div>
	);
}

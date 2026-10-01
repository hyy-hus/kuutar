import { AlertCircle, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Input } from "#/components/Input";
import { useAuth } from "#/hooks/useAuth";

interface SignInFormProps {
	onSuccess?: () => void;
}

export function SignInForm({ onSuccess }: SignInFormProps) {
	const { t } = useTranslation();
	const [mode, setMode] = useState<"otp" | "password">("otp");
	const [step, setStep] = useState<"request" | "verify">("request");

	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLocked, setIsLocked] = useState(false);

	const {
		login,
		requestOtp,
		verifyOtp,
		isLoggingIn,
		isRequestingOtp,
		isVerifyingOtp,
	} = useAuth();

	const handleRequestOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsLocked(false);
		try {
			await requestOtp({ email });
			setStep("verify");
		} catch (err: unknown) {
			const msg =
				err instanceof Error
					? err.message
					: t("koodinPyyntEpnnistui", "Koodin pyytäminen epäonnistui.");
			setError(msg);
			if (
				msg.toLowerCase().includes("lukittu") ||
				msg.toLowerCase().includes("locked")
			) {
				setIsLocked(true);
			}
		}
	};

	const handleVerifyOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsLocked(false);
		try {
			await verifyOtp({ email, code });
			onSuccess?.();
		} catch (err: unknown) {
			const msg =
				err instanceof Error
					? err.message
					: t("koodinVahvistusEpnnistui", "Koodin vahvistus epäonnistui.");
			setError(msg);
			if (
				msg.toLowerCase().includes("lukittu") ||
				msg.toLowerCase().includes("locked")
			) {
				setIsLocked(true);
			}
		}
	};

	const handlePasswordLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		try {
			await login({ email, password });
			onSuccess?.();
		} catch (err: unknown) {
			setError(
				err instanceof Error
					? err.message
					: t("kirjautuminenEpnnistui", "Kirjautuminen epäonnistui."),
			);
		}
	};

	return (
		<div className="space-y-4">
			{error &&
				(isLocked ? (
					<div className="p-3 text-xs bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-md text-amber-900 dark:text-amber-200 flex items-start gap-2">
						<ShieldAlert
							className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
							size={16}
						/>
						<div>
							<p className="font-semibold">
								{t("tiliLukittu", "Kirjautuminen estetty väliaikaisesti")}
							</p>
							<p className="mt-0.5 leading-relaxed">{error}</p>
						</div>
					</div>
				) : (
					<div className="p-2.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-md flex items-start gap-2">
						<AlertCircle className="text-red-500 shrink-0 mt-0.5" size={15} />
						<span>{error}</span>
					</div>
				))}

			{mode === "otp" ? (
				step === "request" ? (
					<form onSubmit={handleRequestOtp} className="space-y-3">
						<div>
							<label
								htmlFor="otp-email"
								className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1"
							>
								{t("shkposti", "Sähköposti")}
							</label>
							<Input
								id="otp-email"
								type="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder={t("esimSahkoposti", "nimi@esimerkki.fi")}
							/>
						</div>
						<Button
							type="submit"
							disabled={isLocked || isRequestingOtp}
							className="w-full"
						>
							{isRequestingOtp
								? t("lahetetaan", "Lähetetään...")
								: t("lahetaKirjautumiskoodi", "Lähetä kirjautumiskoodi")}
						</Button>
					</form>
				) : (
					<form onSubmit={handleVerifyOtp} className="space-y-3">
						<p className="text-xs text-stone-500">
							{t("koodiLahetettyOsoitteeseen", "Koodi lähetetty osoitteeseen")}{" "}
							<strong>{email}</strong>
						</p>
						<div>
							<label
								htmlFor="otp-code"
								className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1"
							>
								{t("syotaKoodi", "Syötä 6-numeroinen koodi")}
							</label>
							<Input
								id="otp-code"
								type="text"
								maxLength={6}
								required
								value={code}
								onChange={(e) => setCode(e.target.value)}
								placeholder="123456"
								className="text-center tracking-widest text-lg font-mono"
							/>
						</div>
						<Button
							type="submit"
							disabled={isLocked || isVerifyingOtp}
							className="w-full"
						>
							{isVerifyingOtp
								? t("tarkistetaan", "Tarkistetaan...")
								: t("vahvistaJaKirjaudu", "Vahvista ja kirjaudu")}
						</Button>
						<button
							type="button"
							onClick={() => setStep("request")}
							className="w-full text-center text-xs text-stone-500 hover:underline pt-1"
						>
							{t("muutaSahkopostia", "Muuta sähköpostiosoitetta")}
						</button>
					</form>
				)
			) : (
				<form onSubmit={handlePasswordLogin} className="space-y-3">
					<div>
						<label
							htmlFor="login-email"
							className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1"
						>
							{t("shkposti", "Sähköposti")}
						</label>
						<Input
							id="login-email"
							type="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder={t("esimSahkoposti", "nimi@esimerkki.fi")}
						/>
					</div>
					<div>
						<label
							htmlFor="login-password"
							className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1"
						>
							{t("salasana", "Salasana")}
						</label>
						<Input
							id="login-password"
							type="password"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</div>
					<Button type="submit" disabled={isLoggingIn} className="w-full">
						{isLoggingIn
							? t("kirjaudutaan", "Kirjaudutaan...")
							: t("kirjaudu", "Kirjaudu")}
					</Button>
				</form>
			)}

			<div className="pt-2 border-t border-stone-200 dark:border-stone-800 text-center">
				{mode === "otp" ? (
					<button
						type="button"
						onClick={() => {
							setMode("password");
							setError(null);
							setIsLocked(false);
						}}
						className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
					>
						{t("kirjauduSalasanalla", "Kirjaudu salasanalla")}
					</button>
				) : (
					<button
						type="button"
						onClick={() => {
							setMode("otp");
							setStep("request");
							setError(null);
							setIsLocked(false);
						}}
						className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
					>
						{t(
							"kirjauduKertakayttokoodilla",
							"Kirjaudu kertakäyttökoodilla (OTP)",
						)}
					</button>
				)}
			</div>
		</div>
	);
}

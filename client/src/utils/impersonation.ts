/**
 * Token storage for the signed-in session, and for an admin acting as another user
 * (impersonation): the admin's own tokens are set aside while the user's tokens are in use,
 * and put back when the admin returns.
 */

const ACCESS = "access_token";
const REFRESH = "refresh_token";
const EXPIRES_AT = "token_expires_at";
const STASH = "impersonator_tokens";

export interface TokenResponse {
	access_token: string;
	refresh_token: string;
	expires_in?: number;
}

interface Stash {
	access_token: string | null;
	refresh_token: string | null;
	token_expires_at: string | null;
	/** The user the admin was acting as, to return to their page */
	user_id: string;
}

export function storeTokens(tokens: TokenResponse, now = Date.now()) {
	localStorage.setItem(ACCESS, tokens.access_token);
	localStorage.setItem(REFRESH, tokens.refresh_token);
	const expiresAt = now + (tokens.expires_in ?? 900) * 1000;
	localStorage.setItem(EXPIRES_AT, String(expiresAt));
}

export function clearTokens() {
	localStorage.removeItem(ACCESS);
	localStorage.removeItem(REFRESH);
	localStorage.removeItem(EXPIRES_AT);
}

export function isImpersonating(): boolean {
	return readStash() !== null;
}

/** Sets the current (admin) tokens aside and switches to the tokens of `userId` */
export function beginImpersonation(userId: string, tokens: TokenResponse) {
	// Starting again from inside an impersonation must not overwrite the admin's tokens
	if (!isImpersonating()) {
		const stash: Stash = {
			access_token: localStorage.getItem(ACCESS),
			refresh_token: localStorage.getItem(REFRESH),
			token_expires_at: localStorage.getItem(EXPIRES_AT),
			user_id: userId,
		};
		localStorage.setItem(STASH, JSON.stringify(stash));
	}
	storeTokens(tokens);
}

/**
 * Puts the admin's own tokens back. Returns the id of the user the admin was acting as, or
 * null when no impersonation was going on (the current tokens are then left alone).
 */
export function endImpersonation(): string | null {
	const stash = readStash();
	if (!stash) return null;
	clearTokens();
	if (stash.access_token) localStorage.setItem(ACCESS, stash.access_token);
	if (stash.refresh_token) localStorage.setItem(REFRESH, stash.refresh_token);
	if (stash.token_expires_at)
		localStorage.setItem(EXPIRES_AT, stash.token_expires_at);
	localStorage.removeItem(STASH);
	return stash.user_id;
}

function readStash(): Stash | null {
	const raw = localStorage.getItem(STASH);
	if (!raw) return null;
	try {
		const stash = JSON.parse(raw) as Stash;
		return typeof stash?.user_id === "string" ? stash : null;
	} catch {
		return null;
	}
}

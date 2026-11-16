// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import {
	beginImpersonation,
	clearTokens,
	endImpersonation,
	isImpersonating,
	storeTokens,
} from "./impersonation";

const admin = { access_token: "admin-a", refresh_token: "admin-r" };
const user = { access_token: "user-a", refresh_token: "user-r" };

describe("impersonation token storage", () => {
	beforeEach(() => {
		localStorage.clear();
		storeTokens({ ...admin, expires_in: 900 }, 1_000);
	});

	it("stores the expiry time from expires_in", () => {
		expect(localStorage.getItem("token_expires_at")).toBe("901000");
	});

	it("switches to the user's tokens and back to the admin's", () => {
		beginImpersonation("user-1", user);
		expect(isImpersonating()).toBe(true);
		expect(localStorage.getItem("access_token")).toBe("user-a");
		expect(localStorage.getItem("refresh_token")).toBe("user-r");

		expect(endImpersonation()).toBe("user-1");
		expect(isImpersonating()).toBe(false);
		expect(localStorage.getItem("access_token")).toBe("admin-a");
		expect(localStorage.getItem("refresh_token")).toBe("admin-r");
		expect(localStorage.getItem("token_expires_at")).toBe("901000");
	});

	it("keeps the admin's tokens when started twice", () => {
		beginImpersonation("user-1", user);
		beginImpersonation("user-2", { access_token: "b", refresh_token: "c" });
		expect(endImpersonation()).toBe("user-1");
		expect(localStorage.getItem("access_token")).toBe("admin-a");
	});

	it("leaves normal sessions alone when nothing is stashed", () => {
		expect(endImpersonation()).toBeNull();
		expect(localStorage.getItem("access_token")).toBe("admin-a");
	});

	it("ignores a corrupt stash", () => {
		localStorage.setItem("impersonator_tokens", "{not json");
		expect(isImpersonating()).toBe(false);
		expect(endImpersonation()).toBeNull();
	});

	it("clears the current tokens", () => {
		clearTokens();
		expect(localStorage.getItem("access_token")).toBeNull();
		expect(localStorage.getItem("refresh_token")).toBeNull();
		expect(localStorage.getItem("token_expires_at")).toBeNull();
	});
});

import { describe, it, expect } from "vitest";
import { isDevMode } from "@/utils/env";

describe("env", () => {
    describe("isDevMode", () => {
        it("should return false in test mode", () => {
            expect(isDevMode()).toBe(false);
        });
    });

    describe("isMobileBackend", () => {
        it("should return boolean value", async () => {
            const { isMobileBackend } = await import("@/utils/env");
            const result = isMobileBackend();
            expect(typeof result).toBe("boolean");
        });
    });
});

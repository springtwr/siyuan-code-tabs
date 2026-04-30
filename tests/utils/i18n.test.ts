import { describe, it, expect } from "vitest";
import { t } from "@/utils/i18n";
import { createMockI18n } from "../helpers/test-data-factory";

describe("i18n", () => {
    describe("t", () => {
        describe("正常取值", () => {
            it("should return value for valid key", () => {
                const i18n = createMockI18n();
                expect(t(i18n, "title")).toBe("Code Tabs");
            });

            it("should return value for custom translations", () => {
                const i18n = createMockI18n({ custom: "Custom Value" });
                expect(t(i18n, "custom")).toBe("Custom Value");
            });

            it("should return fallback when key is missing in test mode", () => {
                const i18n = createMockI18n();
                expect(t(i18n, "missing", "fallback")).toBe("fallback");
            });

            it("should return key as fallback when no fallback provided", () => {
                const i18n = createMockI18n();
                expect(t(i18n, "missing")).toBe("missing");
            });
        });

        describe("测试环境降级处理", () => {
            it("should return fallback when i18n is undefined in test mode", () => {
                expect(t(undefined as unknown as Record<string, string>, "key", "fallback")).toBe(
                    "fallback"
                );
            });

            it("should return key when i18n is undefined and no fallback", () => {
                expect(t(undefined as unknown as Record<string, string>, "key")).toBe("key");
            });

            it("should return fallback when key is missing in test mode", () => {
                const i18n = createMockI18n();
                expect(t(i18n, "missing", "fallback")).toBe("fallback");
            });

            it("should return key when key is missing and no fallback", () => {
                const i18n = createMockI18n();
                expect(t(i18n, "missing")).toBe("missing");
            });

            it("should return fallback when key value is null in test mode", () => {
                const i18n = { key: null } as unknown as Record<string, string>;
                expect(t(i18n, "key", "fallback")).toBe("fallback");
            });

            it("should return fallback when key value is empty string", () => {
                const i18n = { key: "" };
                expect(t(i18n, "key", "fallback")).toBe("fallback");
            });
        });

        describe("边界条件", () => {
            it("should handle empty i18n object", () => {
                expect(t({}, "key", "fallback")).toBe("fallback");
            });

            it("should handle key with special characters", () => {
                const i18n = createMockI18n({ "key-with-dash": "value" });
                expect(t(i18n, "key-with-dash")).toBe("value");
            });

            it("should handle key with unicode characters", () => {
                const i18n = createMockI18n({ "中文键": "中文值" });
                expect(t(i18n, "中文键")).toBe("中文值");
            });

            it("should handle empty fallback", () => {
                const i18n = createMockI18n();
                expect(t(i18n, "missing", "")).toBe("");
            });

            it("should handle whitespace key", () => {
                const i18n = createMockI18n({ " ": "whitespace value" });
                expect(t(i18n, " ")).toBe("whitespace value");
            });

            it("should handle numeric key", () => {
                const i18n = { "123": "numeric value" };
                expect(t(i18n, "123")).toBe("numeric value");
            });
        });

        describe("类型安全", () => {
            it("should handle boolean fallback", () => {
                const i18n = createMockI18n();
                const result = t(i18n, "missing", "true");
                expect(result).toBe("true");
            });

            it("should handle long fallback", () => {
                const i18n = createMockI18n();
                const longFallback = "a".repeat(1000);
                expect(t(i18n, "missing", longFallback)).toBe(longFallback);
            });
        });
    });
});

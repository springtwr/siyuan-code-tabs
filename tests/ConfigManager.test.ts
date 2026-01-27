import { describe, expect, it } from "vitest";
import { buildConfigPayload, isRecord, mergeCustomConfig } from "@/modules/config/ConfigManager";

describe("ConfigManager helpers", () => {
    it("isRecord 仅接受对象", () => {
        expect(isRecord({})).toBe(true);
        expect(isRecord(null)).toBe(false);
        expect(isRecord("x")).toBe(false);
    });

    it("mergeCustomConfig 忽略非对象输入", () => {
        const target: Record<string, unknown> = { a: 1 };
        mergeCustomConfig(target, "invalid", { a: 1 });
        expect(target).toEqual({ a: 1 });
    });

    it("mergeCustomConfig 仅合并自定义字段", () => {
        const target: Record<string, unknown> = { kept: true };
        const reserved = { mode: "light" };
        const value = { mode: "dark", extra: 1 };
        mergeCustomConfig(target, value, reserved);
        expect(target).toEqual({ kept: true, extra: 1 });
    });

    it("buildConfigPayload 生成 JSON 字符串", () => {
        const payload = buildConfigPayload({ a: 1, b: "x" });
        expect(JSON.parse(payload)).toEqual({ a: 1, b: "x", configVersion: 1 });
    });
});

import { describe, expect, it } from "vitest";
import { compareConfig, getSiyuanConfig } from "@/utils/dom";

describe("dom utils", () => {
    it("compareConfig compares records", () => {
        expect(compareConfig({ a: 1 }, { a: 1 })).toBe(true);
        expect(compareConfig({ a: 1 }, { a: 2 })).toBe(false);
        expect(compareConfig({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it("getSiyuanConfig returns editor config", () => {
        const config = getSiyuanConfig();
        expect(config).toHaveProperty("fontSize");
        expect(config).toHaveProperty("codeLineWrap");
    });
});

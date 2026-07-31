import { describe, expect, it, vi } from "vitest";
import { TabData } from "@/core/TabData";
import { resolveLanguage } from "@/utils/language";
import type { CodeTabsMetadata } from "@/types/tabs";

describe("TabData", () => {
    it("encode/decode should roundtrip", () => {
        const data = TabData.createDefaultData();
        data.tabs[0].title = "JS";
        data.tabs[0].lang = "js";
        data.tabs[0].code = "console.log('ok')";

        const encoded = TabData.encode(data);
        const decoded = TabData.decode(encoded);

        expect(decoded).not.toBeNull();
        expect(decoded?.tabs[0].title).toBe("JS");
        expect(decoded?.tabs[0].lang).toBe("js");
        expect(decoded?.tabs[0].code).toBe("console.log('ok')");
    });

    it("normalizeLanguage falls back when hljs unknown", () => {
        const original = window.hljs;
        window.hljs = {
            ...original,
            getLanguage: vi.fn((lang: string) => (lang === "js" ? "js" : null)),
        } as unknown as typeof original;

        expect(resolveLanguage("js")).toBe("js");
        expect(resolveLanguage("unknown")).toBe("plaintext");

        window.hljs = original;
    });

    it("normalizeLanguage should not crash without hljs", () => {
        const win = window as unknown as { hljs?: typeof window.hljs };
        const original = win.hljs;
        win.hljs = undefined;
        expect(resolveLanguage("TypeScript")).toBe("typescript");
        win.hljs = original as typeof window.hljs;
    });

    it("validate reports missing fields", () => {
        const invalid = {
            active: 0,
            tabs: [{ title: "", lang: "", code: "" }],
        };
        const result = TabData.validate(invalid);
        expect(result.ok).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("upgradeFromLegacy converts tab syntax", () => {
        const legacy = `tab::: JS\nlang::: js\nconsole.log('ok')`;
        const upgraded = TabData.upgradeFromLegacy(legacy);
        expect(upgraded).not.toBeNull();
        expect(upgraded?.tabs[0].title).toBe("JS");
        expect(upgraded?.tabs[0].lang).toBe("js");
    });

    it("createDefaultData should not contain version field", () => {
        const data = TabData.createDefaultData();
        expect(data).not.toHaveProperty("version");
        expect(data.active).toBe(0);
        expect(data.tabs).toHaveLength(1);
    });

    it("decode should handle old data with version field", () => {
        const oldData = JSON.stringify({
            version: 2,
            active: 0,
            tabs: [{ title: "Old", lang: "js", code: "code" }],
        });
        const encoded = btoa(oldData);
        const decoded = TabData.decode(encoded);
        expect(decoded).not.toBeNull();
        expect(decoded).not.toHaveProperty("version");
        expect(decoded?.tabs[0].title).toBe("Old");
    });

    describe("Metadata", () => {
        it("createMetadata should have all required fields", () => {
            const metadata = TabData.createMetadata();
            expect(typeof metadata.id).toBe("string");
            expect(metadata.id.length).toBeGreaterThan(0);
            expect(typeof metadata.dataVersion).toBe("number");
            expect(metadata.dataVersion).toBeGreaterThan(0);
            expect(typeof metadata.htmlVersion).toBe("number");
            expect(metadata.htmlVersion).toBeGreaterThan(0);
        });

        it("createMetadata should generate unique ids", () => {
            const m1 = TabData.createMetadata();
            const m2 = TabData.createMetadata();
            expect(m1.id).not.toBe(m2.id);
        });

        it("createMetadata should keep existing id and refresh versions", () => {
            const existing: CodeTabsMetadata = {
                id: "stable-id",
                dataVersion: 0,
                htmlVersion: 0,
            };
            const refreshed = TabData.createMetadata(existing);
            expect(refreshed.id).toBe("stable-id");
            expect(refreshed.dataVersion).toBeGreaterThan(existing.dataVersion);
            expect(refreshed.htmlVersion).toBeGreaterThan(existing.htmlVersion);
        });

        it("createMetadata should generate new id when existing is null", () => {
            const created = TabData.createMetadata(null);
            expect(typeof created.id).toBe("string");
            expect(created.id.length).toBeGreaterThan(0);
        });

        it("encodeMetadata/decodeMetadata should roundtrip", () => {
            const metadata: CodeTabsMetadata = {
                id: "test-id-123",
                dataVersion: 2,
                htmlVersion: 2,
            };
            const encoded = TabData.encodeMetadata(metadata);
            // 编码后应为 Base64 字符串，不含 JSON 特殊字符
            expect(encoded).not.toContain("{");
            expect(encoded).not.toContain("\"");
            const decoded = TabData.decodeMetadata(encoded);
            expect(decoded).toEqual(metadata);
        });

        it("decodeMetadata should return null for empty string", () => {
            expect(TabData.decodeMetadata("")).toBeNull();
        });

        it("decodeMetadata should return null for invalid JSON", () => {
            expect(TabData.decodeMetadata("not-json")).toBeNull();
        });

        it("encodeTabSource/decodeTabSource should roundtrip", () => {
            const source = { id: "meta-1", order: 2, title: "JS" };
            const encoded = TabData.encodeTabSource(source);
            expect(encoded).not.toContain("{");
            expect(TabData.decodeTabSource(encoded)).toEqual(source);
        });

        it("decodeTabSource should return null for structurally invalid data", () => {
            expect(TabData.decodeTabSource(btoa(JSON.stringify({ id: 123 })))).toBeNull();
            expect(TabData.decodeTabSource(btoa(JSON.stringify("x")))).toBeNull();
            expect(TabData.decodeTabSource(btoa(JSON.stringify([])))).toBeNull();
        });

        it("isMetadataCurrent should return true for current metadata", () => {
            const metadata = TabData.createMetadata();
            expect(TabData.isMetadataCurrent(metadata)).toBe(true);
        });

        it("isMetadataCurrent should return false for null", () => {
            expect(TabData.isMetadataCurrent(null)).toBe(false);
        });

        it("isMetadataCurrent should return false when id is missing", () => {
            const metadata = { id: "", dataVersion: 99, htmlVersion: 99 } as CodeTabsMetadata;
            expect(TabData.isMetadataCurrent(metadata)).toBe(false);
        });

        it("isMetadataCurrent should return false when dataVersion is outdated", () => {
            const metadata: CodeTabsMetadata = {
                id: "some-id",
                dataVersion: 0,
                htmlVersion: 99,
            };
            expect(TabData.isMetadataCurrent(metadata)).toBe(false);
        });

        it("isMetadataCurrent should return false when htmlVersion is outdated", () => {
            const metadata: CodeTabsMetadata = {
                id: "some-id",
                dataVersion: 99,
                htmlVersion: 0,
            };
            expect(TabData.isMetadataCurrent(metadata)).toBe(false);
        });
    });
});

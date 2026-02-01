import { describe, expect, it, vi } from "vitest";
import { TabDataService } from "@/modules/tabs/TabDataService";
import { resolveLanguage } from "@/modules/tabs/language";

describe("TabDataService", () => {
    it("encode/decode should roundtrip", () => {
        const data = TabDataService.createDefaultData();
        data.tabs[0].title = "JS";
        data.tabs[0].lang = "js";
        data.tabs[0].code = "console.log('ok')";

        const encoded = TabDataService.encode(data);
        const decoded = TabDataService.decode(encoded);

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
            version: 2,
            active: 0,
            tabs: [{ title: "", lang: "", code: "" }],
        };
        const result = TabDataService.validate(invalid);
        expect(result.ok).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("upgradeFromLegacy converts tab syntax", () => {
        const legacy = `tab::: JS\nlang::: js\nconsole.log('ok')`;
        const upgraded = TabDataService.upgradeFromLegacy(legacy);
        expect(upgraded).not.toBeNull();
        expect(upgraded?.tabs[0].title).toBe("JS");
        expect(upgraded?.tabs[0].lang).toBe("js");
    });
});

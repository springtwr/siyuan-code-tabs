import { describe, expect, it, vi, beforeEach } from "vitest";
import { TabParser } from "@/modules/tabs/TabParser";

vi.mock("@/api", () => ({
    pushMsg: vi.fn().mockResolvedValue(undefined),
}));

const i18n = {
    headErrWhenCheckCode: "head",
    noTitleWhenCheckCode: "noTitle",
    noLangWhenCheckCode: "noLang",
    noCodeWhenCheckCode: "noCode",
};

describe("TabParser", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("parses new syntax", () => {
        const input = `::: JS | javascript | active
console.log("ok");

::: Python
print("ok")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(true);
        expect(result.code.length).toBe(2);
        expect(result.code[0].title).toContain("active");
        expect(result.code[0].language).toBe("javascript");
    });

    it("parses legacy syntax", () => {
        const input = `tab::: JS
lang::: js
console.log("ok")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(true);
        expect(result.code.length).toBe(1);
        expect(result.code[0].language).toBe("js");
    });

    it("rejects missing title", () => {
        const input = `:::
console.log("ok")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(false);
    });

    it("rejects missing code", () => {
        const input = `::: JS
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(false);
    });
});

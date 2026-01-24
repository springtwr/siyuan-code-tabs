import { describe, expect, it, vi, beforeEach } from "vitest";
import { TabParser } from "@/modules/tabs/TabParser";
import type { IObject } from "siyuan";

vi.mock("@/api", () => ({
    pushMsg: vi.fn().mockResolvedValue(undefined),
}));

const i18n = {
    headErrWhenCheckCode: "head",
    noTitleWhenCheckCode: "noTitle",
    noLangWhenCheckCode: "noLang",
    noCodeWhenCheckCode: "noCode",
} as unknown as IObject;

describe("TabParser 语法解析", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("解析新语法：多标签与 active", () => {
        const input = `::: JS | javascript | active
console.log("ok");

::: Python
print("ok")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(true);
        expect(result.code.length).toBe(2);
        expect(result.code[0].isActive).toBe(true);
        expect(result.code[0].language).toBe("javascript");
        expect(result.code[1].isActive).toBe(false);
        expect(result.code[1].language).toBe("python");
    });

    it("解析旧语法：带 lang 行", () => {
        const input = `tab::: JS
lang::: js
console.log("ok")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(true);
        expect(result.code.length).toBe(1);
        expect(result.code[0].language).toBe("js");
    });

    it("新语法：缺少标题应失败", () => {
        const input = `:::
console.log("ok")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(false);
    });

    it("新语法：缺少代码应失败", () => {
        const input = `::: JS
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(false);
    });

    it("非 ::: 或 tab::: 开头应失败", () => {
        const input = `:: title
console.log("ok")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(false);
    });

    it("新语法：缺少语言时自动推断", () => {
        const input = `::: TypeScript
const a = 1;
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(true);
        expect(result.code[0].language).toBe("typescript");
    });

    it("新语法：多余分隔符应忽略", () => {
        const input = `::: Demo | js | active | ignored
console.log("ok");
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(true);
        expect(result.code[0].isActive).toBe(true);
    });

    it("新语法：多 active 应失败", () => {
        const input = `::: JS | active
console.log("ok");

::: Python | active
print("ok")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(false);
    });

    it("新语法：标题下为空行应失败", () => {
        const input = `::: Title | js

`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(false);
    });

    it("旧语法：缺少标题应失败", () => {
        const input = `tab:::
lang::: js
console.log("ok")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(false);
    });

    it("旧语法：lang 值为空应失败", () => {
        const input = `tab::: JS
lang:::
console.log("ok")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(false);
    });

    it("旧语法：缺少代码内容应失败", () => {
        const input = `tab::: JS
lang::: js
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(false);
    });

    it("旧语法：lang 后空行也应失败", () => {
        const input = `tab::: JS
lang::: js

`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(false);
    });

    it("旧语法：无 lang 行时使用标题推断语言", () => {
        const input = `tab::: JS
console.log("ok")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(true);
        expect(result.code[0].language).toBe("js");
    });

    it("新语法：前置空行应正常解析", () => {
        const input = `

::: JS | js
console.log("ok")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(true);
        expect(result.code.length).toBe(1);
    });

    it("新语法：active 在语言前也应解析", () => {
        const input = `::: Title | active | js
console.log("ok");
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(true);
        expect(result.code[0].isActive).toBe(true);
        expect(result.code[0].language).toBe("js");
    });

    it("新语法：语言槽为空时使用标题推断", () => {
        const input = `::: Demo |  | active
console.log("ok");
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(true);
        expect(result.code[0].language).toBe("demo");
    });

    it("新语法：空头部应失败", () => {
        const input = `:::

console.log("ok")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(false);
    });

    it("旧语法：标题过短应失败", () => {
        const input = `tab:::
lang::: js
console.log("ok")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(false);
    });

    it("旧语法：标题包含 active 标记应解析为默认标签", () => {
        const input = `tab::: JS :::active
lang::: js
console.log("ok")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(true);
        expect(result.code[0].isActive).toBe(true);
    });

    it("旧语法：多 active 应失败", () => {
        const input = `tab::: JS :::active
lang::: js
console.log("ok")

tab::: Python :::active
lang::: python
print("ok")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(false);
    });

    it("新语法：多块应全部解析", () => {
        const input = `::: A | js
console.log("a");

::: B | python
print("b")
`;
        const result = TabParser.checkCodeText(input, i18n);
        expect(result.result).toBe(true);
        expect(result.code.length).toBe(2);
    });
});

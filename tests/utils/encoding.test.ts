import { describe, expect, it } from "vitest";
import {
    decodeJson,
    decodeSource,
    encodeJson,
    encodeSource,
    resolveCodeTextFromSqlBlock,
    stripCodeFence,
    stripInvisibleChars,
} from "@/utils/encoding";

describe("encoding", () => {
    it("encodes/decodes base64", () => {
        const input = "hello\nworld";
        const encoded = encodeSource(input);
        expect(encoded).not.toBe("");
        const decoded = decodeSource(encoded);
        expect(decoded).toBe(input);
    });

    it("encodeJson/decodeJson roundtrip", () => {
        const data = { id: "meta-1", order: 2, nested: { ok: true } };
        const encoded = encodeJson(data);
        expect(encoded).not.toContain("{");
        expect(decodeJson(encoded)).toEqual(data);
    });

    it("decodeJson returns null for empty or invalid input", () => {
        expect(decodeJson("")).toBeNull();
        expect(decodeJson("not-json")).toBeNull();
    });

    it("decodes legacy newline flag", () => {
        const legacy = "a⤵↩b";
        expect(decodeSource(legacy)).toBe("a\nb");
    });

    it("strips invisible chars", () => {
        const input = "a\u200bb\u200c\u200d\ufeff";
        expect(stripInvisibleChars(input)).toBe("ab");
    });

    it("strips code fence", () => {
        const input = "```js\nconsole.log(1)\n```";
        expect(stripCodeFence(input)).toBe("console.log(1)");
    });

    it("resolves code text from sql block", () => {
        expect(resolveCodeTextFromSqlBlock({ content: "a\nb" })).toBe("a\nb");
        const fenced = "```python\nprint(1)\n```";
        expect(resolveCodeTextFromSqlBlock({ content: "", markdown: fenced })).toBe("print(1)");
    });
});

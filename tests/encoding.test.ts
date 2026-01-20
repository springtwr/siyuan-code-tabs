import { describe, expect, it } from "vitest";
import { decodeSource, encodeSource, stripInvisibleChars } from "@/utils/encoding";

describe("encoding", () => {
    it("encodes/decodes base64", () => {
        const input = "hello\nworld";
        const encoded = encodeSource(input);
        expect(encoded).not.toBe("");
        const decoded = decodeSource(encoded);
        expect(decoded).toBe(input);
    });

    it("decodes legacy newline flag", () => {
        const legacy = "a⤵↩b";
        expect(decodeSource(legacy)).toBe("a\nb");
    });

    it("strips invisible chars", () => {
        const input = "a\u200bb\u200c\u200d\ufeff";
        expect(stripInvisibleChars(input)).toBe("ab");
    });
});

import { describe, expect, it, vi } from "vitest";
import { buildEditorDialogContent } from "@/modules/tabs/TabEditor";

vi.mock("@/utils/i18n", () => ({
    t: (_i18n: Record<string, string>, key: string) => key,
}));

describe("TabEditor helpers", () => {
    it("buildEditorDialogContent 生成基础结构", () => {
        const html = buildEditorDialogContent({});
        expect(html).toContain("code-tabs__editor");
        expect(html).toContain("data-action=\"add\"");
        expect(html).toContain("data-action=\"delete\"");
        expect(html).toContain("data-action=\"save\"");
        expect(html).toContain("data-field=\"title\"");
    });

    it("buildEditorDialogContent 使用 i18n key", () => {
        const html = buildEditorDialogContent({});
        expect(html).toContain("editor.add");
        expect(html).toContain("editor.delete");
        expect(html).toContain("editor.cancel");
        expect(html).toContain("editor.save");
    });
});

import { describe, expect, it, vi } from "vitest";
import { EditorRefreshService } from "@/services/EditorRefreshService";

describe("EditorRefreshService", () => {
    it("reloadActiveDocument 调用 activeEditor.reload", () => {
        const reload = vi.fn();
        const manager = new EditorRefreshService({
            getActiveEditor: () => ({ reload }),
        });
        manager.reloadActiveDocument();
        expect(reload).toHaveBeenCalledWith(true);
    });

    it("refreshOverflow 调用回调", () => {
        const refreshOverflow = vi.fn();
        const manager = new EditorRefreshService({
            getRefreshOverflow: () => refreshOverflow,
        });
        const root = document.createElement("div");
        manager.refreshOverflow(root);
        expect(refreshOverflow).toHaveBeenCalledWith(root);
    });
});

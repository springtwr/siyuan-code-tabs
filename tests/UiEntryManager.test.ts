import { describe, expect, it, vi } from "vitest";
import { UiEntryManager, buildSlashMenuHtml } from "@/modules/ui/UiEntryManager";

vi.mock("@/utils/i18n", () => ({
    t: (_i18n: Record<string, string>, key: string) => key,
}));

vi.mock("@/api", () => ({
    pushErrMsg: vi.fn(),
    updateBlock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/tabs/TabDataManager", () => ({
    TabDataManager: {
        createDefaultData: () => ({
            version: 1,
            active: 0,
            tabs: [{ title: "Tab1", lang: "plaintext", code: "code" }],
        }),
        writeToBlock: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock("@/modules/tabs/TabRenderer", () => ({
    TabRenderer: {
        createProtyleHtml: () => "<div>html</div>",
    },
}));

describe("UiEntryManager", () => {
    it("buildSlashMenuHtml 生成包含 i18n key 的 HTML", () => {
        const html = buildSlashMenuHtml({});
        expect(html).toContain("slash.tabs");
    });

    it("initTopBar 调用 addTopBar", () => {
        const addTopBar = vi.fn();
        const manager = new UiEntryManager({
            i18n: {},
            addTopBar,
            openSetting: vi.fn(),
            protyleSlash: [],
            onReload: vi.fn(),
        });
        manager.initTopBar();
        expect(addTopBar).toHaveBeenCalledTimes(1);
    });

    it("registerSlashMenu 注册入口项", () => {
        const protyleSlash: Array<{ id?: string; html?: string }> = [];
        const manager = new UiEntryManager({
            i18n: {},
            addTopBar: vi.fn(),
            openSetting: vi.fn(),
            protyleSlash: protyleSlash as never,
            onReload: vi.fn(),
        });
        manager.registerSlashMenu();
        expect(protyleSlash).toHaveLength(1);
        expect(protyleSlash[0].id).toBe("code-tabs");
    });
});

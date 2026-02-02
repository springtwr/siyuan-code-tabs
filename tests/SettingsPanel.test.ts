import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Setting } from "siyuan";
import { SettingsPanel } from "@/modules/settings/SettingsPanel";
import { PLUGIN_STYLE_ID, TAB_WIDTH_DEFAULT, TAB_WIDTH_SETTING_KEY } from "@/constants";

const createPanel = (data: Record<string, unknown>) =>
    new SettingsPanel({
        i18n: {},
        data,
        onAllTabsToCodeBlocks: vi.fn(),
        onUpgradeLegacyTabs: vi.fn(),
        onSaveConfig: vi.fn().mockResolvedValue(undefined),
        buildDebugToggle: () => document.createElement("input"),
    });

describe("SettingsPanel", () => {
    beforeEach(() => {
        const existing = document.getElementById(PLUGIN_STYLE_ID);
        if (existing) existing.remove();
        const styleEl = document.createElement("style");
        styleEl.id = PLUGIN_STYLE_ID;
        document.head.appendChild(styleEl);
    });

    it("ensureSettings 填充默认配置", () => {
        const data: Record<string, unknown> = {};
        const panel = createPanel(data);
        panel.ensureSettings();
        expect(data).toHaveProperty("codeTabsActiveColor", "");
        expect(data).toHaveProperty(TAB_WIDTH_SETTING_KEY);
    });

    it("applySettings 应用默认宽度", () => {
        const data: Record<string, unknown> = {};
        const panel = createPanel(data);
        panel.ensureSettings();
        panel.applySettings();
        const styleEl = document.getElementById(PLUGIN_STYLE_ID) as HTMLStyleElement | null;
        expect(styleEl?.innerHTML).toContain(`--code-tabs-max-width:${TAB_WIDTH_DEFAULT}ch`);
    });

    it("applySettings 支持 auto 模式", () => {
        const data: Record<string, unknown> = {
            [TAB_WIDTH_SETTING_KEY]: { mode: "auto", maxChars: 12 },
        };
        const panel = createPanel(data);
        panel.applySettings();
        const styleEl = document.getElementById(PLUGIN_STYLE_ID) as HTMLStyleElement | null;
        expect(styleEl?.innerHTML).toContain("--code-tabs-max-width:none");
    });

    it("init 注册设置项", () => {
        const data: Record<string, unknown> = {};
        const panel = createPanel(data);
        const addItem = vi.fn();
        panel.init({ addItem } as unknown as Setting);
        expect(addItem).toHaveBeenCalledTimes(5);
    });
});

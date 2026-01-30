import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Setting } from "siyuan";
import { SettingsPanel } from "@/modules/settings/SettingsPanel";
import { TAB_WIDTH_DEFAULT, TAB_WIDTH_SETTING_KEY } from "@/constants";

const createPanel = (data: Record<string, unknown>) =>
    new SettingsPanel({
        i18n: {},
        data,
        onAllTabsToPlainCode: vi.fn(),
        onUpgradeLegacyTabs: vi.fn(),
        onSaveConfig: vi.fn().mockResolvedValue(undefined),
        buildDebugToggle: () => document.createElement("input"),
    });

describe("SettingsPanel", () => {
    beforeEach(() => {
        document.documentElement.style.cssText = "";
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
        expect(document.documentElement.style.getPropertyValue("--code-tabs-max-width")).toBe(
            `${TAB_WIDTH_DEFAULT}ch`
        );
    });

    it("applySettings 支持 auto 模式", () => {
        const data: Record<string, unknown> = {
            [TAB_WIDTH_SETTING_KEY]: { mode: "auto", maxChars: 12 },
        };
        const panel = createPanel(data);
        panel.applySettings();
        expect(document.documentElement.style.getPropertyValue("--code-tabs-max-width")).toBe(
            "none"
        );
    });

    it("init 注册设置项", () => {
        const data: Record<string, unknown> = {};
        const panel = createPanel(data);
        const addItem = vi.fn();
        panel.init({ addItem } as unknown as Setting);
        expect(addItem).toHaveBeenCalledTimes(5);
    });
});

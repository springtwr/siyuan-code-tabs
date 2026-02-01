import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandManager } from "@/modules/command/CommandManager";
import type { TabConverter } from "@/modules/tabs/TabConverter";
import type { IMenu } from "siyuan";

const getSelectedElements = vi.fn();
vi.mock("@/utils/dom", () => ({
    getSelectedElements: (...args: unknown[]) => getSelectedElements(...args),
}));

const isDevMode = vi.fn(() => true);
vi.mock("@/utils/env", () => ({
    isDevMode: () => isDevMode(),
}));

const toggleEditorSetting = vi.fn();
vi.mock("@/modules/developer/DevToggleManager", () => ({
    DevToggleManager: { toggleEditorSetting: (...args: unknown[]) => toggleEditorSetting(...args) },
}));

vi.mock("@/utils/i18n", () => ({
    t: (_i18n: Record<string, string>, key: string) => key,
}));

describe("CommandManager", () => {
    beforeEach(() => {
        getSelectedElements.mockReset();
        isDevMode.mockReturnValue(true);
        toggleEditorSetting.mockReset();
    });

    it("registerCommands 注册两个命令并执行回调", () => {
        const tabConverter = {
            tabsToCodeBlocksBatch: vi.fn(),
            mergeCodeBlocksToTabSyntax: vi.fn(),
        } as unknown as TabConverter;
        const addCommand = vi.fn();
        getSelectedElements.mockReturnValue([document.createElement("div")]);

        const manager = new CommandManager({
            i18n: {},
            data: {},
            tabConverter,
            onReload: vi.fn(),
            addCommand,
        });

        manager.registerCommands();
        expect(addCommand).toHaveBeenCalledTimes(2);

        addCommand.mock.calls[0][0].editorCallback();
        expect(tabConverter.tabsToCodeBlocksBatch).toHaveBeenCalledTimes(1);

        addCommand.mock.calls[1][0].editorCallback();
        expect(tabConverter.mergeCodeBlocksToTabSyntax).toHaveBeenCalledTimes(1);
    });

    it("handleBlockIconEvent 构建开发菜单并触发开关", () => {
        const tabConverter = {
            tabsToCodeBlocksBatch: vi.fn(),
            mergeCodeBlocksToTabSyntax: vi.fn(),
            tabsToCodeBlocksInDocument: vi.fn(),
        } as unknown as TabConverter;
        const addCommand = vi.fn();
        const menuItems: IMenu[] = [];
        const node = document.createElement("div");
        node.dataset.type = "NodeHTMLBlock";
        node.setAttribute("data-custom", "true");

        const manager = new CommandManager({
            i18n: {},
            data: {},
            tabConverter,
            onReload: vi.fn(),
            addCommand,
        });

        manager.handleBlockIconEvent({
            menu: { addItem: (item) => menuItems.push(item) },
            blockElements: [node],
        });

        const devWrap = menuItems.find((item) => item.label === "menu.dev.toggleLineWrap");
        devWrap?.click?.(document.createElement("div"), new MouseEvent("click"));
        expect(toggleEditorSetting).toHaveBeenCalledWith(
            "codeLineWrap",
            expect.any(Object),
            expect.any(Function)
        );
    });

    it("handleBlockIconEvent 在非开发模式下不添加开发菜单", () => {
        isDevMode.mockReturnValue(false);
        const tabConverter = {
            tabsToCodeBlocksBatch: vi.fn(),
            mergeCodeBlocksToTabSyntax: vi.fn(),
        } as unknown as TabConverter;
        const menuItems: IMenu[] = [];

        const manager = new CommandManager({
            i18n: {},
            data: {},
            tabConverter,
            onReload: vi.fn(),
            addCommand: vi.fn(),
        });

        manager.handleBlockIconEvent({
            menu: { addItem: (item) => menuItems.push(item) },
            blockElements: [],
        });

        const hasDev = menuItems.some((item) => item.label === "menu.dev.toggleLineWrap");
        expect(hasDev).toBe(false);
    });
});

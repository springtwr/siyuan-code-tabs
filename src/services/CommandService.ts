import type { IMenu, IObject } from "siyuan";

import { CODE_TABS_DATA_ATTR, CUSTOM_ATTR } from "@/constants";
import { DevToggleService } from "./DevToggleService";
import type { TransformCore } from "@/core/TransformCore";
import { getSelectedElements } from "@/utils/dom";
import { t } from "@/utils/i18n";
import { isDevMode, isMobileBackend } from "@/utils/env";

/**
 * 命令与块菜单的注册与构建入口。
 * 副作用：注册菜单项，触发批量转换。
 */
type AddCommandFn = (command: {
    langKey: string;
    hotkey: string;
    editorCallback: () => void;
}) => void;

export type BlockIconEventDetail = {
    menu: {
        addItem: (item: IMenu) => void;
    };
    blockElements: HTMLElement[];
};

type CommandManagerOptions = {
    i18n: IObject;
    data: Record<string, unknown>;
    tabTransformManager: TransformCore;
    onReload: () => void;
    addCommand: AddCommandFn;
};

/**
 * 负责命令注册与块菜单构建。
 */
export class CommandService {
    private readonly i18n: IObject;
    private readonly data: Record<string, unknown>;
    private readonly tabTransformManager: TransformCore;
    private readonly onReload: () => void;
    private readonly addCommand: AddCommandFn;

    constructor(options: CommandManagerOptions) {
        this.i18n = options.i18n;
        this.data = options.data;
        this.tabTransformManager = options.tabTransformManager;
        this.onReload = options.onReload;
        this.addCommand = options.addCommand;
    }

    /**
     * 注册快捷命令（仅注册，不直接执行）。
     * @returns void
     */
    registerCommands(): void {
        this.addCommand({
            langKey: "menu.more.tabsToCodeBlocks",
            hotkey: "",
            editorCallback: () => {
                const blockList = getSelectedElements(
                    `[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}], [data-type="NodeHTMLBlock"][${CODE_TABS_DATA_ATTR}]`
                );
                this.tabTransformManager.tabsToCodeBlocksBatch(blockList);
            },
        });
        this.addCommand({
            langKey: "menu.more.mergeCodeBlocks",
            hotkey: "",
            editorCallback: () => {
                const blockList = getSelectedElements('[data-type="NodeCodeBlock"]');
                this.tabTransformManager.mergeCodeBlocksToTabSyntax(blockList);
            },
        });
    }

    /**
     * 处理块菜单事件，按当前选区构建菜单项。
     * @param detail 块菜单事件详情
     * @returns void
     */
    handleBlockIconEvent(detail: BlockIconEventDetail): void {
        this.buildBlockMenu(detail);
        this.buildDevMenu(detail);
    }

    private collectBlockElements(
        detail: BlockIconEventDetail,
        predicate: (item: HTMLElement) => boolean
    ): HTMLElement[] {
        const blockList: HTMLElement[] = [];
        for (const item of detail.blockElements) {
            const element = item as HTMLElement;
            if (predicate(element)) {
                blockList.push(element);
            }
        }
        return blockList;
    }

    /**
     * 构建与 tabs 相关的块菜单入口。
     * @param detail 块菜单事件详情
     * @returns void
     */
    private buildBlockMenu(detail: BlockIconEventDetail): void {
        if (isMobileBackend()) {
            detail.menu.addItem({
                icon: "iconCodeTabsMain",
                label: t(this.i18n, "menu.main.newTabs"),
                click: async () => {
                    const targetId = detail.blockElements[0]?.dataset?.nodeId ?? "";
                    const targetType = detail.blockElements[0]?.dataset?.type ?? "";
                    if (targetType !== "NodeParagraph") {
                        return;
                    }
                    await this.tabTransformManager.newTabs(targetId);
                    this.onReload();
                },
            });
            detail.menu.addItem({ type: "separator" });
        }
        detail.menu.addItem({
            icon: "iconCodeTabsMain",
            label: t(this.i18n, "menu.more.mergeCodeBlocks"),
            click: async () => {
                const blockList = getSelectedElements('[data-type="NodeCodeBlock"]');
                await this.tabTransformManager.mergeCodeBlocksToTabSyntax(blockList);
                this.onReload();
            },
        });
        detail.menu.addItem({
            icon: "iconCodeTabsMain",
            label: t(this.i18n, "menu.more.tabsToCodeBlocks"),
            click: () => {
                const blockList = this.collectBlockElements(detail, (item) => {
                    return (
                        (item.hasAttribute(`${CUSTOM_ATTR}`) ||
                            item.hasAttribute(`${CODE_TABS_DATA_ATTR}`)) &&
                        item.dataset?.type === "NodeHTMLBlock"
                    );
                });
                this.tabTransformManager.tabsToCodeBlocksBatch(blockList);
            },
        });
        detail.menu.addItem({ type: "separator" });
        detail.menu.addItem({
            icon: "iconCodeTabsMain",
            label: t(this.i18n, "menu.more.tabsToCodeBlocksInDocument"),
            click: () => {
                this.tabTransformManager.tabsToCodeBlocksInDocument();
            },
        });
    }

    /**
     * 仅在开发模式下暴露的菜单项。
     * @param detail 块菜单事件详情
     * @returns void
     */
    private buildDevMenu(detail: BlockIconEventDetail): void {
        if (!isDevMode()) {
            return;
        }
        detail.menu.addItem({ type: "separator" });
        detail.menu.addItem({
            iconHTML: "",
            label: t(this.i18n, "menu.dev.title"),
            type: "readonly",
        });
        detail.menu.addItem({
            iconHTML: "",
            label: t(this.i18n, "menu.dev.toggleLineWrap"),
            click: () => {
                DevToggleService.toggleEditorSetting("codeLineWrap", this.data, this.onReload);
            },
        });
        detail.menu.addItem({
            iconHTML: "",
            label: t(this.i18n, "menu.dev.toggleLigatures"),
            click: () => {
                DevToggleService.toggleEditorSetting("codeLigatures", this.data, this.onReload);
            },
        });
        detail.menu.addItem({
            iconHTML: "",
            label: t(this.i18n, "menu.dev.toggleLineNumber"),
            click: () => {
                DevToggleService.toggleEditorSetting(
                    "codeSyntaxHighlightLineNum",
                    this.data,
                    this.onReload
                );
            },
        });
    }
}

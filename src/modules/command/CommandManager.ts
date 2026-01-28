import type { IMenu, IObject } from "siyuan";

import { CODE_TABS_DATA_ATTR, CUSTOM_ATTR } from "@/constants";
import { DevToggleManager } from "@/modules/developer/DevToggleManager";
import type { TabConverter } from "@/modules/tabs/TabConverter";
import { getSelectedElements } from "@/utils/dom";
import { t } from "@/utils/i18n";
import { isDevMode } from "@/utils/env";

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
    tabConverter: TabConverter;
    onReload: () => void;
    addCommand: AddCommandFn;
};

export class CommandManager {
    private readonly i18n: IObject;
    private readonly data: Record<string, unknown>;
    private readonly tabConverter: TabConverter;
    private readonly onReload: () => void;
    private readonly addCommand: AddCommandFn;

    constructor(options: CommandManagerOptions) {
        this.i18n = options.i18n;
        this.data = options.data;
        this.tabConverter = options.tabConverter;
        this.onReload = options.onReload;
        this.addCommand = options.addCommand;
    }

    registerCommands(): void {
        this.addCommand({
            langKey: t(this.i18n, "menu.more.tabsToPlainCode"),
            hotkey: "",
            editorCallback: () => {
                const blockList = getSelectedElements(
                    `[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}], [data-type="NodeHTMLBlock"][${CODE_TABS_DATA_ATTR}]`
                );
                this.tabConverter.tabsToPlainCodeBlocksBatch(blockList);
            },
        });
        this.addCommand({
            langKey: t(this.i18n, "menu.more.mergeCodeBlocks"),
            hotkey: "",
            editorCallback: () => {
                const blockList = getSelectedElements('[data-type="NodeCodeBlock"]');
                this.tabConverter.mergeCodeBlocksToTabSyntax(blockList);
            },
        });
    }

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

    private buildBlockMenu(detail: BlockIconEventDetail): void {
        detail.menu.addItem({
            iconHTML: "",
            label: t(this.i18n, "menu.more.mergeCodeBlocks"),
            click: async () => {
                const blockList = getSelectedElements('[data-type="NodeCodeBlock"]');
                await this.tabConverter.mergeCodeBlocksToTabSyntax(blockList);
                this.onReload();
            },
        });
        detail.menu.addItem({
            iconHTML: "",
            label: t(this.i18n, "menu.more.tabsToPlainCode"),
            click: () => {
                const blockList = this.collectBlockElements(detail, (item) => {
                    return (
                        (item.hasAttribute(`${CUSTOM_ATTR}`) ||
                            item.hasAttribute(`${CODE_TABS_DATA_ATTR}`)) &&
                        item.dataset?.type === "NodeHTMLBlock"
                    );
                });
                this.tabConverter.tabsToPlainCodeBlocksBatch(blockList);
            },
        });
        detail.menu.addItem({ type: "separator" });
        detail.menu.addItem({
            iconHTML: "",
            label: t(this.i18n, "menu.more.tabsToPlainCodeInDocument"),
            click: () => {
                this.tabConverter.tabsToPlainCodeInDocument();
            },
        });
    }

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
                DevToggleManager.toggleEditorSetting("codeLineWrap", this.data, this.onReload);
            },
        });
        detail.menu.addItem({
            iconHTML: "",
            label: t(this.i18n, "menu.dev.toggleLigatures"),
            click: () => {
                DevToggleManager.toggleEditorSetting("codeLigatures", this.data, this.onReload);
            },
        });
        detail.menu.addItem({
            iconHTML: "",
            label: t(this.i18n, "menu.dev.toggleLineNumber"),
            click: () => {
                DevToggleManager.toggleEditorSetting(
                    "codeSyntaxHighlightLineNum",
                    this.data,
                    this.onReload
                );
            },
        });
    }
}

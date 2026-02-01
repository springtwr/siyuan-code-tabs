import type { IObject } from "siyuan";

import { pushErrMsg, updateBlock } from "@/api";
import { ICON_MAIN } from "@/constants";
import { TabDataService } from "@/modules/tabs/TabDataService";
import { TabRenderer } from "@/modules/tabs/TabRenderer";
import { t } from "@/utils/i18n";

/**
 * 顶部入口与斜杠菜单入口的统一管理。
 * 副作用：注册 UI 入口、更新块内容。
 */
type TopBarOptions = {
    icon: string;
    title: string;
    position: "left" | "right";
    callback: () => void;
};

type SlashMenuItem = {
    filter: string[];
    html: string;
    id: string;
    callback: (_protyle: unknown, nodeElement?: HTMLElement) => void | Promise<void>;
};

type UiEntryManagerOptions = {
    i18n: IObject;
    addTopBar: (options: TopBarOptions) => void;
    openSetting: () => void;
    protyleSlash: SlashMenuItem[];
    onReload: () => void;
};

/**
 * 构建斜杠菜单展示 HTML。
 * @param i18n i18n 资源
 * @returns HTML 字符串
 */
export function buildSlashMenuHtml(i18n: IObject): string {
    const slashIcon = ICON_MAIN.replace("<svg", '<svg class="b3-list-item__graphic"');
    return `<div class="b3-list-item__first">${slashIcon}<span class="b3-list-item__text">${t(
        i18n,
        "slash.tabs"
    )}</span></div>`;
}

/**
 * 负责注册顶部按钮与斜杠菜单入口。
 */
export class UiEntryManager {
    private readonly i18n: IObject;
    private readonly addTopBar: (options: TopBarOptions) => void;
    private readonly openSetting: () => void;
    private readonly protyleSlash: SlashMenuItem[];
    private readonly onReload: () => void;

    constructor(options: UiEntryManagerOptions) {
        this.i18n = options.i18n;
        this.addTopBar = options.addTopBar;
        this.openSetting = options.openSetting;
        this.protyleSlash = options.protyleSlash;
        this.onReload = options.onReload;
    }

    /**
     * 注册顶部按钮入口。
     * @returns void
     */
    initTopBar(): void {
        this.addTopBar({
            icon: ICON_MAIN,
            title: "code-tabs",
            position: "right",
            callback: () => {
                this.openSetting();
            },
        });
    }

    /**
     * 注册斜杠菜单入口，插入默认 Tabs 块。
     * @returns void
     */
    registerSlashMenu(): void {
        this.protyleSlash.push({
            filter: ["bq", "tabs", "标签页"],
            html: buildSlashMenuHtml(this.i18n),
            id: "code-tabs",
            callback: async (_protyle, nodeElement) => {
                if (!window.hljs) {
                    await TabRenderer.ensureLibraryLoaded("hljs");
                }
                const data = TabDataService.createDefaultData();
                const htmlBlock = await TabRenderer.createProtyleHtml(data);
                const targetId = nodeElement?.dataset?.nodeId ?? "";
                if (targetId) {
                    await updateBlock("markdown", htmlBlock, targetId);
                    await TabDataService.writeToBlock(targetId, data);
                    this.onReload();
                    return;
                }
                pushErrMsg(t(this.i18n, "msg.noTargetBlock"));
            },
        });
    }
}

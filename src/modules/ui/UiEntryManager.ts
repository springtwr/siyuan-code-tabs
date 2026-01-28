import type { IObject } from "siyuan";

import { pushErrMsg, updateBlock } from "@/api";
import { settingIconMain } from "@/constants";
import { TabDataManager } from "@/modules/tabs/TabDataManager";
import { ensureLibraryLoaded, TabRenderer } from "@/modules/tabs/TabRenderer";
import { t } from "@/utils/i18n";

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

export function buildSlashMenuHtml(i18n: IObject): string {
    const slashIcon = settingIconMain.replace(
        "<svg",
        '<svg class="b3-list-item__graphic"'
    );
    return `<div class="b3-list-item__first">${slashIcon}<span class="b3-list-item__text">${t(
        i18n,
        "slash.tabs"
    )}</span></div>`;
}

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

    initTopBar(): void {
        this.addTopBar({
            icon: settingIconMain,
            title: "code-tabs",
            position: "right",
            callback: () => {
                this.openSetting();
            },
        });
    }

    registerSlashMenu(): void {
        this.protyleSlash.push({
            filter: ["bq", "tabs", "标签页"],
            html: buildSlashMenuHtml(this.i18n),
            id: "code-tabs",
            callback: async (_protyle, nodeElement) => {
                if (!window.hljs) {
                    await ensureLibraryLoaded("```\n\n```");
                }
                const data = TabDataManager.createDefaultData();
                const htmlBlock = await TabRenderer.createProtyleHtml(data);
                const targetId = nodeElement?.dataset?.nodeId ?? "";
                if (targetId) {
                    await updateBlock("markdown", htmlBlock, targetId);
                    await TabDataManager.writeToBlock(targetId, data);
                    this.onReload();
                    return;
                }
                pushErrMsg(t(this.i18n, "msg.noTargetBlock"));
            },
        });
    }
}

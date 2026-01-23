import { getBlockAttrs, pushErrMsg, pushMsg, updateBlock } from "@/api";
import { CUSTOM_ATTR, TAB_SEPARATOR } from "@/constants";
import { decodeSource } from "@/utils/encoding";
import logger from "@/utils/logger";
import { t } from "@/utils/i18n";
import { TabParser } from "./TabParser";
import { IObject } from "siyuan";
import { StyleProbe } from "../theme/StyleProbe";
import { LineNumberManager } from "@/modules/line-number/LineNumberManager";

export function getCodeFromAttribute(block_id: string, customAttribute: string, i18n: IObject) {
    let codeText = decodeSource(customAttribute);
    if (!codeText) {
        logger.info(`标签页转为代码块失败，未找到源码: id ${block_id}`);
        pushErrMsg(`${t(i18n, "msg.allTabsToCodeFailed")}: ${block_id}`);
        return;
    }
    // 转换时顺带自动更新语法格式
    if (codeText.trim().startsWith("tab:::")) {
        const parsed = TabParser.checkCodeText(codeText, i18n);
        if (parsed.result) {
            codeText = TabParser.generateNewSyntax(parsed.code);
        }
    }
    if (codeText[codeText.length - 1] !== "\n") {
        codeText = codeText + "\n";
    }
    return codeText;
}

async function copyTextToClipboard(text: string, i18n: IObject) {
    const content = text ?? "";
    const tryNative = async () => {
        if (!navigator?.clipboard?.writeText) return false;
        try {
            await navigator.clipboard.writeText(content);
            return true;
        } catch (error) {
            logger.warn("调用 clipboard.writeText 失败", { error });
            return false;
        }
    };

    const nativeOk = await tryNative();
    if (nativeOk) {
        pushMsg(t(i18n, "msg.copyToClipboard"), 2000).then();
        return;
    }
    pushErrMsg(t(i18n, "msg.copyToClipboardFailed"));
}

export class TabManager {
    static initGlobalFunctions(i18n: IObject) {
        logger.debug("初始化全局 Tabs 交互函数");
        window.pluginCodeTabs = {
            codeBlockStyle: StyleProbe,
            openTag: (evt: MouseEvent) => {
                const clicked = evt.target as HTMLElement;
                const tabContainer = clicked.closest(".tabs-container") as HTMLElement | null;
                if (!tabContainer) return;
                const tabItems = tabContainer.querySelectorAll(".tab-item");
                const tabContents = tabContainer.querySelectorAll(".tab-content");
                tabItems.forEach((tabItem: HTMLElement, index: number) => {
                    if (tabItem === clicked) {
                        tabItem.classList.add("tab-item--active");
                        tabContents[index].classList.add("tab-content--active");
                    } else {
                        tabItem.classList.remove("tab-item--active");
                        tabContents[index].classList.remove("tab-content--active");
                    }
                });
                logger.debug("切换标签页", { index: Array.from(tabItems).indexOf(clicked) });
                LineNumberManager.refreshActive(tabContainer);
            },

            copyCode: async (evt: MouseEvent) => {
                const trigger = (evt.currentTarget || evt.target) as HTMLElement | null;
                if (!trigger) return;
                const tabContainer = trigger.closest(".tabs-container");
                if (!tabContainer) return;
                const tabContent = tabContainer.querySelector<HTMLElement>(".tab-content--active");
                if (!tabContent) return;
                logger.debug("触发复制代码");

                const rawEncoded = tabContent.dataset.raw;
                if (rawEncoded !== undefined) {
                    await copyTextToClipboard(decodeSource(rawEncoded), i18n);
                    return;
                }

                if (tabContent.querySelector(".markdown-body")) {
                    pushErrMsg(t(i18n, "msg.copyNeedRegenTabs"));
                    return;
                }

                const codeEl = tabContent.querySelector(".code");
                const codeText = codeEl?.textContent ?? tabContent.textContent ?? "";
                await copyTextToClipboard(codeText, i18n);
            },

            toggle: (evt: MouseEvent) => {
                let parent: Node = evt.target as Node;
                while (parent && parent.parentNode) {
                    parent = parent.parentNode;
                }
                if (!parent || !(parent instanceof ShadowRoot)) return;
                const host = parent.host;
                if (!host || !host.parentNode || !host.parentNode.parentNode) return;
                const htmlBlock = host.parentNode.parentNode as HTMLElement;
                const nodeId = htmlBlock.dataset.nodeId;

                getBlockAttrs(nodeId).then((res) => {
                    if (!res) return;
                    const codeText = getCodeFromAttribute(nodeId, res[`${CUSTOM_ATTR}`], i18n);
                    const flag = TAB_SEPARATOR;
                    updateBlock("markdown", `${flag}tab\n${codeText}${flag}`, nodeId).then(() => {
                        logger.info(`标签页转为代码块: id ${nodeId}`);
                    });
                });
            },

            wheelTag: (evt: WheelEvent) => {
                let tabs = (evt.target as HTMLElement).closest(".tabs") as HTMLElement;
                evt.preventDefault();
                const hasHorizontalScroll = tabs.scrollWidth > tabs.clientWidth;
                if (hasHorizontalScroll) {
                    tabs.scrollLeft += evt.deltaY;
                }
            },

            startX: 0,
            scrollLeft: 0,
            isDragging: false,
            rafId: null,
            touchStart: function (evt: TouchEvent) {
                evt.stopPropagation();
                const tabs = (evt.target as HTMLElement).closest(".tabs") as HTMLElement;
                if (tabs.scrollWidth <= tabs.clientWidth) return;

                const touch = evt.touches[0];
                this.startX = touch.pageX;
                this.scrollLeft = tabs.scrollLeft;
                this.isDragging = true;
                tabs.addEventListener("touchmove", this.touchMove, { passive: true });
            },

            touchMove: function (evt: TouchEvent) {
                const tabs = (evt.target as HTMLElement).closest(".tabs") as HTMLElement;
                if (!this.isDragging) return;

                const touch = evt.touches[0];
                const deltaX = touch.pageX - this.startX;
                if (this.rafId) cancelAnimationFrame(this.rafId);
                this.rafId = requestAnimationFrame(() => {
                    tabs.scrollLeft = this.scrollLeft - deltaX;
                });
            },

            touchEnd: function (evt: TouchEvent) {
                const tabs = (evt.target as HTMLElement).closest(".tabs") as HTMLElement;
                tabs.removeEventListener("touchmove", this.touchMove);
                this.isDragging = false;
            },
        };
    }
}

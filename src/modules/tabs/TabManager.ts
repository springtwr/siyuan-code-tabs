import { IObject, Menu } from "siyuan";

import { getBlockAttrs, pushErrMsg, pushMsg, updateBlock } from "@/api";
import { CODE_TABS_DATA_ATTR, CUSTOM_ATTR } from "@/constants";
import { LineNumberManager } from "@/modules/line-number/LineNumberManager";
import { decodeSource } from "@/utils/encoding";
import { isMobileBackend } from "@/utils/env";
import { t } from "@/utils/i18n";
import logger from "@/utils/logger";

import { StyleProbe } from "../theme/StyleProbe";
import { TabDataService } from "./TabDataService";
import { TabEditor } from "./TabEditor";
import { TabRenderer } from "./TabRenderer";
import type { TabsData } from "./types";

/**
 * 优先从 DOM 读取，再回退到属性；必要时升级旧数据。
 * @param nodeId 块 ID
 * @param htmlBlock HTML 块
 * @returns TabsData 或 null
 */
async function resolveTabsData(
    nodeId: string,
    htmlBlock: HTMLElement | null
): Promise<TabsData | null> {
    const dataFromDom = TabDataService.readFromElement(htmlBlock);
    if (dataFromDom) return dataFromDom;
    const attrs = await getBlockAttrs(nodeId);
    const dataFromAttr = TabDataService.readFromAttrs(attrs);
    if (dataFromAttr) return dataFromAttr;
    const legacy = TabDataService.decodeLegacySourceFromAttrs(attrs);
    if (legacy) {
        const upgraded = TabDataService.upgradeFromLegacy(legacy);
        if (upgraded) {
            await TabDataService.writeToBlock(nodeId, upgraded);
            return upgraded;
        }
    }
    return null;
}

/**
 * 写入 HTML 与属性，并触发可选刷新。
 * 副作用：更新块内容、写入属性。
 * @param nodeId 块 ID
 * @param data tabs 数据
 * @param onReload 可选刷新回调
 * @returns Promise<void>
 */
async function persistTabsData(
    nodeId: string,
    data: TabsData,
    onReload?: () => void
): Promise<void> {
    const htmlBlock = await TabRenderer.createProtyleHtml(data);
    await updateBlock("markdown", htmlBlock, nodeId);
    await TabDataService.writeToBlock(nodeId, data);
    onReload?.();
}

/**
 * 复制文本到剪贴板，优先使用原生 API，失败时回退到 execCommand。
 * @param text 文本内容
 * @param i18n i18n 资源
 * @returns Promise<void>
 */
async function copyTextToClipboard(text: string, i18n: IObject): Promise<void> {
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
    const tryExecCommand = () => {
        try {
            const textarea = document.createElement("textarea");
            textarea.value = content;
            textarea.setAttribute("readonly", "true");
            textarea.style.position = "fixed";
            textarea.style.top = "-1000px";
            textarea.style.left = "-1000px";
            document.body.appendChild(textarea);
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length);
            const ok = document.execCommand?.("copy") === true;
            document.body.removeChild(textarea);
            return ok;
        } catch (error) {
            logger.warn("调用 execCommand('copy') 失败", { error });
            return false;
        }
    };

    const nativeOk = await tryNative();
    if (nativeOk) {
        pushMsg(t(i18n, "msg.copyToClipboard"), 2000).then();
        return;
    }
    const legacyOk = tryExecCommand();
    if (legacyOk) {
        pushMsg(t(i18n, "msg.copyToClipboard"), 2000).then();
        return;
    }
    pushErrMsg(t(i18n, "msg.copyToClipboardFailed"));
}

/**
 * 释放当前焦点，避免移动端输入法误触发。
 * @returns void
 */
function blurActiveElementOnMobile(): void {
    if (!isMobileBackend()) return;
    const active = document.activeElement as HTMLElement | null;
    if (active && typeof active.blur === "function") {
        active.blur();
    }
}

/**
 * 从事件目标定位 HTML 块宿主，兼容 ShadowRoot。
 * @param target 事件目标
 * @returns HTML 块元素或 null
 */
function getHtmlBlockFromEventTarget(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) return null;
    const direct = target.closest('[data-node-id][data-type="NodeHTMLBlock"]');
    if (direct instanceof HTMLElement) return direct;
    const tabContainer = target.closest(".tabs-container");
    if (!tabContainer) return null;
    const root = tabContainer.getRootNode();
    if (!(root instanceof ShadowRoot)) return null;
    const host = root.host;
    return host instanceof HTMLElement ? findHtmlBlockFromHost(host) : null;
}

/**
 * 向上查找包含 tabs 数据属性的 HTML 块。
 * @param host Shadow host
 * @returns HTML 块元素或 null
 */
function findHtmlBlockFromHost(host: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = host;
    while (current) {
        if (
            current.dataset?.nodeId &&
            (current.dataset.type === "NodeHTMLBlock" ||
                current.hasAttribute(CUSTOM_ATTR) ||
                current.hasAttribute(CODE_TABS_DATA_ATTR))
        ) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
}

/**
 * tabs 交互与全局函数注册入口。
 * 副作用：注册全局函数、监听尺寸变化。
 */
export class TabManager {
    private static resizeObserver: ResizeObserver | null = null;

    static initGlobalFunctions(
        i18n: IObject,
        onReload?: () => void
    ): {
        refreshOverflow: (root?: HTMLElement | ShadowRoot) => void;
    } {
        logger.debug("初始化全局 Tabs 交互函数");
        const activateTabById = (tabContainer: HTMLElement, tabId: string) => {
            const tabItems = tabContainer.querySelectorAll<HTMLElement>(".tab-item[data-tab-id]");
            const tabContents = tabContainer.querySelectorAll<HTMLElement>(".tab-content");
            tabItems.forEach((tabItem) => {
                if (tabItem.dataset.tabId === tabId) {
                    tabItem.classList.add("tab-item--active");
                } else {
                    tabItem.classList.remove("tab-item--active");
                }
            });
            tabContents.forEach((content) => {
                if (content.dataset.tabId === tabId) {
                    content.classList.add("tab-content--active");
                } else {
                    content.classList.remove("tab-content--active");
                }
            });
            refreshOverflowForContainer(tabContainer);
            LineNumberManager.refreshActive(tabContainer);
        };

        const createMoreTab = () => {
            const moreItem = document.createElement("div");
            moreItem.className = "tab-item tab-item--more";
            moreItem.textContent = t(i18n, "label.moreTabs");
            return moreItem;
        };

        const openMoreMenu = (evt: MouseEvent, tabContainer: HTMLElement) => {
            evt.preventDefault();
            evt.stopPropagation();
            const hiddenTabs = Array.from(
                tabContainer.querySelectorAll<HTMLElement>(".tab-item--hidden")
            );
            if (hiddenTabs.length === 0) return;
            const menu = new Menu();
            hiddenTabs.forEach((tabItem) => {
                const tabId = tabItem.dataset.tabId ?? "";
                if (!tabId) return;
                menu.addItem({
                    label: tabItem.title || tabItem.textContent || `Tab${tabId}`,
                    click: () => {
                        activateTabById(tabContainer, tabId);
                    },
                });
            });
            const anchor = (evt.target as HTMLElement | null)?.closest<HTMLElement>(
                ".tab-item--more"
            );
            if (anchor) {
                const rect = anchor.getBoundingClientRect();
                menu.open({ x: rect.left, y: rect.bottom });
                return;
            }
            menu.open({ x: evt.clientX, y: evt.clientY });
        };

        // 计算可见 tab 并决定是否显示 “更多” 溢出入口
        const refreshOverflowForContainer = (tabContainer: HTMLElement) => {
            const tabsEl = tabContainer.querySelector<HTMLElement>(".tabs");
            if (!tabsEl) return;
            observeTabs(tabsEl);
            const allTabs = Array.from(
                tabsEl.querySelectorAll<HTMLElement>(".tab-item[data-tab-id]")
            );
            const moreGap = 6;
            if (allTabs.length === 0) {
                tabContainer.classList.remove("tabs-container--has-more");
                tabContainer.classList.remove("tabs-container--icon-sink");
                tabsEl.style.removeProperty("--code-tabs-more-width");
                return;
            }
            const existingMore = tabsEl.querySelector<HTMLElement>(".tab-item--more");
            if (existingMore) existingMore.remove();
            allTabs.forEach((item) => {
                item.classList.remove("tab-item--hidden");
                item.style.removeProperty("width");
            });
            tabContainer.classList.remove("tabs-container--has-more", "tabs-container--icon-sink");
            tabsEl.style.removeProperty("--code-tabs-more-width");

            const fullAvailable = tabsEl.clientWidth;
            if (fullAvailable <= 0) {
                return;
            }

            const widths = allTabs.map((item) => item.getBoundingClientRect().width);
            const tabsRect = tabsEl.getBoundingClientRect();
            const lastTab = allTabs[allTabs.length - 1];
            const lastRect = lastTab.getBoundingClientRect();
            const lastRight = lastRect.right - tabsRect.left;
            const iconGroup = tabContainer.querySelector<HTMLElement>(".code-tabs--icon_group");
            const iconRect = iconGroup?.getBoundingClientRect();
            const iconLeft = iconRect ? iconRect.left - tabsRect.left : Number.POSITIVE_INFINITY;
            const fontSize = Number.parseFloat(getComputedStyle(lastTab).fontSize) || 12;
            const sinkThreshold = fontSize;
            const shouldSink = lastRight > iconLeft + sinkThreshold;
            const shouldShowMore = lastRight > fullAvailable;
            if (shouldSink || shouldShowMore) {
                tabContainer.classList.add("tabs-container--icon-sink");
            } else {
                tabContainer.classList.remove("tabs-container--icon-sink");
            }
            if (!shouldShowMore) {
                return;
            }

            const moreItem = createMoreTab();
            moreItem.style.visibility = "hidden";
            moreItem.style.position = "absolute";
            tabsEl.appendChild(moreItem);
            const moreWidth = moreItem.getBoundingClientRect().width;
            moreItem.remove();
            moreItem.style.visibility = "";
            moreItem.style.position = "";
            tabsEl.style.setProperty("--code-tabs-more-width", `${Math.ceil(moreWidth)}px`);

            const availableForMore = Math.max(0, fullAvailable - moreWidth - moreGap);
            let used = 0;
            let visibleCount = 0;
            for (const width of widths) {
                if (used + width <= availableForMore || visibleCount === 0) {
                    used += width;
                    visibleCount += 1;
                } else {
                    break;
                }
            }
            if (visibleCount >= allTabs.length) {
                tabContainer.classList.remove("tabs-container--has-more");
                tabsEl.style.removeProperty("--code-tabs-more-width");
                return;
            }
            if (visibleCount > 0) {
                const visibleLastIndex = visibleCount - 1;
                const visibleLast = allTabs[visibleLastIndex];
                const visibleWidth = widths[visibleLastIndex];
                const visibleMinWidth =
                    Number.parseFloat(getComputedStyle(visibleLast).minWidth) || 0;
                const availableForLast = availableForMore - (used - visibleWidth);
                if (availableForLast <= 0 || availableForLast < visibleMinWidth) {
                    if (visibleCount > 1) {
                        visibleCount -= 1;
                    }
                } else if (visibleWidth <= moreWidth + moreGap) {
                    if (visibleCount > 1) {
                        visibleCount -= 1;
                    }
                } else if (visibleWidth > availableForLast) {
                    visibleLast.style.width = `${Math.floor(availableForLast)}px`;
                }
            }
            allTabs.slice(visibleCount).forEach((item) => item.classList.add("tab-item--hidden"));
            tabContainer.classList.add("tabs-container--has-more");
            if (!tabsEl.dataset.moreMenuBound) {
                tabsEl.addEventListener("click", (event) => {
                    const target = event.target as HTMLElement;
                    const more = target.closest<HTMLElement>(".tab-item--more");
                    if (!more) return;
                    openMoreMenu(event as MouseEvent, tabContainer);
                });
                tabsEl.dataset.moreMenuBound = "true";
            }
            tabsEl.appendChild(moreItem);

            const activeHidden = allTabs
                .slice(visibleCount)
                .some((item) => item.classList.contains("tab-item--active"));
            moreItem.classList.toggle("tab-item--more-active", activeHidden);
        };

        // 统一 ResizeObserver，避免多实例带来的性能损耗
        const setupResizeObserver = () => {
            if (TabManager.resizeObserver) return;
            let timer: ReturnType<typeof setTimeout> | null = null;
            TabManager.resizeObserver = new ResizeObserver((entries) => {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    for (const entry of entries) {
                        const tabsEl = entry.target as HTMLElement;
                        const container = tabsEl.closest<HTMLElement>(".tabs-container");
                        if (container) {
                            refreshOverflowForContainer(container);
                        }
                    }
                }, 100);
            });
        };

        const observeTabs = (tabsEl: HTMLElement) => {
            if (!TabManager.resizeObserver) setupResizeObserver();
            TabManager.resizeObserver?.observe(tabsEl);
        };

        /**
         * 刷新 tabs 溢出状态（支持文档与 ShadowRoot）。
         * @param root 根节点
         * @returns void
         */
        const refreshOverflow = (root?: HTMLElement | ShadowRoot) => {
            const scope: HTMLElement | ShadowRoot | Document = root ?? document;
            const scan = (containerRoot: ParentNode) => {
                const containers = containerRoot.querySelectorAll<HTMLElement>(".tabs-container");
                containers.forEach((container) => refreshOverflowForContainer(container));
            };
            if (scope instanceof ShadowRoot) {
                scan(scope);
                return;
            }
            scan(scope);
            const hosts = (scope as ParentNode).querySelectorAll<HTMLElement>("protyle-html");
            hosts.forEach((host) => {
                const shadow = (host as HTMLElement).shadowRoot;
                if (shadow) scan(shadow);
            });
        };

        // 暴露给 HTML 块内的全局交互函数
        const pluginCodeTabs = {
            codeBlockStyle: StyleProbe,
            openTag: (evt: MouseEvent) => {
                blurActiveElementOnMobile();
                const clicked = evt.target as HTMLElement;
                const tabContainer = clicked.closest(".tabs-container") as HTMLElement | null;
                if (!tabContainer) return;
                const tabId = clicked.dataset.tabId ?? "";
                if (!tabId) return;
                activateTabById(tabContainer, tabId);
                logger.debug("切换标签页", { tabId });
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
            setDefault: async (evt: MouseEvent) => {
                const trigger = (evt.currentTarget || evt.target) as HTMLElement | null;
                if (!trigger) return;
                const tabContainer = trigger.closest(".tabs-container");
                if (!tabContainer) return;
                const activeTab = tabContainer.querySelector<HTMLElement>(".tab-item--active");
                if (!activeTab) return;
                const activeId = Number(activeTab.dataset.tabId ?? "");
                if (Number.isNaN(activeId)) return;

                const htmlBlock = getHtmlBlockFromEventTarget(trigger);
                const nodeId = htmlBlock?.dataset.nodeId;
                if (!nodeId) return;

                try {
                    const data = await resolveTabsData(nodeId, htmlBlock);
                    if (!data || data.tabs.length === 0) {
                        pushErrMsg(t(i18n, "msg.setDefaultActiveFailed"));
                        return;
                    }
                    if (activeId < 0 || activeId >= data.tabs.length) {
                        pushErrMsg(t(i18n, "msg.setDefaultActiveFailed"));
                        return;
                    }
                    if (data.active === activeId) {
                        logger.debug("默认标签未变化，跳过更新", {
                            nodeId,
                            activeId,
                        });
                        return;
                    }
                    data.active = activeId;
                    await persistTabsData(nodeId, data, onReload);
                    pushMsg(t(i18n, "msg.setDefaultActive"));
                    logger.debug("已设置默认标签", { nodeId, activeId });
                } catch (error) {
                    logger.warn("设置默认标签失败", { error, nodeId, activeId });
                    pushErrMsg(t(i18n, "msg.setDefaultActiveFailed"));
                }
            },
            editTab: async (evt: MouseEvent) => {
                const trigger = (evt.currentTarget || evt.target) as HTMLElement | null;
                if (!trigger) return;
                blurActiveElementOnMobile();
                const tabContainer = trigger.closest(".tabs-container");
                if (!tabContainer) return;
                const activeTab = tabContainer.querySelector<HTMLElement>(".tab-item--active");
                const activeId = Number(activeTab?.dataset.tabId ?? "0");

                const htmlBlock = getHtmlBlockFromEventTarget(trigger);
                const nodeId = htmlBlock?.dataset.nodeId;
                if (!nodeId) return;

                const data = await resolveTabsData(nodeId, htmlBlock);
                if (!data) {
                    pushErrMsg(t(i18n, "msg.setDefaultActiveFailed"));
                    return;
                }

                TabEditor.open({
                    i18n,
                    data,
                    currentIndex: Number.isNaN(activeId) ? 0 : activeId,
                    onSubmit: async (next) => {
                        await persistTabsData(nodeId, next, onReload);
                    },
                });
            },
            refreshEcharts: async (evt: Event) => {
                const trigger = (evt.currentTarget || evt.target) as HTMLElement | null;
                if (!trigger) return;
                const echartsRoot = trigger.closest(".language-echarts") as HTMLElement;
                const echartsContainer =
                    echartsRoot?.querySelector<HTMLElement>(".echarts-container");
                if (!echartsContainer) return;

                const width = echartsContainer?.clientWidth - 20 || 420;
                const height = 420;
                // 一般出现这个按钮说明 echarts 已经加载了
                window.echarts
                    ?.getInstanceByDom(echartsContainer)
                    ?.resize({ width: width, height: height });
            },
            refreshOverflow,
        };
        window.pluginCodeTabs = pluginCodeTabs;
        return pluginCodeTabs;
    }

    static cleanup(): void {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
    }
}

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

type ReorderHandler = (nodeId: string, order: string[]) => void;

function getHtmlBlockFromEventTarget(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) return null;
    const tabContainer = target.closest(".tabs-container");
    if (!tabContainer) return null;
    const root = tabContainer.getRootNode();
    if (!(root instanceof ShadowRoot)) return null;
    const host = root.host;
    if (!host || !host.parentNode || !host.parentNode.parentNode) return null;
    return host.parentNode.parentNode as HTMLElement;
}

function reorderTabContents(tabsEl: HTMLElement, contentsEl: HTMLElement): string[] {
    const order = Array.from(tabsEl.querySelectorAll<HTMLElement>(".tab-item"))
        .map((item) => item.dataset.tabId)
        .filter((id): id is string => Boolean(id));
    logger.debug("拖拽排序：tab 顺序", { order });

    const contentNodes = Array.from(contentsEl.querySelectorAll<HTMLElement>(".tab-content"));
    const contentMap = new Map<string, HTMLElement>();
    contentNodes.forEach((node) => {
        const id = node.dataset.tabId;
        if (id) contentMap.set(id, node);
    });
    logger.debug("拖拽排序：content 映射", { ids: Array.from(contentMap.keys()) });
    const copyIcon = contentsEl.querySelector<HTMLElement>(".code-tabs--icon_copy");
    contentNodes.forEach((node) => node.remove());
    order.forEach((id) => {
        const node = contentMap.get(id);
        if (node) contentsEl.appendChild(node);
    });
    if (copyIcon) {
        contentsEl.insertBefore(copyIcon, contentsEl.firstChild);
    }
    return order;
}

function clearDragIndicators(tabsEl: HTMLElement): void {
    tabsEl
        .querySelectorAll(".tab-item--drop-left, .tab-item--drop-right")
        .forEach((el) => el.classList.remove("tab-item--drop-left", "tab-item--drop-right"));
}

function isCoarsePointer(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches
    );
}

function resolveTabsElement(
    target: EventTarget | null,
    tabItem: HTMLElement | null
): HTMLElement | null {
    if (tabItem?.parentElement instanceof HTMLElement) return tabItem.parentElement;
    if (!(target instanceof HTMLElement)) return null;
    const tabsEl = target.closest(".tabs");
    return tabsEl instanceof HTMLElement ? tabsEl : null;
}

export class TabManager {
    static initGlobalFunctions(i18n: IObject, onReorder?: ReorderHandler) {
        logger.debug("初始化全局 Tabs 交互函数");
        const longPressDelay = 350;
        const longPressMoveThreshold = 8;
        let draggingTabId = "";
        let dropHandled = false;
        let dragOverTab: HTMLElement | null = null;
        let dragOverBefore = false;
        let dragOverInTabs = false;
        let touchDragTab: HTMLElement | null = null;
        let touchDragTabsEl: HTMLElement | null = null;
        let touchStartX = 0;
        let touchStartY = 0;
        let touchScrollLeft = 0;
        let touchIsDragging = false;
        let touchRafId: number | null = null;
        let touchReordering = false;
        let touchMoved = false;
        let touchLongPressTimer: number | null = null;
        let touchScrollEnabled = false;
        let touchScrollPossible = false;

        const touchMove = (evt: TouchEvent) => {
            const tabs = (evt.target as HTMLElement).closest(".tabs") as HTMLElement;
            if (!tabs) return;

            const touch = evt.touches[0];
            const deltaX = touch.pageX - touchStartX;
            const deltaY = touch.pageY - touchStartY;
            if (
                !touchMoved &&
                (Math.abs(deltaX) > longPressMoveThreshold ||
                    Math.abs(deltaY) > longPressMoveThreshold)
            ) {
                touchMoved = true;
                if (touchLongPressTimer) {
                    clearTimeout(touchLongPressTimer);
                    touchLongPressTimer = null;
                }
                if (!touchReordering && touchScrollPossible) {
                    touchScrollEnabled = true;
                    touchIsDragging = true;
                }
            }

            if (touchReordering) {
                evt.preventDefault();
                touchMoved = true;
                const tabsEl = touchDragTabsEl ?? tabs;
                if (!tabsEl) return;
                clearDragIndicators(tabsEl);
                const candidates = Array.from(
                    tabsEl.querySelectorAll<HTMLElement>(".tab-item")
                ).filter((item) => item.dataset.tabId !== draggingTabId);
                if (candidates.length === 0) {
                    dragOverTab = null;
                    dragOverBefore = false;
                    dragOverInTabs = false;
                    return;
                }
                let targetItem: HTMLElement | null = null;
                let before = false;
                for (const item of candidates) {
                    const rect = item.getBoundingClientRect();
                    const mid = rect.left + rect.width / 2;
                    if (touch.clientX < mid) {
                        targetItem = item;
                        before = true;
                        break;
                    }
                }
                if (!targetItem) {
                    targetItem = candidates[candidates.length - 1];
                    before = false;
                }
                targetItem.classList.add(before ? "tab-item--drop-left" : "tab-item--drop-right");
                dragOverTab = targetItem;
                dragOverBefore = before;
                dragOverInTabs = true;
                return;
            }

            if (!touchIsDragging) return;
            if (touchRafId) cancelAnimationFrame(touchRafId);
            touchRafId = requestAnimationFrame(() => {
                tabs.scrollLeft = touchScrollLeft - deltaX;
            });
        };

        const touchStart = (evt: TouchEvent) => {
            evt.stopPropagation();
            const tabs = (evt.target as HTMLElement).closest(".tabs") as HTMLElement;
            if (!tabs) return;

            const touch = evt.touches[0];
            touchStartX = touch.pageX;
            touchStartY = touch.pageY;
            touchScrollLeft = tabs.scrollLeft;
            touchScrollPossible = tabs.scrollWidth > tabs.clientWidth;
            touchMoved = false;
            touchScrollEnabled = false;
            touchIsDragging = false;

            const tabItem = (evt.target as HTMLElement).closest(".tab-item") as HTMLElement | null;
            const allowLongPress = isCoarsePointer() && tabItem;
            if (allowLongPress) {
                if (touchLongPressTimer) {
                    clearTimeout(touchLongPressTimer);
                }
                touchLongPressTimer = window.setTimeout(() => {
                    const tabId = tabItem?.dataset.tabId ?? "";
                    if (!tabId) return;
                    draggingTabId = tabId;
                    dropHandled = false;
                    dragOverTab = null;
                    dragOverBefore = false;
                    dragOverInTabs = false;
                    touchDragTab = tabItem;
                    touchDragTabsEl = tabs;
                    touchReordering = true;
                    touchScrollEnabled = false;
                    touchIsDragging = false;
                    tabItem.classList.add("tab-item--dragging");
                    logger.debug("触摸长按进入拖拽", { tabId });
                }, longPressDelay);
            } else {
                touchScrollEnabled = touchScrollPossible;
                touchIsDragging = touchScrollEnabled;
            }

            tabs.addEventListener("touchmove", touchMove, { passive: false });
        };

        const touchEnd = (evt: TouchEvent) => {
            const tabs = (evt.target as HTMLElement).closest(".tabs") as HTMLElement;
            tabs?.removeEventListener("touchmove", touchMove);
            if (touchLongPressTimer) {
                clearTimeout(touchLongPressTimer);
                touchLongPressTimer = null;
            }
            if (touchReordering) {
                const tabsEl = touchDragTabsEl ?? resolveTabsElement(evt.target, touchDragTab);
                if (tabsEl) clearDragIndicators(tabsEl);
                const draggedId = draggingTabId;
                if (touchMoved && draggedId && tabsEl && (dragOverTab || dragOverInTabs)) {
                    pluginCodeTabs.applyReorder(draggedId, tabsEl, dragOverTab, dragOverBefore);
                }
                touchDragTab?.classList.remove("tab-item--dragging");
                touchDragTab = null;
                touchDragTabsEl = null;
                draggingTabId = "";
                dragOverTab = null;
                dragOverInTabs = false;
                touchReordering = false;
            }
            touchIsDragging = false;
            touchScrollEnabled = false;
            touchScrollPossible = false;
        };

        const pluginCodeTabs = {
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
            applyReorder: (
                draggedId: string,
                tabsEl: HTMLElement,
                tabItem: HTMLElement | null,
                before: boolean
            ) => {
                const draggedEl = tabsEl.querySelector<HTMLElement>(
                    `.tab-item[data-tab-id="${draggedId}"]`
                );
                if (!draggedEl) return;
                if (tabItem && draggedEl === tabItem) return;

                if (tabItem) {
                    tabsEl.insertBefore(draggedEl, before ? tabItem : tabItem.nextSibling);
                    logger.debug("拖拽插入", {
                        before,
                        draggedId,
                        targetId: tabItem.dataset.tabId,
                    });
                } else {
                    tabsEl.appendChild(draggedEl);
                    logger.debug("拖拽插入到末尾", { draggedId });
                }

                const tabContainer = tabsEl.closest(".tabs-container");
                const contentsEl = tabContainer?.querySelector<HTMLElement>(".tab-contents");
                if (!contentsEl) return;
                const order = reorderTabContents(tabsEl, contentsEl);

                const htmlBlock = getHtmlBlockFromEventTarget(tabItem || tabsEl);
                const nodeId = htmlBlock?.dataset.nodeId;
                logger.debug("拖拽持久化触发", { nodeId, order });
                if (nodeId && onReorder) {
                    onReorder(nodeId, order);
                }
            },
            dragStart: (evt: DragEvent) => {
                if (isCoarsePointer()) return;
                const target = evt.target as HTMLElement | null;
                const tabItem = target?.closest(".tab-item") as HTMLElement | null;
                if (!tabItem) return;
                const tabId = tabItem.dataset.tabId ?? "";
                logger.debug("拖拽开始", { tabId });
                draggingTabId = tabId;
                dropHandled = false;
                dragOverTab = null;
                dragOverBefore = false;
                dragOverInTabs = false;
                tabItem.classList.add("tab-item--dragging");
                if (evt.dataTransfer) {
                    evt.dataTransfer.effectAllowed = "move";
                    evt.dataTransfer.setData("text/plain", tabId);
                }
            },
            dragOver: (evt: DragEvent) => {
                if (isCoarsePointer()) return;
                evt.preventDefault();
                if (evt.dataTransfer) {
                    evt.dataTransfer.dropEffect = "move";
                }
                const target = evt.target as HTMLElement | null;
                const tabItem = target?.closest(".tab-item") as HTMLElement | null;
                const tabsEl = resolveTabsElement(target, tabItem);
                if (!tabsEl) return;
                clearDragIndicators(tabsEl);
                if (!tabItem) {
                    dragOverTab = null;
                    dragOverBefore = false;
                    dragOverInTabs = true;
                    return;
                }
                const rect = tabItem.getBoundingClientRect();
                const before = evt.clientX < rect.left + rect.width / 2;
                tabItem.classList.add(before ? "tab-item--drop-left" : "tab-item--drop-right");
                dragOverTab = tabItem;
                dragOverBefore = before;
                dragOverInTabs = true;
                logger.debug("拖拽悬停", {
                    targetId: tabItem.dataset.tabId,
                    before,
                });
            },
            dragDrop: (evt: DragEvent) => {
                if (isCoarsePointer()) return;
                evt.preventDefault();
                const target = evt.target as HTMLElement | null;
                const tabItem = target?.closest(".tab-item") as HTMLElement | null;
                const tabsEl = resolveTabsElement(target, tabItem);
                if (!tabsEl) return;

                const draggedId = draggingTabId || evt.dataTransfer?.getData("text/plain") || "";
                logger.debug("拖拽释放", { draggedId, targetId: tabItem?.dataset.tabId ?? "" });
                if (!draggedId) return;
                clearDragIndicators(tabsEl);
                if (tabItem) {
                    const rect = tabItem.getBoundingClientRect();
                    const before = evt.clientX < rect.left + rect.width / 2;
                    pluginCodeTabs.applyReorder(draggedId, tabsEl, tabItem, before);
                } else {
                    pluginCodeTabs.applyReorder(draggedId, tabsEl, null, false);
                }
                dropHandled = true;
            },
            dragEnd: (evt: DragEvent) => {
                if (isCoarsePointer()) return;
                const target = evt.target as HTMLElement | null;
                const tabItem = target?.closest(".tab-item") as HTMLElement | null;
                tabItem?.classList.remove("tab-item--dragging");
                const draggedId = draggingTabId;
                const tabsEl = resolveTabsElement(target, tabItem);
                if (tabsEl) clearDragIndicators(tabsEl);
                logger.debug("拖拽结束");
                if (!dropHandled && tabsEl && (dragOverTab || dragOverInTabs)) {
                    logger.debug("拖拽结束未触发 drop，执行回退排序");
                    pluginCodeTabs.applyReorder(draggedId, tabsEl, dragOverTab, dragOverBefore);
                }
                draggingTabId = "";
                dragOverTab = null;
                dragOverInTabs = false;
            },
            dragLeave: (evt: DragEvent) => {
                if (isCoarsePointer()) return;
                const target = evt.target as HTMLElement | null;
                const tabsEl = resolveTabsElement(target, null);
                if (tabsEl) clearDragIndicators(tabsEl);
                logger.debug("拖拽离开");
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

            touchStart,
            touchMove,
            touchEnd,
            contextMenu: (evt: Event) => {
                if (!isCoarsePointer()) return;
                evt.preventDefault();
                evt.stopPropagation();
                logger.debug("移动端标签栏拦截长按菜单");
            },
        };
        window.pluginCodeTabs = pluginCodeTabs;
    }
}

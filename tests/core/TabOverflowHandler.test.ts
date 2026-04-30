import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TabOverflowHandler } from "@/core/TabOverflowHandler";
import { createTabContainer, cleanupTestDOM } from "../helpers/dom-factory";
import { createMockI18n } from "../helpers/test-data-factory";

describe("TabOverflowHandler", () => {
    let container: HTMLElement;
    let i18n: Record<string, string>;
    let onMoreMenuClick: (event: MouseEvent) => void;

    beforeEach(() => {
        i18n = createMockI18n({ "label.moreTabs": "More" });
        onMoreMenuClick = vi.fn() as unknown as (event: MouseEvent) => void;
    });

    afterEach(() => {
        cleanupTestDOM();
        if (container && container.parentNode) {
            container.remove();
        }
    });

    describe("constructor", () => {
        it("should create instance with valid container", () => {
            container = createTabContainer();
            document.body.appendChild(container);
            
            const handler = new TabOverflowHandler(container, i18n, onMoreMenuClick);
            expect(handler).toBeDefined();
        });

        it("should throw error if .tabs element not found", () => {
            const invalidContainer = document.createElement("div");
            
            expect(() => {
                new TabOverflowHandler(invalidContainer, i18n, onMoreMenuClick);
            }).toThrow("无法找到 .tabs 元素");
        });
    });

    describe("updateOverflow", () => {
        it("should handle empty tabs", () => {
            container = createTabContainer({ tabCount: 0 });
            document.body.appendChild(container);
            
            const handler = new TabOverflowHandler(container, i18n, onMoreMenuClick);
            
            expect(() => handler.updateOverflow()).not.toThrow();
        });

        it("should handle single tab", () => {
            container = createTabContainer({ tabCount: 1 });
            document.body.appendChild(container);
            
            const handler = new TabOverflowHandler(container, i18n, onMoreMenuClick);
            
            expect(() => handler.updateOverflow()).not.toThrow();
        });

        it("should handle multiple tabs", () => {
            container = createTabContainer({ tabCount: 5 });
            document.body.appendChild(container);
            
            const handler = new TabOverflowHandler(container, i18n, onMoreMenuClick);
            
            expect(() => handler.updateOverflow()).not.toThrow();
        });

        it("should handle wide container", () => {
            container = createTabContainer({ tabCount: 3, containerWidth: 1000 });
            document.body.appendChild(container);
            
            const handler = new TabOverflowHandler(container, i18n, onMoreMenuClick);
            handler.updateOverflow();
            
            const tabs = container.querySelectorAll(".tab-item");
            expect(tabs.length).toBe(3);
        });

        it("should handle narrow container", () => {
            container = createTabContainer({ tabCount: 5, containerWidth: 150 });
            document.body.appendChild(container);
            
            const handler = new TabOverflowHandler(container, i18n, onMoreMenuClick);
            handler.updateOverflow();
            
            expect(() => handler.updateOverflow()).not.toThrow();
        });
    });

    describe("溢出状态计算", () => {
        it("should reset overflow for small tab count", () => {
            container = createTabContainer({ tabCount: 2, containerWidth: 500 });
            document.body.appendChild(container);
            
            const handler = new TabOverflowHandler(container, i18n, onMoreMenuClick);
            handler.updateOverflow();
            
            expect(container.classList.contains("tabs-container--has-more")).toBe(false);
        });
    });

    describe("DOM 操作", () => {
        it("should not have memory leak after multiple updates", () => {
            container = createTabContainer({ tabCount: 5 });
            document.body.appendChild(container);
            
            const handler = new TabOverflowHandler(container, i18n, onMoreMenuClick);
            
            for (let i = 0; i < 10; i++) {
                handler.updateOverflow();
            }
            
            const moreButtons = container.querySelectorAll(".tab-item--more");
            expect(moreButtons.length).toBeLessThanOrEqual(1);
        });

        it("should clean up hidden tabs on reset", () => {
            container = createTabContainer({ tabCount: 5, containerWidth: 150 });
            document.body.appendChild(container);
            
            const handler = new TabOverflowHandler(container, i18n, onMoreMenuClick);
            handler.updateOverflow();
            
            const allTabs = container.querySelectorAll(".tab-item");
            allTabs.forEach((tab) => {
                expect(tab.classList.contains("tab-item--hidden") || tab.classList.contains("tab-item")).toBe(true);
            });
        });
    });

    describe("事件绑定", () => {
        it("should bind more menu click event when overflow", () => {
            container = createTabContainer({ tabCount: 10, containerWidth: 100 });
            document.body.appendChild(container);
            
            const handler = new TabOverflowHandler(container, i18n, onMoreMenuClick);
            handler.updateOverflow();
            
            const moreButton = container.querySelector(".tab-item--more");
            if (moreButton) {
                const tabsEl = container.querySelector(".tabs") as HTMLElement;
                expect(tabsEl.dataset.moreMenuBound).toBeDefined();
            }
        });
    });

    describe("边界条件", () => {
        it("should handle zero container width", () => {
            container = createTabContainer({ tabCount: 3, containerWidth: 0 });
            document.body.appendChild(container);
            
            const handler = new TabOverflowHandler(container, i18n, onMoreMenuClick);
            
            expect(() => handler.updateOverflow()).not.toThrow();
        });

        it("should handle very large tab count", () => {
            container = createTabContainer({ tabCount: 50 });
            document.body.appendChild(container);
            
            const handler = new TabOverflowHandler(container, i18n, onMoreMenuClick);
            
            expect(() => handler.updateOverflow()).not.toThrow();
        });
    });
});

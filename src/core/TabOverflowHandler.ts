import { t } from "@/utils/i18n";
import type { IObject } from "siyuan";

interface OverflowState {
    shouldShowMore: boolean;
    shouldSink: boolean;
    moreWidth?: number;
    visibleCount?: number;
    widths?: number[];
}

export class TabOverflowHandler {
    private tabContainer: HTMLElement;
    private tabsEl: HTMLElement;
    private i18n: IObject;
    private onMoreMenuClick: (event: MouseEvent) => void;

    constructor(
        tabContainer: HTMLElement,
        i18n: IObject,
        onMoreMenuClick: (event: MouseEvent) => void
    ) {
        this.tabContainer = tabContainer;
        const tabsEl = tabContainer.querySelector<HTMLElement>(".tabs");
        if (!tabsEl) {
            throw new Error("无法找到 .tabs 元素");
        }
        this.tabsEl = tabsEl;
        this.i18n = i18n;
        this.onMoreMenuClick = onMoreMenuClick;
    }

    updateOverflow(): void {
        const allTabs = Array.from(
            this.tabsEl.querySelectorAll<HTMLElement>(".tab-item[data-tab-id]")
        );

        if (allTabs.length === 0) {
            this.resetOverflow();
            return;
        }

        this.clearExistingMore();
        this.resetTabStates();

        const fullAvailable = this.tabsEl.clientWidth;
        if (fullAvailable <= 0) {
            return;
        }

        const overflowState = this.calculateOverflowState(allTabs);

        if (overflowState.shouldShowMore) {
            this.applyOverflowState(overflowState, allTabs);
        } else {
            this.updateIconSink(overflowState.shouldSink);
        }
    }

    private calculateOverflowState(allTabs: HTMLElement[]): OverflowState {
        const widths = allTabs.map((item) => item.getBoundingClientRect().width);
        const tabsRect = this.tabsEl.getBoundingClientRect();
        const lastTab = allTabs[allTabs.length - 1];
        const lastRect = lastTab.getBoundingClientRect();
        const lastRight = lastRect.right - tabsRect.left;

        const iconGroup = this.tabContainer.querySelector<HTMLElement>(".code-tabs--icon_group");
        const iconRect = iconGroup?.getBoundingClientRect();
        const iconLeft = iconRect ? iconRect.left - tabsRect.left : Number.POSITIVE_INFINITY;

        const fontSize = Number.parseFloat(getComputedStyle(lastTab).fontSize) || 12;
        const sinkThreshold = fontSize;

        const shouldSink = lastRight > iconLeft + sinkThreshold;
        const shouldShowMore = lastRight > this.tabsEl.clientWidth;

        if (!shouldShowMore) {
            return { shouldShowMore: false, shouldSink };
        }

        const moreWidth = this.calculateMoreWidth();
        const visibleCount = this.calculateVisibleCount(widths, moreWidth);

        return {
            shouldShowMore: true,
            shouldSink,
            moreWidth,
            visibleCount,
            widths,
        };
    }

    private calculateMoreWidth(): number {
        const moreItem = this.createMoreTab();
        moreItem.style.visibility = "hidden";
        moreItem.style.position = "absolute";
        this.tabsEl.appendChild(moreItem);
        const moreWidth = moreItem.getBoundingClientRect().width;
        moreItem.remove();
        return moreWidth;
    }

    private calculateVisibleCount(widths: number[], moreWidth: number): number {
        const moreGap = 6;
        const fullAvailable = this.tabsEl.clientWidth;
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

        return visibleCount;
    }

    private applyOverflowState(state: OverflowState, allTabs: HTMLElement[]): void {
        const { moreWidth, visibleCount, widths } = state;
        const moreGap = 6;

        if (!moreWidth || visibleCount === undefined || !widths) {
            return;
        }

        this.tabsEl.style.setProperty("--code-tabs-more-width", `${Math.ceil(moreWidth)}px`);
        this.updateIconSink(state.shouldSink);

        if (visibleCount >= allTabs.length) {
            this.resetOverflow();
            return;
        }

        const adjustedCount = this.adjustLastVisibleTab(
            allTabs,
            visibleCount,
            widths,
            moreWidth,
            moreGap
        );
        this.hideOverflowTabs(allTabs, adjustedCount);
        this.showMoreButton(allTabs, adjustedCount);
        this.bindMoreMenuEvent();
    }

    private adjustLastVisibleTab(
        allTabs: HTMLElement[],
        visibleCount: number,
        widths: number[],
        moreWidth: number,
        moreGap: number
    ): number {
        if (visibleCount <= 0) {
            return 0;
        }

        const fullAvailable = this.tabsEl.clientWidth;
        const availableForMore = Math.max(0, fullAvailable - moreWidth - moreGap);

        const visibleLastIndex = visibleCount - 1;
        const visibleLast = allTabs[visibleLastIndex];
        const visibleWidth = widths[visibleLastIndex];
        const visibleMinWidth = Number.parseFloat(getComputedStyle(visibleLast).minWidth) || 0;
        const used = widths.slice(0, visibleCount).reduce((sum, w) => sum + w, 0);
        const availableForLast = availableForMore - (used - visibleWidth);

        if (availableForLast <= 0 || availableForLast < visibleMinWidth) {
            if (visibleCount > 1) {
                return visibleCount - 1;
            }
        } else if (visibleWidth <= moreWidth + moreGap) {
            if (visibleCount > 1) {
                return visibleCount - 1;
            }
        } else if (visibleWidth > availableForLast) {
            visibleLast.style.width = `${Math.floor(availableForLast)}px`;
        }

        return visibleCount;
    }

    private hideOverflowTabs(allTabs: HTMLElement[], visibleCount: number): void {
        allTabs.slice(visibleCount).forEach((item) => {
            item.classList.add("tab-item--hidden");
        });
    }

    private showMoreButton(allTabs: HTMLElement[], visibleCount: number): void {
        const moreItem = this.createMoreTab();
        this.tabsEl.appendChild(moreItem);

        const activeHidden = allTabs
            .slice(visibleCount)
            .some((item) => item.classList.contains("tab-item--active"));
        moreItem.classList.toggle("tab-item--more-active", activeHidden);
    }

    private createMoreTab(): HTMLElement {
        const moreItem = document.createElement("div");
        moreItem.className = "tab-item tab-item--more";
        moreItem.textContent = t(this.i18n, "label.moreTabs");
        return moreItem;
    }

    private bindMoreMenuEvent(): void {
        if (this.tabsEl.dataset.moreMenuBound) {
            return;
        }

        this.tabsEl.addEventListener("click", (event) => {
            const target = event.target as HTMLElement;
            const more = target.closest<HTMLElement>(".tab-item--more");
            if (!more) return;
            this.onMoreMenuClick(event as MouseEvent);
        });

        this.tabsEl.dataset.moreMenuBound = "true";
    }

    private updateIconSink(shouldSink: boolean): void {
        if (shouldSink) {
            this.tabContainer.classList.add("tabs-container--icon-sink");
        } else {
            this.tabContainer.classList.remove("tabs-container--icon-sink");
        }
    }

    private resetOverflow(): void {
        this.tabContainer.classList.remove("tabs-container--has-more");
        this.tabContainer.classList.remove("tabs-container--icon-sink");
        this.tabsEl.style.removeProperty("--code-tabs-more-width");
    }

    private clearExistingMore(): void {
        const existingMore = this.tabsEl.querySelector<HTMLElement>(".tab-item--more");
        if (existingMore) {
            existingMore.remove();
        }
    }

    private resetTabStates(): void {
        const allTabs = this.tabsEl.querySelectorAll<HTMLElement>(".tab-item[data-tab-id]");
        allTabs.forEach((item) => {
            item.classList.remove("tab-item--hidden");
            item.style.removeProperty("width");
        });
        this.tabContainer.classList.remove("tabs-container--has-more", "tabs-container--icon-sink");
        this.tabsEl.style.removeProperty("--code-tabs-more-width");
    }
}

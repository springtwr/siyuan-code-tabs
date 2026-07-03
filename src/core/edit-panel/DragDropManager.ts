import logger from "@/utils/logger";

export class DragDropManager {
    private listEl: HTMLElement;
    private dropIndicator: HTMLElement;
    private onReorder: (fromIndex: number, toIndex: number) => void;
    private readonly instanceId: string;

    private dragIndex: number | null = null;
    private isDragEnding = false;
    private didDrop = false;
    private lastDropIndex: number | null = null;
    private lastDropPosition: "before" | "after" | null = null;
    private indicatorRaf = 0;
    private pendingIndicator: { item: HTMLElement; position: "before" | "after" } | null = null;
    private lastIndicatorTop: number | null = null;
    private isPointerDrag = false;

    constructor(
        listEl: HTMLElement,
        dropIndicator: HTMLElement,
        onReorder: (fromIndex: number, toIndex: number) => void
    ) {
        this.listEl = listEl;
        this.dropIndicator = dropIndicator;
        this.onReorder = onReorder;
        this.instanceId = `dm_${Math.random().toString(36).slice(2, 8)}`;
        logger.debug(`[DnD:${this.instanceId}] 构造完成`, {
            children: listEl.children.length,
        });
        this.bindEvents();
    }

    private bindEvents(): void {
        this.listEl.addEventListener("dragstart", this.handleDragStart.bind(this));
        this.listEl.addEventListener("dragover", this.handleDragOver.bind(this));
        this.listEl.addEventListener("drop", this.handleDrop.bind(this));
        this.listEl.addEventListener("dragend", this.handleDragEnd.bind(this));

        this.listEl.addEventListener("pointerdown", this.handlePointerDown.bind(this));
        this.listEl.addEventListener("pointermove", this.handlePointerMove.bind(this));
        this.listEl.addEventListener("pointerup", this.handlePointerUp.bind(this));
        this.listEl.addEventListener("pointercancel", this.handlePointerUp.bind(this));
    }

    private handleDragStart(event: DragEvent): void {
        const target = event.target as HTMLElement;
        const handle = target.closest<HTMLElement>(".code-tabs__editor-item-handle");
        if (!handle) return;
        const item = handle.closest<HTMLElement>(".code-tabs__editor-item");
        if (!item) return;

        this.dragIndex = Number(item.dataset.index ?? 0);
        this.isDragEnding = false;
        this.didDrop = false;
        event.dataTransfer?.setData("text/plain", String(this.dragIndex));
        event.dataTransfer?.setDragImage(item, 0, 0);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
        }
        logger.debug(`[DnD:${this.instanceId}] 拖拽开始`, { fromIndex: this.dragIndex });
    }

    private handleDragOver(event: DragEvent): void {
        if (this.dragIndex === null) return;
        if (this.isDragEnding) return;

        const resolved = this.resolveDragItem(event) ?? this.resolveEdgeDrop(event.clientY) ?? null;
        if (!resolved) return;

        event.preventDefault();
        const item = resolved.item;
        const edge = this.resolveEdgeDrop(event.clientY);
        const position = edge?.item === item ? edge.position : this.resolveDropPosition(event, item);
        const rawIndex = Number(item.dataset.index ?? 0);
        const dropIndex = this.resolveDropIndex(this.dragIndex, rawIndex, position);

        if (dropIndex === this.dragIndex) {
            this.lastDropIndex = null;
            this.lastDropPosition = null;
            this.clearDropIndicator();
            return;
        }

        this.lastDropIndex = dropIndex;
        this.lastDropPosition = position;
        this.showDropIndicator(item, position);

        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
        }
    }

    private handleDrop(event: DragEvent): void {
        if (this.dragIndex === null) return;
        this.isDragEnding = true;
        this.didDrop = true;

        const resolved = this.resolveDragItem(event) ?? this.resolveEdgeDrop(event.clientY) ?? null;
        if (!resolved) {
            if (this.lastDropIndex !== null && this.lastDropPosition) {
                if (this.lastDropIndex !== this.dragIndex) {
                    logger.debug(`[DnD:${this.instanceId}] 落点回退`, {
                        from: this.dragIndex,
                        to: this.lastDropIndex,
                    });
                    this.onReorder(this.dragIndex, this.lastDropIndex);
                }
            }
            this.dragIndex = null;
            this.lastDropIndex = null;
            this.lastDropPosition = null;
            this.clearDropIndicator();
            return;
        }

        event.preventDefault();
        const item = resolved.item;
        const edge = this.resolveEdgeDrop(event.clientY);
        const position = edge?.item === item ? edge.position : this.resolveDropPosition(event, item);
        const rawIndex = Number(item.dataset.index ?? 0);
        const dropIndex = this.resolveDropIndex(this.dragIndex, rawIndex, position);
        if (dropIndex !== this.dragIndex) {
            logger.debug(`[DnD:${this.instanceId}] 放下`, {
                from: this.dragIndex,
                to: dropIndex,
            });
            this.onReorder(this.dragIndex, dropIndex);
        }
        this.dragIndex = null;
        this.lastDropIndex = null;
        this.lastDropPosition = null;
        this.clearDropIndicator();
    }

    private handleDragEnd(): void {
        this.isDragEnding = true;
        if (!this.didDrop && this.dragIndex !== null) {
            if (this.lastDropIndex !== null && this.lastDropIndex !== this.dragIndex) {
                logger.debug(`[DnD:${this.instanceId}] 拖拽结束回退`, {
                    from: this.dragIndex,
                    to: this.lastDropIndex,
                });
                this.onReorder(this.dragIndex, this.lastDropIndex);
            }
        }
        this.reset();
    }

    private handlePointerDown(event: PointerEvent): void {
        if (event.pointerType !== "touch" && event.pointerType !== "pen") return;

        const target = event.target as HTMLElement;
        const handle = target.closest<HTMLElement>(".code-tabs__editor-item-handle");
        if (!handle) return;

        const item = handle.closest<HTMLElement>(".code-tabs__editor-item");
        if (!item) return;

        this.dragIndex = Number(item.dataset.index ?? 0);
        this.lastDropIndex = this.dragIndex;
        this.lastDropPosition = "after";
        this.isPointerDrag = true;

        if (handle.setPointerCapture) handle.setPointerCapture(event.pointerId);
        this.clearDropIndicator();
        item.classList.add("code-tabs__editor-item--drop-after");
        event.preventDefault();
    }

    private handlePointerMove(event: PointerEvent): void {
        if (this.dragIndex === null) return;
        if (!this.isPointerDrag) return;

        const item = this.resolvePointerItem(event);
        if (!item) return;

        const dropIndex = Number(item.dataset.index ?? 0);
        const position = this.resolveDropPosition(event, item);
        const nextIndex = this.resolveDropIndex(this.dragIndex, dropIndex, position);

        if (nextIndex === this.dragIndex) {
            this.clearDropIndicator();
            return;
        }

        this.lastDropIndex = nextIndex;
        this.lastDropPosition = position;
        this.showDropIndicator(item, position);
        event.preventDefault();
    }

    private handlePointerUp(event: PointerEvent): void {
        if (this.dragIndex === null) return;
        if (!this.isPointerDrag) return;

        if (this.lastDropIndex !== null && this.lastDropPosition) {
            const nextIndex = this.resolveDropIndex(
                this.dragIndex,
                this.lastDropIndex,
                this.lastDropPosition
            );
            if (nextIndex !== this.dragIndex) {
                logger.debug(`[DnD:${this.instanceId}] 指针拖拽结束`, {
                    from: this.dragIndex,
                    to: nextIndex,
                });
                this.onReorder(this.dragIndex, nextIndex);
            }
        }

        const target = event.target as HTMLElement | null;
        target?.releasePointerCapture?.(event.pointerId);
        this.reset();
    }

    private resolveDragItem(event: DragEvent): { item: HTMLElement } | null {
        const target = document.elementFromPoint(event.clientX, event.clientY);
        const item = target?.closest<HTMLElement>(".code-tabs__editor-item") ?? null;
        return item ? { item } : null;
    }

    private resolveEdgeDrop(clientY: number): { item: HTMLElement; position: "before" | "after" } | null {
        const items = Array.from(
            this.listEl.querySelectorAll<HTMLElement>(".code-tabs__editor-item")
        );
        if (items.length === 0) return null;
        const listRect = this.listEl.getBoundingClientRect();
        const edgeThreshold = 6;
        if (clientY <= listRect.top + edgeThreshold) {
            return { item: items[0], position: "before" };
        }
        if (clientY >= listRect.bottom - edgeThreshold) {
            return { item: items[items.length - 1], position: "after" };
        }
        return null;
    }

    private resolvePointerItem(event: PointerEvent): HTMLElement | null {
        const target = document.elementFromPoint(event.clientX, event.clientY);
        return target?.closest<HTMLElement>(".code-tabs__editor-item") ?? null;
    }

    private resolveDropPosition(event: { clientY: number }, item: HTMLElement): "before" | "after" {
        const rect = item.getBoundingClientRect();
        return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    }

    private getItemsCount(): number {
        return this.listEl.querySelectorAll(".code-tabs__editor-item").length;
    }

    private resolveDropIndex(
        fromIndex: number,
        targetIndex: number,
        position: "before" | "after"
    ): number {
        let nextIndex = position === "after" ? targetIndex + 1 : targetIndex;
        if (fromIndex < nextIndex) {
            nextIndex -= 1;
        }
        const itemCount = this.getItemsCount();
        const maxIndex = Math.max(itemCount - 1, 0);
        return Math.min(Math.max(nextIndex, 0), maxIndex);
    }

    private showDropIndicator(item: HTMLElement, position: "before" | "after"): void {
        this.pendingIndicator = { item, position };
        if (this.indicatorRaf) return;

        this.indicatorRaf = requestAnimationFrame(() => {
            this.indicatorRaf = 0;
            if (!this.pendingIndicator) return;

            const { item: pendingItem, position: pendingPosition } = this.pendingIndicator;
            this.pendingIndicator = null;

            const listRect = this.listEl.getBoundingClientRect();
            const itemRect = pendingItem.getBoundingClientRect();
            const gap = 6;
            const lineHeight = 3;
            const offset = gap / 2;
            const base =
                pendingPosition === "before"
                    ? itemRect.top - listRect.top - offset
                    : itemRect.bottom - listRect.top + offset;
            const top = Math.max(0, base + this.listEl.scrollTop - lineHeight / 2);

            if (this.lastIndicatorTop !== null && Math.abs(this.lastIndicatorTop - top) < 1) {
                this.dropIndicator.classList.add("code-tabs__editor-drop-indicator--show");
                return;
            }

            this.lastIndicatorTop = top;
            this.dropIndicator.style.top = `${top}px`;
            this.dropIndicator.classList.add("code-tabs__editor-drop-indicator--show");
        });
    }

    private clearDropIndicator(): void {
        this.dropIndicator.classList.remove("code-tabs__editor-drop-indicator--show");
        this.lastIndicatorTop = null;
        this.pendingIndicator = null;
        if (this.indicatorRaf) {
            cancelAnimationFrame(this.indicatorRaf);
            this.indicatorRaf = 0;
        }
    }

    private reset(): void {
        this.clearDropIndicator();
        this.dragIndex = null;
        this.lastDropIndex = null;
        this.lastDropPosition = null;
        this.isDragEnding = false;
        this.didDrop = false;
        this.isPointerDrag = false;
    }

    destroy(): void {
        this.clearDropIndicator();
    }
}

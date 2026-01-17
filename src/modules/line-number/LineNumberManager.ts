import {CUSTOM_ATTR} from "@/assets/constants";
import {getActiveEditor} from "siyuan";
 

export class LineNumberManager {
    private static readonly lineNumClass = "tab-line-num";
    private static readonly lineNumEnabledClass = "tab-content--linenumber";
    private static readonly rowClass = "tab-line-num__row";
    private static resizeObservers = new Map<HTMLElement, ResizeObserver>();
    private static rafIds = new WeakMap<HTMLElement, number>();
    private static measurers = new WeakMap<ShadowRoot, HTMLElement>();

    static isEnabled(): boolean {
        return window.siyuan?.config?.editor?.codeSyntaxHighlightLineNum === true;
    }

    static scanAll(): void {
        if (!this.isEnabled()) {
            this.disableAll();
            return;
        }
        const editor = getActiveEditor(true);
        if (!editor) return;
        this.scan(editor.protyle?.contentElement);
    }

    static scanProtyle(root?: HTMLElement): void {
        if (!this.isEnabled()) {
            this.disableAll();
            return;
        }
        const editor = getActiveEditor(true);
        if (!editor) return;
        const scope = root ?? editor.protyle?.contentElement;
        this.scan(scope);
    }

    static refreshAll(): void {
        const editor = getActiveEditor(true);
        if (!editor) return;
        this.scanAll();
        requestAnimationFrame(() => {
            document.querySelectorAll<HTMLElement>(".tabs-container").forEach(container => {
                this.refreshActive(container);
            });
        });
    }

    static refreshActive(tabContainer: HTMLElement): void {
        if (!this.isEnabled()) {
            this.disableAll();
            return;
        }
        const active = tabContainer.querySelector<HTMLElement>(".tab-content--active");
        if (!active) return;
        this.ensureLineNumbers(active);
    }

    private static disableAll(): void {
        document
            .querySelectorAll<HTMLElement>(`.${this.lineNumClass}`)
            .forEach(node => node.remove());
        document
            .querySelectorAll<HTMLElement>(`.${this.lineNumEnabledClass}`)
            .forEach(node => node.classList.remove(this.lineNumEnabledClass));
        document
            .querySelectorAll<HTMLElement>(".tab-content .code")
            .forEach(codeEl => {
                codeEl.style.paddingLeft = "";
            });
        this.resizeObservers.forEach(observer => observer.disconnect());
        this.resizeObservers.clear();
    }

    private static attachNode(node: HTMLElement): void {
        const shadowRoot = node.querySelector("protyle-html")?.shadowRoot;
        if (!shadowRoot) return;
        shadowRoot.querySelectorAll<HTMLElement>(".tab-content").forEach(tabContent => {
            this.ensureLineNumbers(tabContent);
        });
    }

    private static scan(scope?: HTMLElement): void {
        if (!scope) return;
        const nodes = scope.querySelectorAll<HTMLElement>(`[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}]`);
        if (nodes.length === 0) return;
        nodes.forEach(node => this.attachNode(node));
    }

    private static ensureLineNumbers(tabContent: HTMLElement): void {
        const codeEl = tabContent.querySelector<HTMLElement>(".code");
        if (!codeEl) return;

        tabContent.classList.add(this.lineNumEnabledClass);

        let lineNumEl = tabContent.querySelector<HTMLElement>(`.${this.lineNumClass}`);
        if (!lineNumEl) {
            lineNumEl = document.createElement("div");
            lineNumEl.className = `${this.lineNumClass} protyle-linenumber__rows`;
            tabContent.insertBefore(lineNumEl, tabContent.firstChild);
        }

        this.renderTabContent(tabContent, lineNumEl);
    }

    private static refreshTabContent(tabContent: HTMLElement): boolean {
        const codeEl = tabContent.querySelector<HTMLElement>(".code");
        const lineNumEl = tabContent.querySelector<HTMLElement>(`.${this.lineNumClass}`);
        if (!codeEl || !lineNumEl) return false;

        const codeRect = codeEl.getBoundingClientRect();
        const tabRect = tabContent.getBoundingClientRect();
        lineNumEl.style.top = `${codeRect.top - tabRect.top}px`;
        lineNumEl.style.left = `${codeRect.left - tabRect.left}px`;
        lineNumEl.style.height = `${codeRect.height}px`;

        const active = tabContent.classList.contains("tab-content--active");
        const wrapEnabled = window.siyuan?.config?.editor?.codeLineWrap === true;
        const text = codeEl.textContent ?? "";
        const cleaned = text.endsWith("\n") ? text.slice(0, -1) : text;
        const lines = cleaned.length === 0 ? [""] : cleaned.split("\n");
        const lineCount = Math.max(1, lines.length);

        lineNumEl.style.width = "";
        const codeStyle = getComputedStyle(codeEl);
        const codeFontSize = this.parsePx(codeStyle.fontSize) ?? 16;
        const lineNumFontSize = codeFontSize * 0.85;
        const normalFontSize = codeFontSize / 0.85;
        const estimatedPadding = this.estimatePaddingLeft(lineCount, normalFontSize);
        codeEl.style.paddingLeft = `${estimatedPadding}px`;
        lineNumEl.style.fontSize = `${lineNumFontSize}px`;

        lineNumEl.innerHTML = "";
        const heights = active && wrapEnabled
            ? this.measureLineHeights(codeEl, lines)
            : null;
        const lineHeight = this.resolveLineHeight(codeEl, lineCount);

        for (let i = 0; i < lineCount; i++) {
            const row = document.createElement("span");
            row.className = this.rowClass;
            row.textContent = String(i + 1);
            const height = heights ? heights[i] : lineHeight;
            row.style.height = `${height}px`;
            lineNumEl.appendChild(row);
        }

        const scrollHeight = codeEl.scrollHeight;
        lineNumEl.style.height = `${scrollHeight}px`;

        if (active && wrapEnabled && heights) {
            const totalHeight = heights.reduce((sum, height) => sum + height, 0);
            return Math.abs(totalHeight - scrollHeight) > 1;
        }

        return false;
    }

    private static renderTabContent(
        tabContent: HTMLElement,
        lineNumEl: HTMLElement
    ): void {
        this.applyStyles(lineNumEl);
        this.refreshTabContent(tabContent);
        this.attachResizeObserver(tabContent);
    }
    private static applyStyles(lineNumEl: HTMLElement): void {
        lineNumEl.style.position = "absolute";
        lineNumEl.style.boxSizing = "border-box";
        lineNumEl.style.pointerEvents = "none";
        lineNumEl.style.zIndex = "1";
    }

    private static attachResizeObserver(tabContent: HTMLElement): void {
        if (this.resizeObservers.has(tabContent)) return;
        const observer = new ResizeObserver(() => {
            const existing = this.rafIds.get(tabContent);
            if (existing) cancelAnimationFrame(existing);
            const rafId = requestAnimationFrame(() => {
                const needsRetry = this.refreshTabContent(tabContent);
                if (needsRetry) {
                    requestAnimationFrame(() => this.refreshTabContent(tabContent));
                }
            });
            this.rafIds.set(tabContent, rafId);
        });
        observer.observe(tabContent);
        this.resizeObservers.set(tabContent, observer);
    }

    private static measureLineHeights(codeEl: HTMLElement, lines: string[]): number[] {
        const shadowRoot = codeEl.getRootNode() as ShadowRoot;
        const measurer = this.getMeasurer(shadowRoot);
        const style = getComputedStyle(codeEl);
        measurer.style.font = style.font;
        measurer.style.fontSize = style.fontSize;
        measurer.style.fontFamily = style.fontFamily;
        measurer.style.fontWeight = style.fontWeight;
        measurer.style.letterSpacing = style.letterSpacing;
        measurer.style.lineHeight = style.lineHeight;
        measurer.style.whiteSpace = style.whiteSpace;
        measurer.style.wordBreak = style.wordBreak;
        const paddingLeft = this.parsePx(style.paddingLeft) ?? 0;
        const paddingRight = this.parsePx(style.paddingRight) ?? 0;
        const contentWidth = Math.max(0, codeEl.clientWidth - paddingLeft - paddingRight);
        measurer.style.width = `${contentWidth}px`;

        const heights: number[] = [];
        for (const line of lines) {
            measurer.textContent = line.length === 0 ? " " : line;
            heights.push(measurer.getBoundingClientRect().height);
        }
        return heights;
    }

    private static getMeasurer(shadowRoot: ShadowRoot): HTMLElement {
        const existing = this.measurers.get(shadowRoot);
        if (existing) return existing;
        const measurer = document.createElement("div");
        measurer.style.position = "absolute";
        measurer.style.visibility = "hidden";
        measurer.style.pointerEvents = "none";
        measurer.style.whiteSpace = "pre-wrap";
        measurer.style.padding = "0";
        measurer.style.margin = "0";
        measurer.style.boxSizing = "border-box";
        shadowRoot.appendChild(measurer);
        this.measurers.set(shadowRoot, measurer);
        return measurer;
    }

    private static resolveLineHeight(codeEl: HTMLElement, lineCount: number): number {
        const lineHeight = getComputedStyle(codeEl).lineHeight;
        const parsed = this.parsePx(lineHeight);
        if (parsed) return parsed;
        const total = codeEl.getBoundingClientRect().height;
        if (lineCount <= 0) return total;
        return total / lineCount;
    }

    private static estimatePaddingLeft(lineCount: number, normalFontSizePx: number): number {
        const digits = Math.max(1, String(lineCount).length);
        const base = Math.floor(0.48 * normalFontSizePx + 15);
        const step = Math.ceil(0.42 * normalFontSizePx);
        return base + step * (digits - 1);
    }


    private static parsePx(value: string): number | null {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
}

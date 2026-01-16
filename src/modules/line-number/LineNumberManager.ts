import {CUSTOM_ATTR} from "@/assets/constants";

type LineNumberStyleSnapshot = {
    container: Record<string, string>;
    row: Record<string, string>;
    codePadding: {
        top: string;
        right: string;
        bottom: string;
        left: string;
    } | null;
    lineNumWidth: number | null;
};

export class LineNumberManager {
    private static readonly lineNumClass = "tab-line-num";
    private static readonly lineNumEnabledClass = "tab-content--linenumber";
    private static readonly rowClass = "tab-line-num__row";
    private static styleCache: LineNumberStyleSnapshot | null = null;
    private static styleSheets = new WeakMap<ShadowRoot, HTMLStyleElement>();
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
        document
            .querySelectorAll<HTMLElement>(`[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}]`)
            .forEach(node => this.attachNode(node));
    }

    static scanProtyle(root?: HTMLElement): void {
        if (!this.isEnabled()) {
            this.disableAll();
            return;
        }
        const scope = root ?? document;
        const nodes = scope.querySelectorAll<HTMLElement>(`[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}]`);
        nodes.forEach(node => this.attachNode(node));
    }

    static refreshAll(): void {
        this.styleCache = null;
        this.scanAll();
    }

    static refreshActive(tabContainer: HTMLElement): void {
        if (!this.isEnabled()) {
            this.disableAll();
            return;
        }
        const active = tabContainer.querySelector<HTMLElement>(".tab-content--active");
        if (!active) return;
        const shadowRoot = tabContainer.getRootNode() as ShadowRoot;
        if (!shadowRoot) return;
        this.ensureLineNumbers(active, shadowRoot);
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
                codeEl.style.paddingTop = "";
                codeEl.style.paddingRight = "";
                codeEl.style.paddingBottom = "";
                codeEl.style.paddingLeft = "";
            });
        this.resizeObservers.forEach(observer => observer.disconnect());
        this.resizeObservers.clear();
    }

    private static attachNode(node: HTMLElement): void {
        const shadowRoot = node.querySelector("protyle-html")?.shadowRoot;
        if (!shadowRoot) return;
        shadowRoot.querySelectorAll<HTMLElement>(".tab-content").forEach(tabContent => {
            this.ensureLineNumbers(tabContent, shadowRoot);
        });
    }

    private static ensureLineNumbers(tabContent: HTMLElement, shadowRoot: ShadowRoot): void {
        const codeEl = tabContent.querySelector<HTMLElement>(".code");
        if (!codeEl) return;

        tabContent.classList.add(this.lineNumEnabledClass);

        let lineNumEl = tabContent.querySelector<HTMLElement>(`.${this.lineNumClass}`);
        if (!lineNumEl) {
            lineNumEl = document.createElement("div");
            lineNumEl.className = `${this.lineNumClass} protyle-linenumber__rows`;
            tabContent.insertBefore(lineNumEl, tabContent.firstChild);
        }

        const isActive = tabContent.classList.contains("tab-content--active");
        if (!isActive) return;

        this.applyStyles(tabContent, codeEl, lineNumEl, shadowRoot);
        this.refreshTabContent(tabContent);
        this.attachResizeObserver(tabContent);
    }

    private static refreshTabContent(tabContent: HTMLElement): void {
        const codeEl = tabContent.querySelector<HTMLElement>(".code");
        const lineNumEl = tabContent.querySelector<HTMLElement>(`.${this.lineNumClass}`);
        if (!codeEl || !lineNumEl) return;

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

        const basePaddingLeft = this.getBasePaddingLeft(codeEl);
        const lineNumWidth = this.styleCache?.lineNumWidth ?? 0;
        if (lineNumWidth > 0) {
            lineNumEl.style.width = `${lineNumWidth}px`;
            codeEl.style.paddingLeft = `${Math.max(basePaddingLeft, lineNumWidth)}px`;
        } else {
            lineNumEl.style.width = "";
            const estimatedPadding = Math.max(basePaddingLeft, this.estimatePaddingLeft(lineCount));
            codeEl.style.paddingLeft = `${estimatedPadding}px`;
        }

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

        lineNumEl.style.height = `${codeEl.scrollHeight}px`;
    }

    private static applyStyles(
        tabContent: HTMLElement,
        codeEl: HTMLElement,
        lineNumEl: HTMLElement,
        shadowRoot: ShadowRoot
    ): void {
        const snapshot = this.getStyleSnapshot(shadowRoot);
        const resolved = snapshot ?? this.buildFallbackSnapshot(codeEl);
        if (snapshot) {
            this.styleCache = snapshot;
        }

        if (resolved.codePadding) {
            codeEl.style.paddingTop = resolved.codePadding.top;
            codeEl.style.paddingRight = resolved.codePadding.right;
            codeEl.style.paddingBottom = resolved.codePadding.bottom;
            codeEl.style.paddingLeft = resolved.codePadding.left;
        }
        this.cacheBasePaddingLeft(codeEl, resolved.codePadding?.left);

        this.updateLineNumberStyles(shadowRoot, resolved);

        lineNumEl.style.position = "absolute";
        lineNumEl.style.boxSizing = "border-box";
        lineNumEl.style.pointerEvents = "none";
        lineNumEl.style.textAlign = "right";
        lineNumEl.style.zIndex = "1";
    }

    private static attachResizeObserver(tabContent: HTMLElement): void {
        if (this.resizeObservers.has(tabContent)) return;
        const observer = new ResizeObserver(() => {
            const existing = this.rafIds.get(tabContent);
            if (existing) cancelAnimationFrame(existing);
            const rafId = requestAnimationFrame(() => this.refreshTabContent(tabContent));
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
        measurer.style.width = `${codeEl.clientWidth}px`;

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

    private static updateLineNumberStyles(shadowRoot: ShadowRoot, snapshot: LineNumberStyleSnapshot): void {
        let styleEl = this.styleSheets.get(shadowRoot);
        if (!styleEl) {
            styleEl = document.createElement("style");
            styleEl.dataset.codeTabsLineNum = "true";
            shadowRoot.appendChild(styleEl);
            this.styleSheets.set(shadowRoot, styleEl);
        }
        const container = snapshot.container;
        const row = snapshot.row;
        styleEl.textContent = `
.tab-line-num {
  color: ${container.color || "inherit"};
  background-color: ${container.backgroundColor || "transparent"};
  padding-top: ${container.paddingTop || "0px"};
  padding-right: ${container.paddingRight || "0px"};
  padding-bottom: ${container.paddingBottom || "0px"};
  padding-left: ${container.paddingLeft || "0px"};
  border-right: ${container.borderRight || "none"};
  font-family: ${container.fontFamily || "inherit"};
  font-size: ${container.fontSize || "inherit"};
  line-height: ${container.lineHeight || "normal"};
  text-align: ${container.textAlign || "right"};
}
.tab-line-num__row {
  color: ${row.color || "inherit"};
  font-size: ${row.fontSize || "inherit"};
  line-height: ${row.lineHeight || "normal"};
  font-family: ${row.fontFamily || "inherit"};
  text-align: ${row.textAlign || container.textAlign || "right"};
  display: block;
}
`;
    }

    private static estimatePaddingLeft(lineCount: number): number {
        const digits = Math.max(1, String(lineCount).length);
        if (digits <= 1) return 24;
        if (digits === 2) return 32;
        if (digits === 3) return 39;
        return 39 + (digits - 3) * 7;
    }

    private static cacheBasePaddingLeft(codeEl: HTMLElement, paddingLeft: string | undefined): void {
        if (codeEl.dataset.tabCodePaddingLeft) return;
        const value = paddingLeft ?? getComputedStyle(codeEl).paddingLeft;
        const parsed = this.parsePx(value);
        if (parsed === null || parsed <= 0) {
            codeEl.dataset.tabCodePaddingLeft = "32px";
            codeEl.dataset.tabCodePaddingLeftDefault = "1";
            return;
        }
        codeEl.dataset.tabCodePaddingLeft = value;
    }

    private static getBasePaddingLeft(codeEl: HTMLElement): number {
        const stored = codeEl.dataset.tabCodePaddingLeft;
        const parsed = stored ? this.parsePx(stored) : null;
        if (parsed !== null) return parsed;
        const computed = this.parsePx(getComputedStyle(codeEl).paddingLeft);
        if (computed === null || computed <= 0) {
            codeEl.dataset.tabCodePaddingLeft = "32px";
            codeEl.dataset.tabCodePaddingLeftDefault = "1";
            return 32;
        }
        return computed;
    }


    private static getStyleSnapshot(shadowRoot: ShadowRoot): LineNumberStyleSnapshot | null {
        if (this.styleCache) return this.styleCache;
        const host = shadowRoot.host as HTMLElement | null;
        if (!host) return null;
        const protyle = host.closest(".protyle");
        if (!protyle) return null;
        const sourceLineNum = protyle.querySelector<HTMLElement>(".protyle-linenumber__rows");
        const sourceLineNumRow = sourceLineNum?.querySelector<HTMLElement>("span");
        const sourceCode = protyle.querySelector<HTMLElement>(".hljs .code");
        const sourceEditable = protyle.querySelector<HTMLElement>('[data-type="NodeCodeBlock"] [contenteditable="true"]')
            ?? protyle.querySelector<HTMLElement>('.code-block [contenteditable="true"]');
        if (!sourceLineNum && !sourceCode) return null;

        const containerStyle = sourceLineNum ? getComputedStyle(sourceLineNum) : null;
        const rowStyle = sourceLineNumRow ? getComputedStyle(sourceLineNumRow) : null;
        const rowAfterStyle = sourceLineNumRow ? getComputedStyle(sourceLineNumRow, "::after") : null;
        const codeStyle = sourceEditable
            ? getComputedStyle(sourceEditable)
            : sourceCode
                ? getComputedStyle(sourceCode)
                : null;

        const rawWidth = sourceLineNum
            ? Math.round(sourceLineNum.getBoundingClientRect().width)
            : null;
        const lineNumWidth = rawWidth && rawWidth >= 12 ? rawWidth : null;
        const snapshot: LineNumberStyleSnapshot = {
            container: containerStyle
                ? this.pickStyles(containerStyle, [
                    "color",
                    "backgroundColor",
                    "paddingTop",
                    "paddingRight",
                    "paddingBottom",
                    "paddingLeft",
                    "borderRight",
                    "fontFamily",
                    "fontSize",
                    "lineHeight",
                    "textAlign"
                ])
                : {},
            row: rowStyle
                ? {
                    ...this.pickStyles(rowStyle, [
                        "color",
                        "fontSize",
                        "lineHeight",
                        "fontFamily"
                    ]),
                    textAlign: rowAfterStyle?.textAlign || rowStyle.textAlign
                }
                : {},
            codePadding: codeStyle
                ? {
                    top: codeStyle.paddingTop,
                    right: codeStyle.paddingRight,
                    bottom: codeStyle.paddingBottom,
                    left: codeStyle.paddingLeft
                }
                : null,
            lineNumWidth: lineNumWidth
        };

        this.styleCache = snapshot;
        return snapshot;
    }

    private static buildFallbackSnapshot(codeEl: HTMLElement): LineNumberStyleSnapshot {
        const codeStyle = getComputedStyle(codeEl);
        return {
            container: {
                color: codeStyle.color,
                fontSize: codeStyle.fontSize,
                fontFamily: codeStyle.fontFamily,
                lineHeight: codeStyle.lineHeight
            },
            row: {
                color: codeStyle.color,
                fontSize: codeStyle.fontSize,
                fontFamily: codeStyle.fontFamily,
                lineHeight: codeStyle.lineHeight
            },
            codePadding: {
                top: codeStyle.paddingTop,
                right: codeStyle.paddingRight,
                bottom: codeStyle.paddingBottom,
                left: codeStyle.paddingLeft
            },
            lineNumWidth: null
        };
    }

    private static pickStyles(style: CSSStyleDeclaration, keys: string[]): Record<string, string> {
        const out: Record<string, string> = {};
        for (const key of keys) {
            out[key] = (style as any)[key] ?? "";
        }
        return out;
    }

    private static parsePx(value: string): number | null {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
}

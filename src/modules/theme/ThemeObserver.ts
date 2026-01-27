import logger from "@/utils/logger";
import { debounce } from "@/utils/common";
import { t } from "@/utils/i18n";
import { getSiyuanConfig } from "@/utils/dom";
import { ThemeManager } from "@/modules/theme/ThemeManager";
import { LineNumberManager } from "@/modules/line-number/LineNumberManager";

export type StyleUpdatePlan = {
    codeStyle: boolean;
    background: boolean;
    markdown: boolean;
    lineNumbers: boolean;
    forceProbe: boolean;
};

type ThemeObserverOptions = {
    data: Record<string, unknown>;
    i18n: Record<string, string>;
    onSaveConfig: () => Promise<void>;
};

export class ThemeObserver {
    private readonly data: Record<string, unknown>;
    private readonly i18n: Record<string, string>;
    private readonly onSaveConfig: () => Promise<void>;
    private observer?: MutationObserver;
    private lastLineNumberEnabled?: boolean;

    constructor(options: ThemeObserverOptions) {
        this.data = options.data;
        this.i18n = options.i18n;
        this.onSaveConfig = options.onSaveConfig;
    }

    start(): void {
        if (this.observer) {
            this.stop();
        }
        const html = document.documentElement;
        const head = document.head;
        const debounced = debounce((plan: StyleUpdatePlan, persistConfig: boolean) => {
            this.applyStylePlan(plan, persistConfig);
        }, 500);
        const callback = (mutationsList: MutationRecord[]) => {
            this.handleThemeMutations(mutationsList, debounced);
        };
        this.observer = new MutationObserver(callback);
        this.observer.observe(html, { attributes: true, childList: false, subtree: false });
        this.observer.observe(head, { attributes: true, childList: true, subtree: true });
    }

    stop(): void {
        this.observer?.disconnect();
        this.observer = undefined;
    }

    async applyThemeStyles(plan?: StyleUpdatePlan): Promise<boolean> {
        const result = await ThemeManager.putStyleFile({
            forceProbe: plan?.forceProbe,
            update: plan
                ? {
                      background: plan.background,
                      codeStyle: plan.codeStyle,
                      markdown: plan.markdown,
                  }
                : undefined,
        });
        await this.onSaveConfig();
        if (result.changed) {
            ThemeManager.updateAllTabsStyle(result);
        }
        return result.changed;
    }

    private handleThemeMutations(
        mutationsList: MutationRecord[],
        onPlan: (plan: StyleUpdatePlan, persistConfig: boolean) => void
    ): void {
        const configChanges = this.getSiyuanConfigChanges();
        if (configChanges.keys.length > 0) {
            const plan = this.buildPlanFromConfigChanges(configChanges.keys);
            logger.info("检测到思源配置变更", {
                keys: configChanges.keys,
                labels: configChanges.labels,
                plan: this.describePlan(plan),
            });
            onPlan(plan, true);
            return;
        }

        for (const mutation of mutationsList) {
            const reason = this.getThemeMutationReason(mutation);
            if (reason) {
                const plan = this.buildPlanFromMutation(reason);
                logger.info("检测到主题相关变更", {
                    reason,
                    plan: this.describePlan(plan),
                    detail: this.describeMutation(mutation),
                });
                onPlan(plan, false);
                break;
            }
        }
    }

    private getThemeMutationReason(
        mutation: MutationRecord
    ):
        | "theme-mode"
        | "theme-light"
        | "theme-dark"
        | "html-attrs"
        | "theme-link"
        | "code-style-link"
        | null {
        if (mutation.target === document.documentElement && mutation.type === "attributes") {
            const attr = mutation.attributeName;
            if (attr === "data-theme-mode") return "theme-mode";
            if (attr === "data-light-theme") return "theme-light";
            if (attr === "data-dark-theme") return "theme-dark";
            // 其它 html 属性变动
            return "html-attrs";
        }

        const getLinkType = (node: Node): "theme-link" | "code-style-link" | null => {
            if (!(node instanceof HTMLLinkElement)) return null;
            if (node.id === "protyleHljsStyle") return "code-style-link";
            if (node.href.includes("/appearance/themes/")) return "theme-link";
            return null;
        };

        if (mutation.type === "childList") {
            const nodes = [
                ...Array.from(mutation.addedNodes as NodeList),
                ...Array.from(mutation.removedNodes as NodeList),
            ];
            for (const node of nodes) {
                const linkType = getLinkType(node);
                if (linkType) return linkType;
            }
            return null;
        }

        if (mutation.type === "attributes") {
            const linkType = getLinkType(mutation.target as Node);
            return linkType;
        }

        return null;
    }

    private getSiyuanConfigChanges(): { keys: string[]; labels: string[] } {
        const current = getSiyuanConfig();
        const changes: string[] = [];
        Object.keys(current).forEach((key) => {
            if (this.data[key] !== current[key]) {
                changes.push(key);
            }
        });
        const labels = changes.map((key) => this.mapConfigKeyToLabel(key));
        return { keys: changes, labels };
    }

    private mapConfigKeyToLabel(key: string): string {
        switch (key) {
            case "fontSize":
                return "字体大小";
            case "codeLigatures":
                return "代码连字";
            case "codeLineWrap":
                return "代码换行";
            case "codeSyntaxHighlightLineNum":
                return "代码行号";
            case "mode":
                return "主题模式";
            case "themeLight":
                return "浅色主题";
            case "themeDark":
                return "深色主题";
            case "codeBlockThemeLight":
                return "浅色代码主题";
            case "codeBlockThemeDark":
                return "深色代码主题";
            default:
                return key;
        }
    }

    private buildPlanFromConfigChanges(keys: string[]): StyleUpdatePlan {
        const plan: StyleUpdatePlan = {
            codeStyle: false,
            background: false,
            markdown: false,
            lineNumbers: false,
            forceProbe: false,
        };
        keys.forEach((key) => {
            switch (key) {
                case "codeLigatures":
                case "codeLineWrap":
                    plan.background = true;
                    break;
                case "codeSyntaxHighlightLineNum":
                    plan.lineNumbers = true;
                    break;
                case "fontSize":
                    plan.background = true;
                    plan.lineNumbers = true;
                    break;
                case "mode":
                    plan.background = true;
                    plan.codeStyle = true;
                    plan.markdown = true;
                    break;
                case "themeLight":
                case "themeDark":
                    plan.background = true;
                    plan.codeStyle = true;
                    break;
                case "codeBlockThemeLight":
                case "codeBlockThemeDark":
                    plan.codeStyle = true;
                    break;
                default:
                    plan.background = true;
                    break;
            }
        });
        return plan;
    }

    private buildPlanFromMutation(reason: string): StyleUpdatePlan {
        const plan: StyleUpdatePlan = {
            codeStyle: false,
            background: false,
            markdown: false,
            lineNumbers: false,
            forceProbe: false,
        };
        switch (reason) {
            case "theme-mode":
                plan.background = true;
                plan.codeStyle = true;
                plan.markdown = true;
                break;
            case "theme-light":
            case "theme-dark":
                plan.background = true;
                plan.codeStyle = true;
                break;
            case "theme-link":
                plan.background = true;
                plan.forceProbe = true;
                break;
            case "code-style-link":
                plan.codeStyle = true;
                break;
            default:
                plan.background = true;
                break;
        }
        return plan;
    }

    private describePlan(plan: StyleUpdatePlan): string[] {
        const result: string[] = [];
        if (plan.background) result.push("background.css");
        if (plan.codeStyle) result.push("code-style.css");
        if (plan.markdown) result.push("github-markdown.css");
        if (plan.lineNumbers) result.push("line-numbers");
        if (plan.forceProbe) result.push("force-probe");
        return result.length > 0 ? result : ["no-op"];
    }

    private applyStylePlan(plan: StyleUpdatePlan, persistConfig: boolean): void {
        const shouldUpdateTheme = plan.background || plan.codeStyle || plan.markdown;
        if (shouldUpdateTheme) {
            logger.info(t(this.i18n, "msg.codeStyleChange"), {
                plan: this.describePlan(plan),
            });
            this.applyThemeStyles(plan).then(() => {
                if (plan.lineNumbers) {
                    this.refreshLineNumbersIfNeeded();
                }
            });
            return;
        }

        if (persistConfig) {
            void this.onSaveConfig();
        }
        if (plan.lineNumbers) {
            this.refreshLineNumbersIfNeeded();
        }
    }

    private describeMutation(mutation: MutationRecord): Record<string, unknown> {
        if (mutation.type === "attributes") {
            return {
                type: mutation.type,
                attribute: mutation.attributeName,
                target: mutation.target instanceof Element ? mutation.target.tagName : "unknown",
            };
        }
        if (mutation.type === "childList") {
            const summary = (nodes: NodeList): string[] =>
                Array.from(nodes).map((node) => {
                    if (node instanceof HTMLLinkElement) {
                        return `link#${node.id || "unknown"}:${node.href}`;
                    }
                    return node.nodeName;
                });
            return {
                type: mutation.type,
                added: summary(mutation.addedNodes),
                removed: summary(mutation.removedNodes),
            };
        }
        return { type: mutation.type };
    }

    private refreshLineNumbersIfNeeded(): void {
        const enabled = LineNumberManager.isEnabled();
        if (this.lastLineNumberEnabled === undefined) {
            this.lastLineNumberEnabled = enabled;
        }
        if (enabled) {
            LineNumberManager.refreshAll();
        } else if (this.lastLineNumberEnabled) {
            LineNumberManager.cleanup();
        }
        this.lastLineNumberEnabled = enabled;
    }
}

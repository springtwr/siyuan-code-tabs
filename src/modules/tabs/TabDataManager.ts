import { getBlockAttrs, setBlockAttrs } from "@/api";
import { CODE_TABS_DATA_ATTR, CUSTOM_ATTR } from "@/constants";
import { decodeSource, encodeSource } from "@/utils/encoding";
import logger from "@/utils/logger";
import { TabParser } from "./TabParser";
import type { CodeTab, TabDataItem, TabsData } from "./types";

const CURRENT_VERSION = 2;
function normalizeTabs(tabs: TabDataItem[]): TabDataItem[] {
    return tabs
        .map((tab) => ({
            title: tab.title?.trim() ?? "",
            lang: TabDataManager.normalizeLanguage(tab.lang ?? ""),
            code: tab.code ?? "",
        }))
        .filter((tab) => tab.title.length > 0);
}

function decodeLegacyHtmlEntities(input: string): string {
    if (!input.includes("&")) return input;
    const textarea = document.createElement("textarea");
    textarea.innerHTML = input;
    return textarea.value;
}

export class TabDataManager {
    static clone(data: TabsData): TabsData {
        let cloned: TabsData;
        if (typeof structuredClone === "function") {
            cloned = structuredClone(data) as TabsData;
        } else {
            cloned = JSON.parse(JSON.stringify(data)) as TabsData;
        }
        return this.normalize(cloned);
    }

    static createDefaultData(titleIndex: number = 1): TabsData {
        return {
            version: CURRENT_VERSION,
            active: 0,
            tabs: [
                {
                    title: `Tab${titleIndex}`,
                    lang: "plaintext",
                    code: "在这里输入代码",
                },
            ],
        };
    }

    static fromCodeTabs(codeTabs: CodeTab[]): TabsData {
        const activeIndex = codeTabs.findIndex((tab) => tab.isActive);
        return {
            version: CURRENT_VERSION,
            active: activeIndex >= 0 ? activeIndex : 0,
            tabs: normalizeTabs(
                codeTabs.map((tab) => ({
                    title: tab.title,
                    lang: tab.language,
                    code: tab.code,
                }))
            ),
        };
    }

    static validate(data: TabsData): { ok: boolean; errors: string[] } {
        const errors: string[] = [];
        if (!data || typeof data !== "object") {
            return { ok: false, errors: ["data.invalid"] };
        }
        if (!Array.isArray(data.tabs) || data.tabs.length === 0) {
            errors.push("tabs.empty");
        }
        const tabs = normalizeTabs(data.tabs ?? []);
        if (tabs.length === 0) {
            errors.push("tabs.empty");
        }
        tabs.forEach((tab, index) => {
            if (!tab.title) errors.push(`tab.${index}.title.empty`);
            if (!tab.lang) errors.push(`tab.${index}.lang.empty`);
            if (!tab.code || tab.code.trim().length === 0) {
                errors.push(`tab.${index}.code.empty`);
            }
        });
        const activeIndex = data.active ?? 0;
        if (activeIndex < 0 || activeIndex >= tabs.length) {
            errors.push("active.outOfRange");
        }
        return { ok: errors.length === 0, errors };
    }

    static normalize(data: TabsData): TabsData {
        const tabs = normalizeTabs(data.tabs ?? []);
        const active = Math.min(Math.max(data.active ?? 0, 0), Math.max(tabs.length - 1, 0));
        return {
            version: CURRENT_VERSION,
            active,
            tabs,
        };
    }

    static normalizeLanguage(input: string): string {
        const lang = (input ?? "").trim().toLowerCase();
        if (lang === "markdown-render") return "markdown-render";
        if (!lang) return "plaintext";
        return window.hljs.getLanguage(lang) ? lang : "plaintext";
    }

    static encode(data: TabsData): string {
        const normalized = this.normalize(data);
        return encodeSource(JSON.stringify(normalized));
    }

    static decode(raw: string): TabsData | null {
        if (!raw) return null;
        try {
            const decoded = decodeSource(raw);
            const parsed = JSON.parse(decoded) as TabsData;
            return this.normalize(parsed);
        } catch (error) {
            logger.warn("解析 TabsData 失败", { error });
            return null;
        }
    }

    static readFromElement(element: HTMLElement | null): TabsData | null {
        if (!element) return null;
        const raw = element.getAttribute(CODE_TABS_DATA_ATTR);
        if (!raw) return null;
        return this.decode(raw);
    }

    static readFromAttrs(attrs?: Record<string, string>): TabsData | null {
        if (!attrs) return null;
        const raw = attrs[CODE_TABS_DATA_ATTR];
        if (!raw) return null;
        return this.decode(raw);
    }

    static async readFromBlock(nodeId: string): Promise<TabsData | null> {
        const attrs = await getBlockAttrs(nodeId);
        return this.readFromAttrs(attrs);
    }

    static async writeToBlock(nodeId: string, data: TabsData): Promise<void> {
        const encoded = this.encode(data);
        await setBlockAttrs(nodeId, { [CODE_TABS_DATA_ATTR]: encoded });
    }

    static upgradeFromLegacy(codeText: string): TabsData | null {
        let text = codeText;
        if (text.trim().startsWith("tab:::")) {
            text = decodeLegacyHtmlEntities(text);
        }
        const parsed = TabParser.checkCodeText(text);
        if (!parsed.result) return null;
        return this.fromCodeTabs(parsed.code);
    }

    static decodeLegacySourceFromAttrs(attrs?: Record<string, string>): string | null {
        if (!attrs) return null;
        const raw = attrs[CUSTOM_ATTR];
        if (!raw) return null;
        return decodeSource(raw);
    }
}

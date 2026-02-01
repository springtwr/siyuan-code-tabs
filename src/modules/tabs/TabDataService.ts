import { getBlockAttrs, setBlockAttrs } from "@/api";
import { CODE_TABS_DATA_ATTR, CUSTOM_ATTR } from "@/constants";
import { decodeSource, encodeSource } from "@/utils/encoding";
import logger from "@/utils/logger";
import { LegacyTabParser } from "./LegacyTabParser";
import { normalizeLanguageInput } from "@/modules/tabs/language";
import type { CodeTab, TabDataItem, TabsData } from "./types";

const CURRENT_VERSION = 2;
/**
 * 规范化标签数组，保证标题与语言字段可用。
 * @param tabs 原始 tabs
 * @returns 规范化后的 tabs
 */
function normalizeTabs(tabs: TabDataItem[]): TabDataItem[] {
    return tabs
        .map((tab) => ({
            title: tab.title?.trim() ?? "",
            lang: normalizeLanguageInput(tab.lang ?? ""),
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

/**
 * Tabs 数据的读写、校验与迁移入口。
 * 副作用：读写块属性。
 */
export class TabDataService {
    /**
     * 深拷贝并规范化数据，避免 UI 直接修改原对象。
     * @param data tabs 数据
     * @returns 规范化后的新对象
     */
    static clone(data: TabsData): TabsData {
        let cloned: TabsData;
        if (typeof structuredClone === "function") {
            cloned = structuredClone(data) as TabsData;
        } else {
            cloned = JSON.parse(JSON.stringify(data)) as TabsData;
        }
        return this.normalize(cloned);
    }

    /**
     * 创建默认 tabs 数据。
     * @param titleIndex 标题序号起始值
     * @returns TabsData
     */
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

    /**
     * 从解析结果生成 Tabs 数据。
     * @param codeTabs 解析后的 tab 列表
     * @returns TabsData
     */
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

    /**
     * 校验 tabs 数据结构与内容。
     * @param data tabs 数据
     * @returns 校验结果
     */
    static validate(data: TabsData): { ok: boolean; errors: string[] } {
        // 校验要基于原始输入，避免 normalize 掩盖错误
        const errors: string[] = [];
        if (!data || typeof data !== "object") {
            return { ok: false, errors: ["data.invalid"] };
        }
        if (!Array.isArray(data.tabs) || data.tabs.length === 0) {
            errors.push("tabs.empty");
        }
        const tabs = Array.isArray(data.tabs) ? data.tabs : [];
        tabs.forEach((tab, index) => {
            const title = tab.title?.trim() ?? "";
            const lang = normalizeLanguageInput(tab.lang ?? "");
            const code = tab.code ?? "";
            if (!title) errors.push(`tab.${index}.title.empty`);
            if (!lang) errors.push(`tab.${index}.lang.empty`);
            if (!code || code.trim().length === 0) {
                errors.push(`tab.${index}.code.empty`);
            }
        });
        const activeIndex = data.active ?? 0;
        if (activeIndex < 0 || activeIndex >= tabs.length) {
            errors.push("active.outOfRange");
        }
        return { ok: errors.length === 0, errors };
    }

    /**
     * 规范化 tabs 数据。
     * @param data 原始数据
     * @returns 规范化后的数据
     */
    static normalize(data: TabsData): TabsData {
        const tabs = normalizeTabs(data.tabs ?? []);
        const active = Math.min(Math.max(data.active ?? 0, 0), Math.max(tabs.length - 1, 0));
        return {
            version: CURRENT_VERSION,
            active,
            tabs,
        };
    }

    /**
     * 编码数据为可存储字符串。
     * @param data tabs 数据
     * @returns 编码后的字符串
     */
    static encode(data: TabsData): string {
        const normalized = this.normalize(data);
        return encodeSource(JSON.stringify(normalized));
    }

    /**
     * 解码存储字符串为 tabs 数据。
     * @param raw 存储字符串
     * @returns TabsData 或 null
     */
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

    /**
     * 从 HTML 块属性读取 tabs 数据。
     * @param element HTML 块
     * @returns TabsData 或 null
     */
    static readFromElement(element: HTMLElement | null): TabsData | null {
        if (!element) return null;
        const raw = element.getAttribute(CODE_TABS_DATA_ATTR);
        if (!raw) return null;
        return this.decode(raw);
    }

    /**
     * 从属性集合读取 tabs 数据。
     * @param attrs 属性集合
     * @returns TabsData 或 null
     */
    static readFromAttrs(attrs?: Record<string, string>): TabsData | null {
        if (!attrs) return null;
        const raw = attrs[CODE_TABS_DATA_ATTR];
        if (!raw) return null;
        return this.decode(raw);
    }

    /**
     * 从块读取 tabs 数据。
     * @param nodeId 块 ID
     * @returns TabsData 或 null
     */
    static async readFromBlock(nodeId: string): Promise<TabsData | null> {
        const attrs = await getBlockAttrs(nodeId);
        return this.readFromAttrs(attrs);
    }

    /**
     * 将 tabs 数据写入块属性。
     * @param nodeId 块 ID
     * @param data tabs 数据
     * @returns Promise<void>
     */
    static async writeToBlock(nodeId: string, data: TabsData): Promise<void> {
        // 副作用：写入块属性
        const encoded = this.encode(data);
        await setBlockAttrs(nodeId, { [CODE_TABS_DATA_ATTR]: encoded });
    }

    /**
     * 从旧语法文本升级为 TabsData。
     * @param codeText 旧语法文本
     * @returns TabsData 或 null
     */
    static upgradeFromLegacy(codeText: string): TabsData | null {
        // 兼容：旧版本使用 tab::: 且包含 HTML 实体
        let text = codeText;
        if (text.trim().startsWith("tab:::")) {
            text = decodeLegacyHtmlEntities(text);
        }
        const parsed = LegacyTabParser.parseTabSyntax(text);
        if (!parsed.result) return null;
        return this.fromCodeTabs(parsed.code);
    }

    /**
     * 从旧属性读取源字符串。
     * @param attrs 属性集合
     * @returns 解码后的字符串或 null
     */
    static decodeLegacySourceFromAttrs(attrs?: Record<string, string>): string | null {
        if (!attrs) return null;
        const raw = attrs[CUSTOM_ATTR];
        if (!raw) return null;
        return decodeSource(raw);
    }
}

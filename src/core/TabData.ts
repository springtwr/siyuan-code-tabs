import { getBlockAttrs, setBlockAttrs } from "@/api";
import {
    CODE_TABS_DATA_ATTR,
    CODE_TABS_METADATA_ATTR,
    CUSTOM_ATTR,
    DATA_VERSION,
    HTML_TEMPLATE_VERSION,
} from "@/constants";
import { decodeJson, decodeSource, encodeJson } from "@/utils/encoding";
import logger from "@/utils/logger";
import { LegacyTabParser } from "@/utils/LegacyTabParser";
import { normalizeLanguageInput } from "@/utils/language";
import type { CodeTab, CodeTabSource, CodeTabsMetadata, TabDataItem, TabsData } from "@/types/tabs";

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
export class TabData {
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
        return encodeJson(normalized);
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
            const parsed = JSON.parse(decoded) as TabsData & { version?: number };
            // 兼容旧版：移除 version 字段
            if ("version" in parsed) {
                delete (parsed as Record<string, unknown>).version;
            }
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

    /**
     * 生成唯一 ID。
     * @returns 唯一 ID 字符串
     */
    private static generateId(): string {
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
    }

    /**
     * 创建当前版本的元数据；传入已有元数据时保留其 id 并刷新版本号。
     * @param existing 已有元数据（可选，仅需 id）
     * @returns CodeTabsMetadata
     */
    static createMetadata(existing?: Pick<CodeTabsMetadata, "id"> | null): CodeTabsMetadata {
        return {
            id: existing?.id || this.generateId(),
            dataVersion: DATA_VERSION,
            htmlVersion: HTML_TEMPLATE_VERSION,
        };
    }

    /**
     * 编码元数据为 Base64 字符串（与 encode 一致，安全存储于 SiYuan IAL）。
     * @param metadata 元数据
     * @returns Base64 编码字符串
     */
    static encodeMetadata(metadata: CodeTabsMetadata): string {
        return encodeJson(metadata);
    }

    /**
     * 解码 Base64 元数据字符串。
     * @param raw 原始字符串
     * @returns CodeTabsMetadata 或 null
     */
    static decodeMetadata(raw: string): CodeTabsMetadata | null {
        return decodeJson<CodeTabsMetadata>(raw);
    }

    /**
     * 编码分组来源信息为 Base64 字符串（与 metadata 一致，安全存储于 SiYuan IAL）。
     * @param source 分组来源信息
     * @returns Base64 编码字符串
     */
    static encodeTabSource(source: CodeTabSource): string {
        return encodeJson(source);
    }

    /**
     * 解码 Base64 分组来源信息字符串。
     * @param raw 原始字符串
     * @returns CodeTabSource 或 null（结构非法时返回 null）
     */
    static decodeTabSource(raw: string): CodeTabSource | null {
        const parsed = decodeJson<Partial<CodeTabSource>>(raw);
        if (typeof parsed?.id !== "string" || !parsed.id) return null;
        return {
            id: parsed.id,
            order: typeof parsed.order === "number" ? parsed.order : NaN,
            active: typeof parsed.active === "boolean" ? parsed.active : undefined,
            title: typeof parsed.title === "string" ? parsed.title : undefined,
        };
    }

    /**
     * 检查元数据是否为当前版本。
     * @param metadata 元数据
     * @returns 是否当前版本
     */
    static isMetadataCurrent(metadata: CodeTabsMetadata | null): boolean {
        if (!metadata) return false;
        return (
            !!metadata.id &&
            metadata.dataVersion >= DATA_VERSION &&
            metadata.htmlVersion >= HTML_TEMPLATE_VERSION
        );
    }

    /**
     * 一次性写入数据 + 元数据（合并为单次 setBlockAttrs 调用）。
     * @param nodeId 块 ID
     * @param data tabs 数据
     * @param metadata 元数据
     */
    static async writeFullToBlock(
        nodeId: string,
        data: TabsData,
        metadata: CodeTabsMetadata
    ): Promise<void> {
        await setBlockAttrs(nodeId, {
            [CODE_TABS_DATA_ATTR]: this.encode(data),
            [CODE_TABS_METADATA_ATTR]: this.encodeMetadata(metadata),
        });
    }
}

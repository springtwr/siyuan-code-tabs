import { FENCED_BLOCK_META } from "@/constants";

/**
 * Tabs 相关类型定义。
 */

export type CodeTab = {
    title: string;
    language: string;
    code: string;
    isActive: boolean;
};

export type TabWidthSetting = {
    mode: "auto" | "max-chars";
    maxChars: number;
};

export type TabDataItem = {
    title: string;
    lang: string;
    code: string;
};

export type TabsData = {
    active: number;
    tabs: TabDataItem[];
};

export type CodeTabsMetadata = {
    id: string;
    dataVersion: number;
    htmlVersion: number;
};

/**
 * 拆分标签页时写入代码块的分组来源信息（Base64 JSON 存储于 CODE_TAB_SOURCE_ATTR）。
 */
export type CodeTabSource = {
    /** 来源标签页的 metadata id，用于一键合并识别分组 */
    id: string;
    /** 在来源标签页中的顺序索引 */
    order: number;
    /** 是否为默认（激活）标签，合并时用于还原 */
    active?: boolean;
    /** 自定义标题（默认标题不存储，合并时回退为 Tab{n}） */
    title?: string;
};

export type FencedBlockType = keyof typeof FENCED_BLOCK_META;

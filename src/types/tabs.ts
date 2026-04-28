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
    version: number;
    active: number;
    tabs: TabDataItem[];
};

export type FencedBlockType = keyof typeof FENCED_BLOCK_META;

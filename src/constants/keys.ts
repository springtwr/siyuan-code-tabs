/**
 * 业务标识与固定常量。
 */
export const CUSTOM_ATTR = "custom-plugin-code-tabs-sourcecode";
export const CODE_TABS_DATA_ATTR = "custom-code-tabs-data";
export const CODE_TAB_TITLE_ATTR = "custom-code-tab-title";
export const NEWLINE_FLAG = "⤵↩";
export const TAB_WIDTH_MIN = 3;
export const TAB_WIDTH_MAX = 20;
export const TAB_WIDTH_DEFAULT = 12;
export const TAB_WIDTH_SETTING_KEY = "codeTabsTabWidth";
export const LEGACY_CHECK_VERSION_KEY = "codeTabsLegacyCheckVersion";
export const LEGACY_EXISTS_KEY = "codeTabsLegacyExists";
export const LEGACY_COUNT_KEY = "codeTabsLegacyCount";
export const PLUGIN_VERSION = __PLUGIN_VERSION__;

export const HLJS_SCRIPT_ID = "protyleHljsScript";
export const HLJS_THIRD_SCRIPT_ID = "protyleHljsThirdScript";

export const FENCED_BLOCK_MARKDOWN = {
    katex: "$$\n\n$$",
    hljs: "```\n\n```",
    mermaid: "```mermaid\n\n```",
    mindmap: "```mindmap\n\n```",
    echarts: "```echarts\n\n```",
    abc: "```abc\n\n```",
    graphviz: "```graphviz\n\n```",
    flowchart: "```flowchart\n\n```",
    plantuml: "```plantuml\n\n```",
} as const;

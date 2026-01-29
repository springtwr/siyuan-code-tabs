export const CUSTOM_ATTR = "custom-plugin-code-tabs-sourcecode";
export const CODE_TABS_DATA_ATTR = "custom-code-tabs-data";
export const CODE_TAB_TITLE_ATTR = "custom-code-tab-title";
export const NEWLINE_FLAG = "⤵↩";
export const TAB_SEPARATOR = "```````````````````````````";
export const TAB_WIDTH_MIN = 3;
export const TAB_WIDTH_MAX = 20;
export const TAB_WIDTH_DEFAULT = 12;
export const TAB_WIDTH_SETTING_KEY = "codeTabsTabWidth";

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

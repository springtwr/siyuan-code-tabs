import { SIYUAN_PATH } from "./paths";

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

const ECHARTS_SCRIPTS = [
    {
        src: `${SIYUAN_PATH}/js/echarts/echarts.min.js`,
        id: "protyleEchartsScript",
    },
    {
        src: `${SIYUAN_PATH}/js/echarts/echarts-gl.min.js`,
        id: "protyleEchartsGLScript",
    },
] as const;

export const FENCED_BLOCK_META = {
    katex: {
        markdown: "$$\n\n$$",
        scripts: [
            {
                src: `${SIYUAN_PATH}/js/katex/katex.min.js`,
                id: "protyleKatexScript",
            },
            {
                src: `${SIYUAN_PATH}/js/katex/mhchem.min.js`,
                id: "protyleKatexMhchemScript",
            },
        ],
    },
    hljs: {
        markdown: "```\n\n```",
        scripts: [
            {
                src: `${SIYUAN_PATH}/js/highlight.js/highlight.min.js`,
                id: "protyleHljsScript",
            },
            {
                src: `${SIYUAN_PATH}/js/highlight.js/third-languages.js`,
                id: "protyleHljsThirdScript",
            },
        ],
    },
    mermaid: {
        markdown: "```mermaid\n\n```",
        scripts: [
            {
                src: `${SIYUAN_PATH}/js/mermaid/mermaid.min.js`,
                id: "protyleMermaidScript",
            },
            {
                src: `${SIYUAN_PATH}/js/mermaid/mermaid-zenuml.min.js`,
                id: "protyleMermaidZenumlScript",
            },
        ],
    },
    abc: {
        markdown: "```abc\n\n```",
        scripts: [
            {
                src: `${SIYUAN_PATH}/js/abcjs/abcjs-basic-min.min.js`,
                id: "protyleAbcjsScript",
            },
        ],
    },
    graphviz: {
        markdown: "```graphviz\n\n```",
        scripts: [
            {
                src: `${SIYUAN_PATH}/js/graphviz/viz.js`,
                id: "protyleGraphVizScript",
            },
        ],
    },
    plantuml: {
        markdown: "```plantuml\n\n```",
        scripts: [
            {
                src: `${SIYUAN_PATH}/js/plantuml/plantuml-encoder.min.js`,
                id: "protylePlantumlScript",
            },
        ],
    },
    flowchart: {
        markdown: "```flowchart\n\n```",
        scripts: [
            {
                src: `${SIYUAN_PATH}/js/flowchart.js/flowchart.min.js`,
                id: "protyleFlowchartScript",
            },
        ],
    },
    mindmap: {
        markdown: "```mindmap\n\n```",
        scripts: ECHARTS_SCRIPTS,
    },
    echarts: {
        markdown: "```echarts\n\n```",
        scripts: ECHARTS_SCRIPTS,
    },
} as const;

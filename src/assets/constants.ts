export const CUSTOM_ATTR = 'custom-plugin-code-tabs-sourcecode';
export const NEWLINE_FLAG = '⤵↩';
export const TAB_SEPARATOR = '```````````````````````````';

// URL 常量
export const PLUGIN_PATH = '/plugins/code-tabs';
export const DATA_PATH = '/data/plugins/code-tabs';

// 配置文件路径
export const CONFIG_JSON = `${DATA_PATH}/custom/config.json`;
export const THEME_ADAPTION_YAML = `${DATA_PATH}/custom/theme-adaption.yaml`;
export const THEME_ADAPTION_ASSET_YAML = `${PLUGIN_PATH}/asset/theme-adaption.yaml`;

// 样式文件路径
export const CODE_STYLE_CSS = `${DATA_PATH}/custom/code-style.css`;
export const BACKGROUND_CSS = `${DATA_PATH}/custom/background.css`;
export const GITHUB_MARKDOWN_CSS = `${DATA_PATH}/custom/github-markdown.css`;
export const GITHUB_MARKDOWN_DARK_CSS = `${PLUGIN_PATH}/asset/github-markdown-dark.css`;
export const GITHUB_MARKDOWN_LIGHT_CSS = `${PLUGIN_PATH}/asset/github-markdown-light.css`;

// 其他资源路径
export const KATEX_CSS = `${PLUGIN_PATH}/asset/katex.min.css`;
export const CODE_TABS_CSS = `${PLUGIN_PATH}/asset/code-tabs.css`;
export const COPY_PNG = `${PLUGIN_PATH}/asset/copy.png`;

export const htmlBlockStr = `
<div data-type="NodeHTMLBlock" class="render-node" data-subtype="block">
    <div class="protyle-icons">
        <span aria-label="编辑" class="b3-tooltips__nw b3-tooltips protyle-icon protyle-icon--first protyle-action__edit">
            <svg><use xlink:href="#iconEdit"></use></svg>
        </span>
        <span aria-label="更多" class="b3-tooltips__nw b3-tooltips protyle-icon protyle-action__menu protyle-icon--last">
            <svg><use xlink:href="#iconMore"></use></svg>
        </span>
    </div>
    <div>
        <protyle-html></protyle-html>
        <span style="position: absolute"></span>
    </div>
    <div class="protyle-attr" contenteditable="false"></div>
</div>`.replace(/>\s+</g, '><').trim();

export const protyleHtmlStr = `
<div> 
    <link rel="stylesheet" href="${CODE_STYLE_CSS.replace(DATA_PATH, PLUGIN_PATH)}">  
    <link rel="stylesheet" href="${GITHUB_MARKDOWN_CSS.replace(DATA_PATH, PLUGIN_PATH)}">
    <link rel="stylesheet" href="${KATEX_CSS}">
    <link rel="stylesheet" href="${CODE_TABS_CSS}">
    <link rel="stylesheet" href="${BACKGROUND_CSS.replace(DATA_PATH, PLUGIN_PATH)}">
    <div class="tabs-container">
        <div class="tabs-outer">
            <div class="tabs"></div>
            <div class="tab-toggle"></div>
        </div>
        <div class="tab-contents">
            <span class="code-tabs--icon_copy" onclick="pluginCodeTabs.copyCode(event)">
                <img src="${COPY_PNG}" alt="复制">
            </span>
        </div>
    </div>
</div>`.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

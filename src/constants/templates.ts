import {
    BACKGROUND_CSS,
    CODE_STYLE_CSS,
    CODE_TABS_CSS,
    CODE_TABS_ICONS,
    DATA_PATH,
    GITHUB_MARKDOWN_CSS,
    KATEX_CSS,
    PLUGIN_PATH,
} from "./paths";
import { CODE_TABS_DATA_ATTR, CUSTOM_ATTR } from "./keys";

/**
 * CSS 模板与 HTML 结构模板。
 */
export const CODE_TABS_STYLE = `
div[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}],
div[data-type="NodeHTMLBlock"][${CODE_TABS_DATA_ATTR}] { 
    padding: 0 !important; 
    margin: 0 !important; 
    border: none !important;
}

div[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}] > .protyle-icons,
div[data-type="NodeHTMLBlock"][${CODE_TABS_DATA_ATTR}] > .protyle-icons {
    display: none !important;
}

.code-tabs__setting-color {
    gap: 6px;
    flex-direction: column;
    align-items: flex-end;
}

.code-tabs__setting-color-input {
    width: 200px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
}

.code-tabs__setting-width {
    display: grid;
    grid-template-columns: 140px 56px;
    gap: 6px;
    align-items: center;
}

.code-tabs__setting-width-select {
    width: 140px;
    height: 28px;
}

.code-tabs__setting-width-input {
    width: 56px;
    height: 28px;
    text-align: center;
}

.code-tabs__setting-width-input:disabled {
    opacity: 0.6;
}

.code-tabs__task {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 9999;
    background: var(--b3-theme-background, #fff);
    color: var(--b3-theme-on-surface, #333);
    border: 1px solid var(--b3-theme-surface-lighter, #ddd);
    border-radius: 8px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.12);
    padding: 10px 12px;
    min-width: 220px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.code-tabs__task-title {
    font-weight: 600;
}

.code-tabs__task-text {
    font-size: 12px;
    opacity: 0.85;
}

.code-tabs__editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    min-height: 0;
    container-type: inline-size;
}

.code-tabs__editor-body {
    display: grid;
    grid-template-columns: minmax(140px, 200px) minmax(280px, 1fr);
    gap: 16px;
    align-items: stretch;
    flex: 1;
    min-height: 0;
    overflow: auto;
}

.code-tabs__editor-left {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px;
    border: 1px solid var(--b3-theme-surface-lighter, #ddd);
    border-radius: 8px;
    background: var(--b3-theme-surface, #f5f5f5);
    min-height: 0;
    min-width: 0;
}

.code-tabs__editor-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--b3-theme-surface-lighter, #ddd);
    border-radius: 8px;
    background: var(--b3-theme-surface, #f5f5f5);
    min-height: 0;
    min-width: 0;
}

.code-tabs__editor-label {
    font-size: 12px;
    opacity: 0.8;
}

.code-tabs__editor-input {
    width: 100%;
}

.code-tabs__editor-lang {
    position: relative;
}

.code-tabs__editor-lang-suggest {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 4px);
    z-index: 10;
    display: none;
    flex-direction: column;
    gap: 2px;
    max-height: 200px;
    overflow: auto;
    padding: 6px;
    border: 1px solid var(--b3-theme-surface-lighter, #ddd);
    border-radius: 6px;
    background: var(--b3-theme-background, #fff);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
}

.code-tabs__editor-lang-suggest--open {
    display: flex;
}

.code-tabs__editor-lang-option {
    border: none;
    background: transparent;
    text-align: left;
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
    color: var(--b3-theme-on-background, #333);
    user-select: none;
}

.code-tabs__editor-lang-option:hover {
    background: var(--b3-theme-surface-lighter, #f2f2f2);
}

.code-tabs__editor-input[data-field="lang"][list] {
    -webkit-appearance: none;
    appearance: textfield;
    background-image: none;
}

.code-tabs__editor-input[data-field="lang"][list]::-webkit-calendar-picker-indicator {
    display: none;
    opacity: 0;
}

.code-tabs__editor-input[data-field="lang"][list]::-webkit-list-button {
    display: none;
}

.code-tabs__editor-textarea {
    min-height: 140px;
    flex: 1;
    resize: none;
    font-family: var(--b3-font-family-code);
    line-height: 1.5;
}

.code-tabs__editor-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: auto;
    flex: 1;
    min-height: 0;
    padding-bottom: 6px;
}

.code-tabs__editor-item {
    border: 1px solid var(--b3-theme-surface-lighter, #ddd);
    border-radius: 6px;
    padding: 6px 8px;
    text-align: left;
    cursor: pointer;
    background: var(--b3-theme-background, #fff);
    color: var(--b3-theme-on-background, #333);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    min-height: 28px;
    position: relative;
}

.code-tabs__editor-item-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.code-tabs__editor-item-default {
    flex-shrink: 0;
    border: none;
    background: transparent;
    padding: 2px 4px;
    border-radius: 4px;
    cursor: pointer;
    color: var(--b3-theme-on-surface, #666);
}

.code-tabs__editor-item-default svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
    stroke: currentColor;
}

.code-tabs__editor-item-default--active {
    color: var(--b3-theme-primary, #5b8def);
}

.code-tabs__editor-item-default:hover {
    background: var(--b3-theme-surface-lighter, #f2f2f2);
}

.code-tabs__editor-item-handle {
    flex-shrink: 0;
    padding: 2px 4px;
    border-radius: 4px;
    cursor: grab;
    touch-action: none;
    color: var(--b3-theme-on-surface, #666);
}

.code-tabs__editor-item-handle svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
    stroke: currentColor;
}

.code-tabs__editor-item-handle:active {
    cursor: grabbing;
}

.code-tabs__editor-item--active {
    border-color: var(--b3-theme-primary, #5b8def);
    background: var(--b3-theme-primary-lighter, #e8f0fe);
    color: var(--b3-theme-on-primary, #1a1a1a);
}

.code-tabs__editor-item--drop-before::before,
.code-tabs__editor-item--drop-after::after {
    content: "";
    position: absolute;
    left: 6px;
    right: 6px;
    height: 2px;
    background: var(--b3-theme-primary, #5b8def);
    border-radius: 2px;
}

.code-tabs__editor-item--drop-before::before {
    top: -1px;
}

.code-tabs__editor-item--drop-after::after {
    bottom: -1px;
}

.code-tabs__editor-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    margin-top: auto;
}

.code-tabs__editor-actions .b3-button {
    width: 100%;
}

@container (max-width: 520px) {
    .code-tabs__editor-body {
        grid-template-columns: 1fr;
        overflow: auto;
    }

    .code-tabs__editor-left,
    .code-tabs__editor-right {
        min-width: 0;
    }
}

@container (max-height: 420px) {
    .code-tabs__editor-body {
        grid-template-columns: 1fr;
        overflow: auto;
    }

    .code-tabs__editor-left {
        order: 2;
    }

    .code-tabs__editor-right {
        order: 1;
    }
}

.code-tabs__editor-dialog {
    max-height: calc(100vh - 120px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.code-tabs__editor-dialog .b3-dialog__body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 200px);
    overflow: auto;
}

.code-tabs__editor-dialog .code-tabs__editor {
    flex: 1;
    min-height: 0;
}

.code-tabs__editor-dialog .b3-dialog__action {
    flex-shrink: 0;
}

`.trim();

export const PROTYLE_HTML = `
<link rel="stylesheet" href="${CODE_STYLE_CSS.replace(DATA_PATH, PLUGIN_PATH)}">  
<link rel="stylesheet" href="${GITHUB_MARKDOWN_CSS.replace(DATA_PATH, PLUGIN_PATH)}">
<link rel="stylesheet" href="${KATEX_CSS}">
<link rel="stylesheet" href="${CODE_TABS_CSS}">
<link rel="stylesheet" href="${BACKGROUND_CSS.replace(DATA_PATH, PLUGIN_PATH)}">
<div class="tabs-container">
    <div class="tabs-outer">
        <div class="tabs"></div>
        <span class="code-tabs--icon_group">
            <span class="code-tabs--icon_default" onclick="pluginCodeTabs.setDefault(event)" title="设为默认">
                <svg width="14" height="14" style="display:block">
                    <use xlink:href="${CODE_TABS_ICONS}#iconStar"></use>
                </svg>
            </span>
            <span class="code-tabs--icon_edit" onclick="pluginCodeTabs.editTab(event)" title="编辑">
                <svg width="14" height="14" style="display:block">
                    <use xlink:href="${CODE_TABS_ICONS}#iconEdit"></use>
                </svg>
            </span>
            <span class="code-tabs--icon_copy" onclick="pluginCodeTabs.copyCode(event)" title="复制">
                <svg width="14" height="14" style="display:block">
                    <use xlink:href="${CODE_TABS_ICONS}#iconCopy"></use>
                </svg>
            </span>
        </span>
    </div>
    <div class="tab-contents">
    </div>
</div>`
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim();

export const ICON_MAIN = `<svg id="iconCodeTabsMain" viewBox="0 0 500 500">
  <path d="M 92.837891,40 C 51.377247,40 18,73.45 18,115 v 270 c 0,41.55 33.377247,75 74.837891,75 H 407.16211 C 448.62275,460 482,426.55 482,385 V 115 C 482,73.45 448.62275,40 407.16211,40 Z m 2.433593,50 H 127.58984 A 28.410985,28.410985 0 0 1 156,118.41016 V 186 c 0,0 0.11959,8.14544 5.56641,14.30273 4.38561,4.95765 11.06504,5.62518 13.50195,5.69727 H 176 402 c 16.62,0 30,16.77757 30,37.61719 V 372.38281 C 432,393.22243 418.62,410 402,410 H 98 C 81.379999,410 68,393.22243 68,372.38281 V 243.61719 117.27148 A 27.271843,27.271843 0 0 1 95.271484,90 Z M 216,90 h 68 c 5.54,0 10,4.46 10,10 v 46 c 0,5.54 -4.46,10 -10,10 h -68 c -5.54,0 -10,-4.46 -10,-10 v -46 c 0,-5.54 4.46,-10 10,-10 z m 138,0 h 68 c 5.54,0 10,4.46 10,10 v 46 c 0,5.54 -4.46,10 -10,10 h -68 c -5.54,0 -10,-4.46 -10,-10 v -46 c 0,-5.54 4.46,-10 10,-10 z" />
  <path d="m 244.32031,279.03906 c -7.04,0 -13.5462,0.69341 -19.51953,2.08008 -5.86667,1.38667 -11.09497,3.2549 -15.68164,5.60156 l 7.04102,16.47852 c 4.05333,-1.81333 8.16031,-3.35867 12.32031,-4.63867 4.16,-1.28 8.21349,-1.91993 12.16015,-1.91993 4.16,0 7.4131,1.06589 9.75977,3.19922 2.45333,2.02667 3.67969,5.6542 3.67969,10.88086 v 2.71875 l -14.56055,0.48047 c -13.12,0.53334 -22.98627,3.14651 -29.59961,7.83985 -6.61333,4.58666 -9.91992,11.4138 -9.91992,20.48046 0,9.28 2.55969,16.16063 7.67969,20.64063 5.12,4.48 11.52117,6.71875 19.20117,6.71875 7.36,0 13.06581,-1.06589 17.11914,-3.19922 4.16,-2.13333 8.16,-5.5469 12,-10.24023 h 0.64062 L 261.2793,368 h 16.80078 v -58.24023 c 0,-10.13334 -2.93412,-17.75891 -8.80078,-22.87891 -5.76,-5.22667 -14.07899,-7.8418 -24.95899,-7.8418 z m 9.75977,48.48047 v 7.20117 c 0,5.54667 -1.7593,9.81216 -5.2793,12.79883 C 245.38745,350.5062 241.17349,352 236.16016,352 c -3.52,0 -6.34714,-0.85388 -8.48047,-2.56055 -2.02667,-1.81333 -3.03907,-4.58698 -3.03907,-8.32031 10e-6,-4.05333 1.44032,-7.19945 4.32032,-9.43945 2.98666,-2.24 8.32,-3.46636 16,-3.67969 z" />
  <path d="M 311.12109,246.40039 V 368 h 18.5586 l 4,-9.43945 h 1.59961 c 2.34666,2.77333 5.33427,5.33302 8.96093,7.67968 3.73334,2.24 8.79922,3.35938 15.19922,3.35938 10.02667,0 18.08016,-3.83953 24.16016,-11.51953 6.18667,-7.68 9.28125,-18.98659 9.28125,-33.91992 0,-14.82667 -3.04109,-26.02628 -9.12109,-33.59961 -6.08,-7.68 -13.97303,-11.52149 -23.67969,-11.52149 -6.29334,0 -11.41271,1.2818 -15.35938,3.8418 -3.94666,2.45333 -7.09474,5.49247 -9.4414,9.11914 h -0.95899 c 0.21334,-2.24 0.42729,-4.85318 0.64063,-7.83984 0.21333,-2.98667 0.31836,-6.13279 0.31836,-9.43946 v -28.32031 z m 41.11914,51.83984 c 10.77334,0 16.16016,8.53295 16.16016,25.59961 0,8.53334 -1.33333,15.03953 -4,19.51953 -2.66667,4.48001 -6.61318,6.72071 -11.83984,6.72071 -6.50667,0 -11.03961,-2.08024 -13.59961,-6.24024 -2.45334,-4.26666 -3.68164,-10.5589 -3.68164,-18.8789 v -2.88086 c 0,-8.21334 1.28179,-14.24008 3.84179,-18.08008 2.66667,-3.84 7.03914,-5.75977 13.11914,-5.75977 z" />
  <path d="m 107.11914,253.75977 v 20.32031 H 138 V 368 h 24.48047 v -93.91992 h 30.8789 v -20.32031 z" />
</svg>`;

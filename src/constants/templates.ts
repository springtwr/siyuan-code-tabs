import {BACKGROUND_CSS, CODE_STYLE_CSS, CODE_TABS_CSS, COPY_PNG, DATA_PATH, GITHUB_MARKDOWN_CSS, KATEX_CSS, PLUGIN_PATH} from "./paths";
import {CUSTOM_ATTR} from "./keys";

export const HTML_BLOCK_STYLE = `
div[data-type="NodeHTMLBlock"][${CUSTOM_ATTR}] { 
    padding: 0 !important; 
    margin: 0 !important; 
    border: none !important;
}`;

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
</div>`.replace(/>\s+</g, "><").trim();

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
</div>`.replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();

export const settingIconMain = `<svg xmlns="http://www.w3.org/2000/svg"
      t="1767821223789"
      class="icon"
      viewBox="0 0 1024 1024"
      version="1.1"
      p-id="774"
      width="200"
      height="200">
  <path d="M376.6 494.8c5.1 4.8 7.9 11.7 7.6 18.7 0.4 7.1-2.5 14-7.6 18.7-5.3 4.7-12.3 7.2-19.3 6.9h-69.6v235.1c0.2 7.4-2.9 14.4-8.4 19.1-5.5 5.4-12.9 8.3-20.5 8.1-7.6 0.3-15.1-2.7-20.5-8.1-5.3-4.9-8.2-11.9-8.1-19.1v-235H161c-7.2 0.3-14.2-2.3-19.3-7.3-5.2-4.8-8-11.7-7.6-18.7-0.3-7 2.5-13.7 7.6-18.3 5.3-4.8 12.2-7.3 19.3-7h198.4c6.3 0 12.4 2.5 17.2 6.9z m215.7 70.1c5.2 5.1 8 12.2 7.7 19.6v189.9c0.3 7.2-2.5 14.2-7.7 19.1-4.8 5.3-11.7 8.3-18.9 8.1-7.1 0.1-13.9-2.7-18.9-7.7-4.8-5.2-7.6-12-7.6-19.1-18 19.5-42.9 30.8-69.2 31.4-19.7 0.3-38.9-5.3-55.5-15.9-17.2-10.7-31.2-26.1-40.3-44.4-19.3-40.4-19.3-87.6 0-128 8.9-18.4 22.9-33.8 40.3-44.4 16-10.5 34.8-16.1 53.9-15.9 26.3-0.1 51.8 9.8 71.2 27.7-0.2-7.3 2.6-14.4 7.7-19.6 10.6-10.2 27.2-10.2 37.8 0l-0.5-0.8z m-61.2 168.7c24.1-31.6 24.1-75.6 0-107.2-11.5-14.3-28.9-22.3-47.1-21.6-17.9-0.5-35.1 7.4-46.3 21.6-12.1 15-18.5 34-18.1 53.4-0.6 19.5 5.7 38.6 17.7 53.8 11.6 13.9 28.8 21.7 46.7 21.2 18.1 0.4 35.3-7.4 47.1-21.2zM835.4 573c17.1 10.7 31 25.9 40.3 44 9.9 19.8 14.9 41.8 14.5 64 0.4 22.3-4.6 44.4-14.5 64.4-9 18.3-23 33.7-40.3 44.4-16 10.6-34.8 16.1-53.9 15.9-13.9 0.2-27.7-2.9-40.3-9-11.6-5-22.1-12.2-31-21.2v2.8c0.2 7.2-2.5 14.2-7.5 19.4-5 5.1-11.9 8-19.1 7.9-7.1 0.3-14-2.5-18.9-7.7-5.2-5.1-8-12.2-7.6-19.6V497.2c-0.2-7.3 2.5-14.4 7.6-19.6 10.6-10.3 27.2-10.3 37.8 0 5.1 5.2 7.9 12.2 7.6 19.6v93.3c8-9.8 18-17.7 29.4-23.2 12.4-6.8 26.2-10.3 40.3-10.2 19.7-0.2 39 5.3 55.6 15.9z m-15.7 163c12.2-15.1 18.6-34.3 18.1-53.8 0.6-19.4-5.7-38.3-17.7-53.4-12-13.4-29-21.1-46.9-21.1s-34.9 7.7-46.9 21.1c-24.1 31.6-24.1 75.6 0 107.2 11.6 14.1 29 22.1 47.1 21.6 18.3-0.2 35.4-9.1 46.3-24v2.4zM708.1 253.5c-15.5 0-28-12.5-28-28V113.4c-0.1-8 0-15.9 0-23.8V77.9c0-15.5 12.5-28 28-28H886c17 0 32.9 6.6 45 18.6 11.3 11.3 17.8 26 18.6 41.8 0.1 0.7 0.1 1.4 0.1 2.1v113.2c0 15.5-12.5 28-28 28H708.1z m28-56h157.4v-84.1c0-2-0.8-3.9-2.2-5.4-1.4-1.4-3.4-2.2-5.4-2.2H736.1v91.7zM371.9 254.6c-15.5 0-28-12.5-28-28V78.9c0-15.4 12.5-27.9 27.9-28l213.4-1.1h0.1c17 0 32.9 6.6 45 18.6 12 12.1 18.6 28 18.6 45v113.2c0 15.5-12.5 28-28 28h-249z m28-56.1h193v-85.2c0-2-0.8-3.9-2.2-5.4-1.4-1.4-3.3-2.2-5.3-2.2l-185.5 0.9v91.9z"
        fill="#595959"
        p-id="775" />
  <path d="M72.4 974.2c-17.3 0-33.5-6.7-45.7-18.7-12.2-12.1-18.9-28.1-18.9-45.1V113.6c0-35.2 29-63.8 64.6-63.8h169c17.3 0 33.5 6.6 45.7 18.7 12.2 12 18.9 28.1 18.9 45.1V283c0 2 0.8 3.9 2.3 5.4 1.5 1.4 3.4 2.2 5.4 2.2h637.9c17.3 0 33.5 6.6 45.7 18.7 12.2 12 18.9 28 18.9 45.1v556c0 17.1-6.7 33.1-18.9 45.1s-28.4 18.7-45.7 18.7H72.4z m7.7-860.6c-4.3 0-7.7 3.4-7.7 7.6v788.7c0 2 0.8 4 2.3 5.4 1.4 1.4 3.4 2.2 5.4 2.2h871.5c2.1 0 4-0.8 5.4-2.2 1.5-1.4 2.3-3.3 2.3-5.4V350.6c0-2-0.8-3.9-2.2-5.3-1.5-1.5-3.4-2.3-5.4-2.3h-638c-17.3 0-33.5-6.7-45.7-18.7-12.2-12-18.9-28.1-18.9-45.1V121.1c0-2-0.8-3.9-2.3-5.4-1.4-1.4-3.4-2.2-5.4-2.2H80.1z"
        fill="#595959"
        p-id="776" />
</svg>`;

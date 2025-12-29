export const customAttr = 'custom-plugin-code-tabs-sourcecode';
export const newLineFlag = '\u2935\u21A9';

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
    <link rel="stylesheet" href="/plugins/code-tabs/code-style.css">  
    <link rel="stylesheet" href="/plugins/code-tabs/github-markdown.css">
    <link rel="stylesheet" href="/plugins/code-tabs/asset/katex.min.css">
    <link rel="stylesheet" href="/plugins/code-tabs/asset/code-tabs.css">
    <link rel="stylesheet" href="/plugins/code-tabs/background.css">
    <div class="tabs-container">
        <div class="tabs-outer">
            <div class="tabs"></div>
            <div class="tab-toggle"></div>
        </div>
        <div class="tab-contents">
            <span class="code-tabs--icon_copy" onclick="pluginCodeTabs.copyCode(event)">
                <img src="/plugins/code-tabs/asset/copy.png" alt="复制">
            </span>
        </div>
    </div>
</div>`.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

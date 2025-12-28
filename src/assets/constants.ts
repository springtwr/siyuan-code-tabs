export const customAttr = 'custom-plugin-code-tabs-sourcecode';
export const newLineFlag = '\u2935\u21A9';

export const htmlBlockStr = `
<div data-type="NodeHTMLBlock" class="render-node" data-subtype="block" style="padding: 0; margin: 0">
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
    <style>
        .tabs-container {
            display: block;
            position: relative;
            will-change: background-color;
        }
        
        .tabs-outer {
            display: flex;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            justify-content: space-between;
            align-items: center;
        }
        
        .tabs {
            order: 0;
            display: flex;
            width: calc(100% - 6em);
            height: 100%;
            align-items: center;
            overflow-x: auto;
            overflow-y: hidden;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
            transform: translate3d(0, 0, 0); /* 启用硬件加速 */
            scrollbar-width: none;
            -ms-overflow-style: none;
        }
        
        .tabs::-webkit-scrollbar {
            display: none;
        }
        
        .tab-toggle {
            order: 1;
            width: 6em;
            height: 100%;
            text-align: center;
            font-weight: bold;
            padding: 2px 5px;
        }
        
        .tab-contents {
            word-break: break-word;
            font-variant-ligatures: none;
            position: relative;
        }
    </style>
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

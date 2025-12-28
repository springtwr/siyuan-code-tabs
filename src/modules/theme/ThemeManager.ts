import { pushErrMsg, putFile, insertBlock, deleteBlock } from "@/api";
import logger from "@/utils/logger";
import { customAttr } from "@/assets/constants";

export class ThemeManager {
    static async putStyleFile(plugin: any) {
        // 配置代码样式文件
        const codeStyle = document.querySelector('link#protyleHljsStyle')?.getAttribute('href');
        const fileCodeStyle = await this.fetchFileFromUrl(codeStyle, 'code-style.css');
        await putFile('/data/plugins/code-tabs/code-style.css', false, fileCodeStyle);
        // 配置代码背景色样式文件
        const style = await this.getCodeBlockStyle(plugin.i18n);
        const cssContent = `
.tabs-container {
  border: ${style.border}; 
  border-radius: ${style.borderRadius};
  box-shadow: ${style.boxShadow};
  padding: ${style.blockPadding};
  margin: ${style.blockMargin};
  background-color: ${style.blockBg};
}
.tabs {
  background-color: ${style.protyleActionBg};
}
.tab-toggle {
  background-color: ${style.protyleActionBg};
}
.tab-contents > .hljs { 
  padding: ${style.hljsPadding};
  margin: ${style.hljsMargin};
  background-color: ${style.hljsBg}; 
  font-family: ${style.fontFamily};
}
.tab-contents > .hljs > .tab-content {
  padding: ${style.editablePadding};
  margin: ${style.editableMargin};
  background-color: ${style.editableBg};
}
`;
        const blob = new Blob([cssContent], { type: 'text/css' });
        const fileBackgroundStyle = new File([blob], 'styles.css', { type: 'text/css' });
        await putFile('/data/plugins/code-tabs/background.css', false, fileBackgroundStyle);
        // 配置代码中markdown的样式文件
        const mode = document.documentElement.getAttribute('data-theme-mode');
        if (mode === 'dark') {
            const darkModeFile = await this.fetchFileFromUrl('/plugins/code-tabs/asset/github-markdown-dark.css', 'github-markdown.css');
            await putFile('/data/plugins/code-tabs/github-markdown.css', false, darkModeFile);
        } else {
            const lightModeFile = await this.fetchFileFromUrl('/plugins/code-tabs/asset/github-markdown-light.css', 'github-markdown.css');
            await putFile('/data/plugins/code-tabs/github-markdown.css', false, lightModeFile);
        }
    }

    private static async getCodeBlockStyle(i18n: any) {
        let protyle = document.querySelector('.fn__flex-1.protyle:not(.fn__none)');
        let block = protyle?.querySelector('.protyle-wysiwyg[data-doc-type="NodeDocument"]') as HTMLElement;
        let i = 0;
        while (block == undefined || block.childElementCount === 0) {
            await new Promise(resolve => setTimeout(resolve, 300));
            protyle = document.querySelector('.fn__flex-1.protyle:not(.fn__none)');
            block = protyle?.querySelector('.protyle-wysiwyg[data-doc-type="NodeDocument"]') as HTMLElement;
            i++;
            if (i > 6) break;
        }
        block = block?.lastChild as HTMLElement;
        const id = block?.dataset.nodeId;
        if (id === undefined) {
            pushErrMsg(i18n.errMsgGetBackground).then();
            return {
                blockBg: "rgb(248, 249, 250)",
                protyleActionBg: "transparent",
                hljsBg: "rgb(248, 249, 250)",
                editableBg: "rgb(248, 249, 250)",
                fontFamily: '"JetBrainsMono-Regular", mononoki, Consolas, "Liberation Mono", Menlo, Courier, monospace',
                blockPadding: "2em 1em",
                hljsPadding: "0",
                editablePadding: "0",
                blockMargin: "1em, 0",
                hljsMargin: "0",
                editableMargin: "0",
                border: "none",
                boxShadow: "none",
                borderRadius: "6px"
            };
        }
        const result = await insertBlock("markdown", "\`\`\`python\nprint(\"code-tabs: temp block\")\n", '', id, '');
        const tempId = result[0].doOperations[0].id;
        const blockElement = document.querySelector(`[data-node-id="${tempId}"][data-type="NodeCodeBlock"]`);
        const protyleActionElement = blockElement.querySelector('.protyle-action');
        const hljsElement = blockElement.querySelector('.hljs');
        const editableElement = blockElement.querySelector('[contenteditable="true"]');

        const blockBg = window.getComputedStyle(blockElement).backgroundColor;
        const protyleActionBg = window.getComputedStyle(protyleActionElement).backgroundColor;
        const hljsBg = window.getComputedStyle(hljsElement).backgroundColor;
        const editableBg = window.getComputedStyle(editableElement).backgroundColor;

        const fontFamily = window.getComputedStyle(editableElement).fontFamily;
        let blockPadding = window.getComputedStyle(blockElement).padding;
        let hljsPadding = window.getComputedStyle(hljsElement).padding;
        const editablePadding = window.getComputedStyle(editableElement).padding;

        let [blockTop, blockRight, blockBottom, blockLeft] = this.parsePadding(blockPadding);
        let [hljsTop, hljsRight, hljsBottom, hljsLeft] = this.parsePadding(hljsPadding);
        const lineHeight = parseFloat(window.getComputedStyle(blockElement).lineHeight);
        blockTop = Math.max(blockTop, lineHeight + 4);
        blockPadding = `${blockTop}px ${blockRight}px ${blockBottom}px ${blockLeft}px`;
        hljsTop = hljsBottom == 0 ? 5 : hljsBottom;
        hljsPadding = `${hljsTop}px ${hljsRight}px ${hljsBottom}px ${hljsLeft}px`;

        const blockMargin = window.getComputedStyle(blockElement).margin;
        let hljsMargin = window.getComputedStyle(hljsElement).margin;
        let [hljsMarginTop, hljsMarginRight, hljsMarginBottom, hljsMarginLeft] = this.parsePadding(hljsMargin);
        hljsMarginTop = Math.max(0, hljsMarginTop);
        hljsMargin = `${hljsMarginTop}px ${hljsMarginRight}px ${hljsMarginBottom}px ${hljsMarginLeft}px`;
        const editableMargin = window.getComputedStyle(editableElement).margin;

        const border = window.getComputedStyle(blockElement).border;
        const boxShadow = window.getComputedStyle(blockElement).boxShadow;
        const borderRadius = window.getComputedStyle(blockElement).borderRadius;
        deleteBlock(tempId).then(() => logger.info("delete temp code-block"));

        return {
            blockBg: blockBg,
            protyleActionBg: protyleActionBg,
            hljsBg: hljsBg,
            editableBg: editableBg,
            fontFamily: fontFamily,
            blockPadding: blockPadding,
            hljsPadding: hljsPadding,
            editablePadding: editablePadding,
            blockMargin: blockMargin,
            hljsMargin: hljsMargin,
            editableMargin: editableMargin,
            border: border,
            boxShadow: boxShadow,
            borderRadius: borderRadius
        };
    }

    private static parsePadding(padding: string) {
        const paddings = padding.split(' ').map(value => parseInt(value, 10));
        let paddingTop, paddingRight, paddingBottom, paddingLeft;

        switch (paddings.length) {
            case 1:
                paddingTop = paddingRight = paddingBottom = paddingLeft = paddings[0];
                break;
            case 2:
                paddingTop = paddingBottom = paddings[0];
                paddingRight = paddingLeft = paddings[1];
                break;
            case 3:
                paddingTop = paddings[0];
                paddingRight = paddingLeft = paddings[1];
                paddingBottom = paddings[2];
                break;
            case 4:
                [paddingTop, paddingRight, paddingBottom, paddingLeft] = paddings;
                break;
            default:
                [paddingTop, paddingRight, paddingBottom, paddingLeft] = [0, 0, 0, 0];
        }
        return [paddingTop, paddingRight, paddingBottom, paddingLeft];
    }

    private static async fetchFileFromUrl(route: string, fileName: string): Promise<File> {
        try {
            let file: File;
            if (route === undefined) {
                const emptyContent = new Uint8Array(0);
                const blob = new Blob([emptyContent], { type: 'text/css' });
                file = new File([blob], fileName, { type: 'text/css' });
            } else {
                const response = await this.fetchWithRetry(route, {
                    headers: { 'Cache-Control': 'no-cache' }
                });
                if (!response.ok) return undefined;
                const blob = await response.blob();
                file = new File([blob], fileName, { type: blob.type });
            }
            return file;
        } catch (error) {
            logger.error(`fetchFileFromUrl: ${route}, error: ${error}`);
        }
    }

    private static async fetchWithRetry(route: string, options: RequestInit = {}, retries: number = 3, delay: number = 1000): Promise<Response> {
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const baseUrl = document.querySelector('base#baseURL')?.getAttribute('href');
                const url = baseUrl + route;
                const response = await fetch(url, options);
                if (!response.ok) {
                    if (response.status === 404) {
                        if (route === '/plugins/code-tabs/code-style.css' || route === '/plugins/code-tabs/background.css') {
                            return response;
                        }
                    }
                    throw new Error(`http error: ${response.status}`);
                }
                return response;
            } catch (error) {
                if (attempt < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error;
                }
            }
        }
    }

    static updateAllTabsStyle() {
        document.querySelectorAll(`[data-type="NodeHTMLBlock"][${customAttr}]`).forEach(node => {
            const shadowRoot = node.querySelector('protyle-html').shadowRoot;
            shadowRoot.querySelectorAll('link').forEach(link => {
                const currentHref = link.href;
                const currentTime = Date.now().toString();
                const url = new URL(currentHref);
                url.searchParams.set('t', currentTime);
                link.href = url.pathname + url.search;
            });
        });
    }
}

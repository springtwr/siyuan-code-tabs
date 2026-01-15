/**
 * 第三方主题适配接口定义
 */

export interface ThemeStyle {
    /** 代码块整体背景色 (通常对应 .tabs-container) */
    blockBg: string;
    /** 顶部标签栏背景色 (通常对应 .tabs 和 .tab-toggle) */
    protyleActionBg: string;
    /** 代码内容区域背景色 (对应 .hljs) */
    hljsBg: string;
    /** 代码编辑器/文本背景色 (对应 .tab-content) */
    editableBg: string;
    /** 字体家族 (如 "JetBrainsMono-Regular", "inherit" 等) */
    fontFamily: string;
    /** 字体大小 (如 "16px", "1em" 等) */
    fontSize: string;
    /** 行高 (如 "1.5", "1.5em" 等) */
    lineHeight: string;
    /** 外层容器内边距 (支持 "16px" 或 "1em 2em" 格式) */
    blockPadding: string;
    /** 高亮区域内边距 */
    hljsPadding: string;
    /** 编辑区域内边距 */
    editablePadding: string;
    /** 外层容器外边距 */
    blockMargin: string;
    /** 高亮区域外边距 */
    hljsMargin: string;
    /** 编辑区域外边距 */
    editableMargin: string;
    /** 文字颜色 */
    color: string;
    /** 边框样式 (如 "1px solid var(--b3-theme-divider)") */
    border: string;
    /** 阴影样式 (如 "none" 或 "0 4px 6px rgba(0,0,0,0.1)") */
    boxShadow: string;
    /** 圆角大小 (如 "8px") */
    borderRadius: string;
    /** 顶部标签栏位置 (如 "absolute" 或 "sticky") */
    protyleActionPosition: string;
    /** 顶部标签栏边框样式 */
    protyleActionBorderBottom: string;
    /** 高亮区域边框样式 */
    hljsBorderTop: string;
}

export interface ThemePatch {
    /**
     * 主题标识符。
     * 需匹配 <html> 标签上的 data-light-theme 或 data-dark-theme 属性值。
     */
    id: string;
    /** 主题的可读名称 (用于日志输出) */
    name: string;
    /**
     * 完整样式重写。
     * 如果定义了此字段，插件将跳过高开销的“后台代码块采集”逻辑，直接使用这里的定义。
     * 推荐使用 CSS 变量 (var(--b3-...)) 以实现更好的兼容性。
     */
    fullStyle?: ThemeStyle;
    /**
     * 补充的 CSS 字符串。
     * 这些 CSS 将被直接追加到生成的 styles.css 末尾，用于处理复杂的 CSS 选择器或层级。
     */
    extraCss?: string;
}

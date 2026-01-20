import { NEWLINE_FLAG } from "@/constants";

/**
 * 将源码字符串编码为 Base64（用于安全存储）
 * - 使用 TextEncoder 直接生成 Uint8Array
 * - 通过 btoa + binary string 编码（浏览器环境标准做法）
 * @param code 源码字符串
 * @returns Base64 编码的字符串
 */
export function encodeSource(code: string): string {
    if (!code) return "";

    const encoder = new TextEncoder();
    const bytes = encoder.encode(code);

    // 构建 binary string（避免低效的 += 拼接）
    let binary = "";
    const len = bytes.length;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    return window.btoa(binary);
}

/**
 * 解码存储的字符串为原始源码
 * - 兼容旧格式（含 [[NEWLINE_FLAG]] 标记）
 * - 优先尝试 Base64 解码
 * - 失败时回退为原始字符串（如纯文本）
 * @param stored 存储的字符串
 * @returns 解码后的源码字符串
 */
export function decodeSource(stored: string): string {
    if (!stored) return "";

    // 向后兼容：旧格式使用 [[NEWLINE_FLAG]] 标记换行
    if (stored.includes(NEWLINE_FLAG)) {
        return stored.replace(new RegExp(NEWLINE_FLAG, "g"), "\n");
    }

    // 尝试 Base64 解码
    try {
        const binary = window.atob(stored);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const decoder = new TextDecoder();
        return decoder.decode(bytes);
    } catch (error) {
        // 解码失败：可能是未编码的明文（如用户直接输入的文本）
        // 或损坏数据，此时直接返回原字符串（不 strip）
        return stored;
    }
}

/**
 * 清理常见的不可见 Unicode 控制字符（常出现在 contenteditable 中）
 * @param str 需要清理的字符串
 * @returns 清理后的字符串
 */
export function stripInvisibleChars(str: string): string {
    if (!str) return str;
    // \u200b：零宽空格（Zero Width Space）
    // \u200c：零宽非连接符（Zero Width Non-Joiner）
    // \u200d：零宽连接符（Zero Width Joiner）
    // \ufeff：BOM（字节顺序标记），有时也会混入
    return str.replace(/[\u200b-\u200d\ufeff]/g, "");
}

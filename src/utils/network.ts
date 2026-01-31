/**
 * 通用网络请求工具函数。
 * 副作用：发起网络请求与读写 File/Blob。
 */

import logger from "@/utils/logger";
import { delay } from "@/utils/common";
import { BACKGROUND_CSS, CODE_STYLE_CSS, THEME_ADAPTION_YAML } from "@/constants";
import * as yaml from "js-yaml";

/**
 * 兼容 baseURL 的相对路径解析。
 * @param route 原始路径
 * @returns 解析后的绝对/相对路径
 */
function resolveUrl(route: string): string {
    if (!route) return route;
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(route)) {
        return route;
    }
    const baseUrl = document.querySelector("base#baseURL")?.getAttribute("href");
    if (!baseUrl) {
        return route;
    }
    try {
        return new URL(route, baseUrl).toString();
    } catch {
        return `${baseUrl}${route}`;
    }
}

/**
 * 带重试功能的网络请求。
 * 兼容：特定样式文件 404 时允许透传。
 * @param route 请求路径
 * @param options fetch 选项
 * @param retries 重试次数
 * @param delayMs 重试间隔
 * @returns Response
 */
export async function fetchWithRetry(
    route: string,
    options: RequestInit = {},
    retries: number = 3,
    delayMs: number = 1000
): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const url = resolveUrl(route);
            const response = await fetch(url, options);
            if (!response.ok) {
                if (response.status === 404) {
                    const passThroughPaths = [
                        CODE_STYLE_CSS.replace("/data", "/"),
                        BACKGROUND_CSS.replace("/data", "/"),
                        THEME_ADAPTION_YAML.replace("/data", "/"),
                    ];
                    if (passThroughPaths.includes(route)) {
                        return response;
                    }
                }
                throw new Error(`http error: ${response.status}`);
            }
            return response;
        } catch (error) {
            if (attempt < retries - 1) {
                await delay(delayMs);
            } else {
                throw error;
            }
        }
    }
    throw new Error("fetchWithRetry: retries exhausted");
}

// 强制跳过缓存，避免主题文件读取旧内容
const NO_CACHE_HEADERS = { "Cache-Control": "no-cache" };

/**
 * 获取文件并包装为 File（可选重试）。
 * @param route 请求路径
 * @param fileName 文件名
 * @param useRetry 是否启用重试
 * @returns File 或 undefined
 */
async function fetchFileFromUrlCore(
    route: string,
    fileName: string,
    useRetry: boolean
): Promise<File | undefined> {
    const response = useRetry
        ? await fetchWithRetry(route, { headers: NO_CACHE_HEADERS })
        : await fetch(resolveUrl(route), { headers: NO_CACHE_HEADERS });
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return new File([blob], fileName, { type: blob.type });
}

/**
 * 从 URL 获取文件
 * @param route 请求路径
 * @param fileName 文件名
 * @returns File 或 undefined
 */
export async function fetchFileFromUrl(
    route: string | undefined,
    fileName: string
): Promise<File | undefined> {
    try {
        let file: File;
        if (!route) {
            const emptyContent = new Uint8Array(0);
            const blob = new Blob([emptyContent], { type: "text/css" });
            file = new File([blob], fileName, { type: "text/css" });
        } else {
            const result = await fetchFileFromUrlCore(route, fileName, true);
            if (!result) return undefined;
            file = result;
        }
        return file;
    } catch (error) {
        logger.error(`fetchFileFromUrl: ${route}, error: ${error}`);
    }
}

/**
 * 从 URL 获取文件（简化版，无重试）
 * @param route 请求路径
 * @param fileName 文件名
 * @returns File 或 undefined
 */
export async function fetchFileFromUrlSimple(
    route: string,
    fileName: string
): Promise<File | undefined> {
    try {
        if (!route) return undefined;
        return await fetchFileFromUrlCore(route, fileName, false);
    } catch {
        return undefined;
    }
}

/**
 * 从文件加载并解析 JSON 数据
 * @param file 文件对象
 * @returns 解析后的 JSON
 */
export async function loadJsonFromFile(file: File): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                resolve(JSON.parse(reader.result as string));
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

/**
 * 从文件加载并解析 YAML 数据
 * @param file 文件对象
 * @returns 解析后的 YAML
 */
export async function loadYamlFromFile(file: File): Promise<unknown> {
    const text = await file.text();
    return yaml.load(text);
}

/**
 * 从 URL 获取并解析 YAML 文件
 * @param route 请求路径
 * @param fileName 文件名
 * @returns 解析后的 YAML 或 undefined
 */
export async function fetchYamlFromUrl(route: string, fileName: string): Promise<unknown> {
    try {
        const file = await fetchFileFromUrl(route, fileName);
        if (!file) return undefined;
        return await loadYamlFromFile(file);
    } catch (error) {
        logger.error(`fetchYamlFromUrl: ${route}, error: ${error}`);
        return undefined;
    }
}

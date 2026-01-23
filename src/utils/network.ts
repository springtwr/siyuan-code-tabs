/**
 * 通用网络请求工具函数
 */

import logger from "@/utils/logger";
import { BACKGROUND_CSS, CODE_STYLE_CSS, THEME_ADAPTION_YAML } from "@/constants";
import * as yaml from "js-yaml";

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
 * 带重试功能的网络请求
 */
export async function fetchWithRetry(
    route: string,
    options: RequestInit = {},
    retries: number = 3,
    delay: number = 1000
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
                await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
    throw new Error("fetchWithRetry: retries exhausted");
}

/**
 * 从 URL 获取文件
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
            const response = await fetchWithRetry(route, {
                headers: { "Cache-Control": "no-cache" },
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

/**
 * 从 URL 获取文件（简化版，无重试）
 */
export async function fetchFileFromUrlSimple(
    route: string,
    fileName: string
): Promise<File | undefined> {
    try {
        if (!route) return undefined;
        const url = resolveUrl(route);
        const response = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
        if (!response.ok) return undefined;
        const blob = await response.blob();
        return new File([blob], fileName, { type: blob.type });
    } catch {
        return undefined;
    }
}

/**
 * 从文件加载并解析 JSON 数据
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
 */
export async function loadYamlFromFile(file: File): Promise<unknown> {
    const text = await file.text();
    return yaml.load(text);
}

/**
 * 从 URL 获取并解析 YAML 文件
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

/**
 * 通用网络请求工具函数
 */

import logger from "@/utils/logger";
import {CODE_STYLE_CSS, BACKGROUND_CSS, THEME_ADAPTION_JSON} from "@/assets/constants";

/**
 * 带重试功能的网络请求
 */
export async function fetchWithRetry(route: string, options: RequestInit = {}, retries: number = 3, delay: number = 1000): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const baseUrl = document.querySelector('base#baseURL')?.getAttribute('href');
            const url = baseUrl + route;
            const response = await fetch(url, options);
            if (!response.ok) {
                if (response.status === 404) {
                    const passThroughPaths = [
                        CODE_STYLE_CSS.replace('/data', '/'),
                        BACKGROUND_CSS.replace('/data', '/'),
                        THEME_ADAPTION_JSON.replace('/data', '/')
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
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
}

/**
 * 从 URL 获取文件
 */
export async function fetchFileFromUrl(route: string, fileName: string): Promise<File> {
    try {
        let file: File;
        if (route === undefined) {
            const emptyContent = new Uint8Array(0);
            const blob = new Blob([emptyContent], {type: 'text/css'});
            file = new File([blob], fileName, {type: 'text/css'});
        } else {
            const response = await fetchWithRetry(route, {
                headers: {'Cache-Control': 'no-cache'}
            });
            if (!response.ok) return undefined;
            const blob = await response.blob();
            file = new File([blob], fileName, {type: blob.type});
        }
        return file;
    } catch (error) {
        logger.error(`fetchFileFromUrl: ${route}, error: ${error}`);
    }
}

/**
 * 从 URL 获取文件（简化版，无重试）
 */
export async function fetchFileFromUrlSimple(route: string, fileName: string): Promise<File> {
    try {
        const baseUrl = document.querySelector('base#baseURL')?.getAttribute('href');
        const url = baseUrl + route;
        const response = await fetch(url, {headers: {'Cache-Control': 'no-cache'}});
        if (!response.ok) return undefined;
        const blob = await response.blob();
        return new File([blob], fileName, {type: blob.type});
    } catch (e) {
        return undefined;
    }
}

/**
 * 从文件加载并解析 JSON 数据
 */
export async function loadJsonFromFile(file: File): Promise<any> {
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
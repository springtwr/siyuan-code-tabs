/// <reference types="vite/client" />

// Vite 环境变量类型补充
interface ImportMetaEnv {
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly MODE: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare const __PLUGIN_VERSION__: string;

declare module "yaml-plugin" {
    function vitePluginYamlI18n(options: { inDir: string; outDir: string }): unknown;
    export default vitePluginYamlI18n;
}

declare module "scripts/hot-reload.js" {
    function siyuanReloadPlugin(options: {
        isWatch: boolean;
        packageName: string;
        token?: string;
        frontend?: string;
        port?: number;
        host?: string;
    }): unknown;
    export default siyuanReloadPlugin;
}

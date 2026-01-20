import {resolve} from "path"
import {defineConfig} from "vite"
import minimist from "minimist"
import {viteStaticCopy} from "vite-plugin-static-copy"
import zipPack from "vite-plugin-zip-pack";
import fg from 'fast-glob';

import vitePluginYamlI18n from './yaml-plugin';

import siyuanReloadPlugin from './scripts/hot-reload.js';

const args = minimist(process.argv.slice(2))
const isWatch = args.watch || args.w || false
const devDistDir = "dev"
const distDir = isWatch ? devDistDir : "dist"

console.log("isWatch=>", isWatch)
console.log("distDir=>", distDir)

export default defineConfig({
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        }
    },

    plugins: [
        vitePluginYamlI18n({
            inDir: 'public/i18n',
            outDir: `${distDir}/i18n`
        }),

        viteStaticCopy({
            targets: [
                {
                    src: "./README*.md",
                    dest: "./",
                },
                {
                    src: "./plugin.json",
                    dest: "./",
                },
                {
                    src: "./preview.png",
                    dest: "./",
                },
                {
                    src: "./icon.png",
                    dest: "./",
                }
            ],
        }),

        // 使用提取出来的插件，在这里配置参数
        siyuanReloadPlugin({
            isWatch: isWatch,
            packageName: 'code-tabs', // ⚠️请修改为你的实际包名
            token: process.env.SIYUAN_TOKEN || '', // ⚠️如果设置了鉴权，请在 .env 中填入 token
            frontend: 'desktop',
            // port: 6806,   // 默认 6806，一般不用改
            // host: '127.0.0.1' // 默认本地，一般不用改
        }),
    ],

    // https://github.com/vitejs/vite/issues/1930
    // https://vitejs.dev/guide/env-and-mode.html#env-files
    // https://github.com/vitejs/vite/discussions/3058#discussioncomment-2115319
    // 在这里自定义变量
    define: {
        "process.env.DEV_MODE": `"${isWatch}"`,
        "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV)
    },

    build: {
        // 输出路径
        outDir: distDir,
        emptyOutDir: isWatch,

        // 构建后是否生成 source map 文件
        sourcemap: false,

        // 设置为 false 可以禁用最小化混淆
        // 或是用来指定是应用哪种混淆器
        // boolean | 'terser' | 'esbuild'
        // 不压缩，用于调试
        minify: !isWatch,

        lib: {
            // Could also be a dictionary or array of multiple entry points
            entry: resolve(__dirname, "src/index.ts"),
            // the proper extensions will be added
            fileName: "index",
            formats: ["cjs"],
        },
        rollupOptions: {
            plugins: [
                ...(
                    isWatch ? [
                        {
                            //监听静态资源文件
                            name: 'watch-external',
                            async buildStart() {
                                const files = await fg([
                                    'public/i18n/**',
                                    'public/asset/**',
                                    './README*.md',
                                    './plugin.json'
                                ]);
                                for (let file of files) {
                                    this.addWatchFile(file);
                                }
                            }
                        }
                    ] : [
                        zipPack({
                            inDir: './dist',
                            outDir: './',
                            outFileName: 'package.zip'
                        })
                    ]
                )
            ],

            // make sure to externalize deps that shouldn't be bundled
            // into your library
            external: ["siyuan", "process"],

            output: {
                entryFileNames: "[name].js",
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === "style.css") {
                        return "index.css"
                    }
                    return assetInfo.name
                },
            },
        },
    }
})

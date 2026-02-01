import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    define: {
        __PLUGIN_VERSION__: JSON.stringify("test"),
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"],
        include: ["tests/**/*.test.ts"],
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
            siyuan: resolve(__dirname, "tests/helpers/siyuan.ts"),
        },
    },
});

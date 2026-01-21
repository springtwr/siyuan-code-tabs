import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"],
        include: ["tests/**/*.test.ts"],
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        },
    },
});

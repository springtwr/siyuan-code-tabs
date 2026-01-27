import { describe, expect, it } from "vitest";
import {
    buildPlanFromConfigChanges,
    buildPlanFromMutation,
    createEmptyPlan,
    describePlan,
} from "@/modules/theme/ThemeObserver";

describe("ThemeObserver helpers", () => {
    it("createEmptyPlan 默认全 false", () => {
        const plan = createEmptyPlan();
        expect(plan).toEqual({
            codeStyle: false,
            background: false,
            markdown: false,
            lineNumbers: false,
            forceProbe: false,
        });
    });

    it("buildPlanFromConfigChanges 处理字体大小", () => {
        const plan = buildPlanFromConfigChanges(["fontSize"]);
        expect(plan.background).toBe(true);
        expect(plan.lineNumbers).toBe(true);
        expect(plan.forceProbe).toBe(true);
    });

    it("buildPlanFromConfigChanges 处理代码主题", () => {
        const plan = buildPlanFromConfigChanges(["codeBlockThemeDark"]);
        expect(plan.codeStyle).toBe(true);
        expect(plan.background).toBe(false);
    });

    it("buildPlanFromMutation 处理主题链接", () => {
        const plan = buildPlanFromMutation("theme-link");
        expect(plan.background).toBe(true);
        expect(plan.forceProbe).toBe(true);
    });

    it("describePlan 输出摘要", () => {
        const plan = buildPlanFromConfigChanges(["mode"]);
        const desc = describePlan(plan);
        expect(desc).toContain("background.css");
        expect(desc).toContain("code-style.css");
        expect(desc).toContain("github-markdown.css");
    });
});

import { putFile } from "@/api";
import { DEBUG_LOG } from "@/constants";
import { debounce } from "@/utils/common";
import logger from "@/utils/logger";

type DebugLogManagerOptions = {
    logPath?: string;
    bufferLimit?: number;
    debounceMs?: number;
};

/**
 * 调试日志开关与写入管理。
 * 副作用：写入 debug.log、修改 logger 行为。
 */
export class DebugLogManager {
    private readonly logPath: string;
    private readonly bufferLimit: number;
    private readonly debounceMs: number;
    private readonly storageKey = "code-tabs.debug";
    private logBuffer: string[] = [];
    private flushLogFile: () => void = () => {};

    constructor(options: DebugLogManagerOptions = {}) {
        this.logPath = options.logPath ?? DEBUG_LOG;
        this.bufferLimit = options.bufferLimit ?? 2000;
        this.debounceMs = options.debounceMs ?? 1000;
    }

    /**
     * 初始化调试日志开关与写入器。
     */
    init(): void {
        logger.setDebugEnabled(this.getDebugEnabled());
        this.initLogWriter();
    }

    createToggle(): HTMLInputElement {
        const debugToggle = document.createElement("input");
        debugToggle.type = "checkbox";
        debugToggle.className = "b3-switch";
        debugToggle.checked = this.getDebugEnabled();
        debugToggle.addEventListener("change", () => {
            this.setDebugEnabled(debugToggle.checked);
        });
        return debugToggle;
    }

    setDebugEnabled(enabled: boolean): void {
        try {
            localStorage.setItem(this.storageKey, enabled ? "true" : "false");
        } catch {
            logger.warn("无法写入 debug 配置");
        }
        logger.setDebugEnabled(enabled);
        logger.info("调试日志开关变更", { enabled });
    }

    getDebugEnabled(): boolean {
        try {
            return localStorage.getItem(this.storageKey) === "true";
        } catch {
            return false;
        }
    }

    /**
     * 清理内存缓冲与写入器。
     */
    cleanup(): void {
        this.logBuffer = [];
        this.flushLogFile = () => {};
        logger.setLogWriter(undefined);
    }

    /**
     * 注册 logger 写入器并做防抖写盘。
     */
    private initLogWriter(): void {
        const flush = debounce(() => {
            if (this.logBuffer.length === 0) return;
            const content = this.logBuffer.join("\n") + "\n";
            const file = new File([content], "debug.log", { type: "text/plain" });
            putFile(this.logPath, false, file).catch((error) => {
                console.error("write debug log failed", error);
            });
        }, this.debounceMs);
        this.flushLogFile = flush;
        logger.setLogWriter((line) => {
            this.logBuffer.push(line);
            if (this.logBuffer.length > this.bufferLimit) {
                this.logBuffer.shift();
            }
            this.flushLogFile();
        });
    }
}

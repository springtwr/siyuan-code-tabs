import { isDevMode } from "@/utils/env";

enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARNING = "warning",
    ERROR = "error",
}

class Logger {
    private readonly isDev: boolean;
    private debugEnabled = false;
    private logWriter?: (line: string) => void;

    constructor() {
        this.isDev = isDevMode();
    }

    public debug(message: unknown, context?: Record<string, unknown>): void {
        this.log(LogLevel.DEBUG, message, context);
    }

    public info(message: unknown, context?: Record<string, unknown>): void {
        this.log(LogLevel.INFO, message, context);
    }

    public warn(message: unknown, context?: Record<string, unknown>): void {
        this.log(LogLevel.WARNING, message, context);
    }

    public error(message: unknown, context?: Record<string, unknown>): void {
        this.log(LogLevel.ERROR, message, context);
    }

    private log(
        level: LogLevel = LogLevel.INFO,
        message: unknown,
        context?: Record<string, unknown>
    ): void {
        if (level === LogLevel.DEBUG && !this.debugEnabled) {
            return;
        }
        const formatted = this.formatMessage(level, message, context);
        if (this.debugEnabled && this.logWriter) {
            this.logWriter(formatted);
        }
        // 生产环境中只输出错误信息，屏蔽 debug/info/warn 信息
        if (!this.isDev && !this.debugEnabled) {
            if (level === LogLevel.ERROR) {
                console.error(formatted);
            }
            return;
        }
        const logHeader = this.formatHeader(level);
        const elementFlag =
            message instanceof Element || (typeof message === "object" && message !== null);
        if (elementFlag && !context) {
            console.log(logHeader);
            console.log(message);
        } else {
            console.log(formatted);
        }
    }

    private formatHeader(level: LogLevel): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [code-tabs] [${level.toUpperCase()}]: `;
    }

    private formatMessage(
        level: LogLevel,
        message: unknown,
        context?: Record<string, unknown>
    ): string {
        const header = this.formatHeader(level);
        const text = this.formatValue(message);
        if (!context) return header + text;
        return `${header}${text} | context=${this.safeStringify(context)}`;
    }

    private formatValue(value: unknown): string {
        if (typeof value === "string") return value;
        if (value instanceof Error) return value.message;
        return this.safeStringify(value);
    }

    private safeStringify(value: unknown): string {
        const seen = new WeakSet();
        try {
            return JSON.stringify(value, (_key, current) => {
                if (typeof current === "bigint") {
                    return current.toString();
                }
                if (current instanceof Error) {
                    return {
                        name: current.name,
                        message: current.message,
                        stack: current.stack,
                    };
                }
                if (typeof current === "object" && current !== null) {
                    if (seen.has(current)) return "[Circular]";
                    seen.add(current);
                }
                return current;
            });
        } catch {
            try {
                return String(value);
            } catch {
                return "[Unserializable]";
            }
        }
    }

    public setDebugEnabled(enabled: boolean): void {
        this.debugEnabled = enabled;
    }

    public setLogWriter(writer?: (line: string) => void): void {
        this.logWriter = writer;
    }

    public isDebugEnabled(): boolean {
        return this.debugEnabled;
    }
}

// 导出 Logger 类的单例实例
const logger = new Logger();
export default logger;

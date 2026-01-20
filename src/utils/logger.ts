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
        // 访问 Vite 环境变量，判断是否处于开发环境
        this.isDev = process.env.DEV_MODE === "true";
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
        const text =
            typeof message === "string"
                ? message
                : message instanceof Error
                    ? message.message
                    : JSON.stringify(message);
        if (!context) return header + text;
        return `${header}${text} | context=${JSON.stringify(context)}`;
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

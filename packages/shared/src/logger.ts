/**
 * Universal Logger with Runtime Injection
 * 
 * - Default: Console-based logging (works everywhere)
 * - Server: Can inject Winston via setLoggerFactory() at startup
 */

// Logger interface for type safety
export interface Logger {
  debug: (message: string, ...meta: any[]) => void;
  info: (message: string, ...meta: any[]) => void;
  warn: (message: string, ...meta: any[]) => void;
  error: (message: string, ...meta: any[]) => void;
}

// Format timestamp in local time (YYYY-MM-DD HH:mm:ss)
const getTimestamp = () => new Date().toLocaleString('sv-SE');

// Default console logger (works in browser and Node)
const createConsoleLogger = (source: string): Logger => ({
  debug: (message: string, ...meta: any[]) => {
    console.debug(`[${getTimestamp()}] [${source}] DEBUG:`, message, ...meta);
  },
  info: (message: string, ...meta: any[]) => {
    console.info(`[${getTimestamp()}] [${source}] INFO:`, message, ...meta);
  },
  warn: (message: string, ...meta: any[]) => {
    console.warn(`[${getTimestamp()}] [${source}] WARN:`, message, ...meta);
  },
  error: (message: string, ...meta: any[]) => {
    console.error(`[${getTimestamp()}] [${source}] ERROR:`, message, ...meta);
  }
});

// Logger registry and factory
const loggers = new Map<string, Logger>();
let loggerFactory: (source: string) => Logger = createConsoleLogger;

/**
 * Inject a custom logger factory (call from server startup)
 * Example: setLoggerFactory(createWinstonLogger)
 */
export function setLoggerFactory(factory: (source: string) => Logger): void {
  loggerFactory = factory;
  // Clear existing loggers so they get recreated with new factory
  loggers.clear();
}

/**
 * Get or create a logger for a given source
 * Uses injected factory (Winston on server) or default (console)
 */
export function getLogger(source: string): Logger {
  if (!loggers.has(source)) {
    loggers.set(source, loggerFactory(source));
  }
  return loggers.get(source)!;
}

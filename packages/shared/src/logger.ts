import winston from 'winston';

// Determine if running in Node.js environment (server/tests) or browser (client)
const isNode = typeof process !== 'undefined' && process.versions?.node;

// Common log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
    const stackString = stack ? `\n${stack}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString ? ' ' + metaString : ''}${stackString}`;
  })
);

// Create base logger configuration
const createLogger = (source: string) => {
  const transports: winston.transport[] = [];

  // Only add file transports in Node.js (browser can't use fs/path)
  if (isNode) {
    // Dynamic import path only in Node
    const path = require('path');
    const logsDir = path.join(process.cwd(), 'logs');
    
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, `${source}.log`),
        level: 'debug'
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        level: 'debug'
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error'
      })
    );
  }

  // Add console transport (works in both Node and browser)
  transports.push(
    new winston.transports.Console({
      level: 'debug',
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  );

  return winston.createLogger({
    format: logFormat,
    transports
  });
};

// Export specialized loggers for different parts of the application
export const serverLogger = createLogger('server');
export const clientLogger = createLogger('client');
export const dbLogger = createLogger('database');

// Export a default logger (maps to server logger for backwards compatibility)
export const logger = serverLogger;

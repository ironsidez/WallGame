/**
 * Server Logger with Winston File Transports
 * 
 * Writes logs to:
 * - logs/server.log    (server messages)
 * - logs/database.log  (database messages)
 * - logs/combined.log  (all messages)
 * - logs/error.log     (errors only)
 */

import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { setLoggerFactory, getLogger } from '@wallgame/shared';
import type { Logger } from '@wallgame/shared';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log format matching our standard
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaString = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    const stackString = stack ? `\n${stack}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}${stackString}`;
  })
);

// Create Winston logger with file transports
export const createWinstonLogger = (source: string): Logger => {
  return winston.createLogger({
    format: logFormat,
    transports: [
      // Source-specific log file
      new winston.transports.File({
        filename: path.join(logsDir, `${source}.log`),
        level: 'debug'
      }),
      // Combined log file
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        level: 'debug'
      }),
      // Error-only log file
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error'
      }),
      // Console output with colors
      new winston.transports.Console({
        level: 'debug',
        format: winston.format.combine(
          winston.format.colorize(),
          logFormat
        )
      })
    ]
  });
};

// Inject Winston as the logger factory for all shared code
setLoggerFactory(createWinstonLogger);

// Re-export loggers (now using Winston via the injected factory)
export const serverLogger: Logger = getLogger('server');
export const dbLogger: Logger = getLogger('database');
export const createLogger = (source: string): Logger => getLogger(source);
export const logger = serverLogger;

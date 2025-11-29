import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment files in order of priority (.env.local overrides .env)
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

import { GameManager } from './game/GameManager';
import { DatabaseManager } from './database/DatabaseManager';
import { authRouter } from './routes/auth';
import { setupSocketHandlers } from './socket/socketHandlers';
import { serverLogger } from './utils/logger';

const app = express();
const server = createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database manager (doesn't connect yet, just creates instance)
const databaseManager = new DatabaseManager();

// Import route setup functions
import { setDatabaseManager } from './routes/auth';

// Note: GameManager will be initialized AFTER database connects (see startServer)

// Start server
async function startServer() {
  try {
    // Initialize database connections (skip in development if not available)
    if (process.env.NODE_ENV !== 'development' || process.env.FORCE_DB === 'true') {
      await databaseManager.initialize();
      serverLogger.info('🔌 Database connection established');
    } else {
      serverLogger.warn('⚠️  Running in development mode without database');
      serverLogger.info('💡 Set FORCE_DB=true to enable database connection');
    }
    
    // Initialize GameManager after database is connected
    const gameManager = new GameManager(databaseManager);
    await gameManager.initialize();
    serverLogger.info('🎮 GameManager initialized');
    
    // Set up route dependencies
    setDatabaseManager(databaseManager);
    
    // Routes (after all managers are ready)
    app.use('/api/auth', authRouter);
    
    // Setup Socket.io handlers
    setupSocketHandlers(io, gameManager, databaseManager);
    
    server.listen(PORT, () => {
      // WallGame backend server restarting
      serverLogger.info(`📡 Socket.io ready for connections`);
      serverLogger.info(`🌐 Client URL: ${process.env.CLIENT_URL || "http://localhost:3000"}`);
    });
  } catch (error) {
    serverLogger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  serverLogger.info('🛑 SIGTERM received, shutting down gracefully');
  
  // Close socket connections
  io.close();
  
  // Close database connection
  await databaseManager.close();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  serverLogger.info('🛑 SIGINT received, shutting down gracefully');
  
  // Close socket connections
  io.close();
  
  // Close database connection
  await databaseManager.close();
  
  process.exit(0);
});

startServer();

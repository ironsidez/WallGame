import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { GameManager } from './game/GameManager';
import { DatabaseManager } from './database/DatabaseManager';
import { RedisManager } from './database/RedisManager';
import { authRouter } from './routes/auth';
import { gameRouter } from './routes/game';
import { setupSocketHandlers } from './socket/socketHandlers';

// Load environment variables
dotenv.config();

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

// Routes
app.use('/api/auth', authRouter);
app.use('/api/game', gameRouter);

// Initialize managers
const databaseManager = new DatabaseManager();
const redisManager = new RedisManager();
const gameManager = new GameManager(redisManager, databaseManager);

// Setup Socket.io handlers
setupSocketHandlers(io, gameManager);

// Start server
async function startServer() {
  try {
    // Initialize database connections (skip in development if not available)
    if (process.env.NODE_ENV !== 'development' || process.env.FORCE_DB === 'true') {
      await databaseManager.initialize();
      await redisManager.initialize();
      console.log('🔌 Database connections established');
    } else {
      console.log('⚠️  Running in development mode without databases');
      console.log('💡 Set FORCE_DB=true to enable database connections');
    }
    
    server.listen(PORT, () => {
      console.log(`🚀 WallGame server running on port ${PORT}`);
      console.log(`📡 Socket.io ready for connections`);
      console.log(`🌐 Client URL: ${process.env.CLIENT_URL || "http://localhost:3000"}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  
  // Close socket connections
  io.close();
  
  // Close database connections
  await databaseManager.close();
  await redisManager.close();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  
  // Close socket connections
  io.close();
  
  // Close database connections
  await databaseManager.close();
  await redisManager.close();
  
  process.exit(0);
});

startServer();

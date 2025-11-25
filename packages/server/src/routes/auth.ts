import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { DatabaseManager } from '../database/DatabaseManager';
import { secureLog, maskJwtToken } from '../utils/security';

const router = express.Router();

// This will be injected by the main server
let databaseManager: DatabaseManager;

export function setDatabaseManager(db: DatabaseManager) {
  databaseManager = db;
}

// Register new user
router.post('/register', async (req: any, res: any) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await databaseManager.getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await databaseManager.createUser(username, email, passwordHash);

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin || false
      },
      token
    });

    secureLog('User registered successfully:', { 
      userId: user.id, 
      username: user.username,
      token: maskJwtToken(token)
    });
  } catch (error: any) {
    secureLog('Registration error:', error);
    const errorMessage = error?.message || 'Internal server error';
    res.status(500).json({ 
      error: 'Registration failed', 
      details: errorMessage 
    });
  }
});

// Login user
router.post('/login', async (req: any, res: any) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password' });
    }

    console.log(`🔐 Login attempt for username: ${username}`);

    // Get user from database
    const user = await databaseManager.getUserByUsername(username);
    if (!user) {
      console.log(`❌ Login failed: User "${username}" not found in database`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log(`✅ User found: ${user.username} (id: ${user.id})`);

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      console.log(`❌ Login failed: Invalid password for user "${username}"`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin || false
      },
      token
    });

    secureLog('User logged in successfully:', { 
      userId: user.id, 
      username: user.username,
      token: maskJwtToken(token)
    });
  } catch (error) {
    secureLog('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token middleware
export function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  jwt.verify(token, jwtSecret, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Admin authentication middleware
export async function authenticateAdmin(req: any, res: any, next: any) {
  // First authenticate the token
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const decoded: any = jwt.verify(token, jwtSecret);
    req.user = decoded;

    // Check if user is admin
    const user = await databaseManager.getUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Get current user profile
router.get('/profile', authenticateToken, async (req: any, res: any) => {
  try {
    const user = await databaseManager.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.is_admin || false,
      createdAt: user.created_at
    });
  } catch (error) {
    secureLog('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as authRouter };

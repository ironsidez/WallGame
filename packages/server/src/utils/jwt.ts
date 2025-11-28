import jwt from 'jsonwebtoken';

/**
 * Generate a JWT token for a user
 * @param userId User's unique identifier
 * @param username User's username
 * @returns Signed JWT token valid for 24 hours
 */
export function generateJWT(userId: string, username: string): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return jwt.sign(
    { userId, username },
    jwtSecret,
    { expiresIn: '24h' }
  );
}

/**
 * Verify a JWT token
 * @param token JWT token to verify
 * @returns Decoded token payload
 * @throws Error if token is invalid or expired
 */
export function verifyJWT(token: string): { userId: string; username: string } {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return jwt.verify(token, jwtSecret) as { userId: string; username: string };
}

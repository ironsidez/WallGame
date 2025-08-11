/**
 * Security utilities for sensitive data handling
 */

/**
 * Masks JWT tokens in logs and console output
 * Shows first 10 and last 6 characters with asterisks in between
 * @param token - JWT token to mask
 * @returns Masked token string
 */
export function maskJwtToken(token: string | null | undefined): string {
  if (!token || typeof token !== 'string') {
    return '[NO_TOKEN]';
  }
  
  if (token.length < 20) {
    return '[INVALID_TOKEN]';
  }
  
  const start = token.substring(0, 10);
  const end = token.substring(token.length - 6);
  const middle = '*'.repeat(Math.min(token.length - 16, 20));
  
  return `${start}${middle}${end}`;
}

/**
 * Masks sensitive data in objects for logging
 * @param obj - Object that may contain sensitive data
 * @returns Object with sensitive fields masked
 */
export function maskSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const masked = { ...obj };
  
  // Mask common sensitive fields
  const sensitiveFields = ['token', 'jwt', 'password', 'secret', 'key', 'auth'];
  
  for (const field of sensitiveFields) {
    if (masked[field]) {
      if (field === 'token' || field === 'jwt') {
        masked[field] = maskJwtToken(masked[field]);
      } else {
        masked[field] = '[MASKED]';
      }
    }
  }
  
  // Handle nested auth objects
  if (masked.auth && typeof masked.auth === 'string') {
    try {
      const authObj = JSON.parse(masked.auth);
      if (authObj.state && authObj.state.token) {
        authObj.state.token = maskJwtToken(authObj.state.token);
        masked.auth = JSON.stringify(authObj);
      }
    } catch (e) {
      // If parsing fails, leave as is
    }
  }
  
  return masked;
}

/**
 * Console.log replacement that automatically masks sensitive data
 * @param message - Log message
 * @param data - Data to log (will be masked)
 */
export function secureLog(message: string, data?: any): void {
  if (data) {
    console.log(message, maskSensitiveData(data));
  } else {
    console.log(message);
  }
}

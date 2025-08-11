// Security utility functions for tests
function maskJwtToken(token) {
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

function maskSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const masked = { ...obj };
  
  // Mask common sensitive fields
  const sensitiveFields = ['token', 'jwt', 'password', 'secret', 'key'];
  
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

module.exports = { maskJwtToken, maskSensitiveData };

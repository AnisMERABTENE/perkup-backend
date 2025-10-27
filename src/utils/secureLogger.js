/**
 * 🔒 SERVICE DE LOGS SÉCURISÉ
 * Masque automatiquement les données sensibles dans les logs
 */

// Patterns de données sensibles à masquer
const SENSITIVE_PATTERNS = {
  // Mots de passe
  password: /("password"\s*:\s*")(.*?)(")/gi,
  confirmPassword: /("confirmPassword"\s*:\s*")(.*?)(")/gi,
  
  // Tokens et clés
  jwt: /("token"\s*:\s*")(.*?)(")/gi,
  bearer: /(Bearer\s+)([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*)/gi,
  stripeKey: /(sk_(?:test_|live_))([A-Za-z0-9]{99})/gi,
  
  // Emails (partiellement masqués)
  email: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
  
  // Numéros de téléphone
  phone: /(\+?[1-9]\d{1,14})/gi,
  
  // Codes de vérification
  verificationCode: /("code"\s*:\s*")(.*?)(")/gi,
  
  // URLs MongoDB avec credentials
  mongoUri: /(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@/gi,
  
  // Adresses (partiellement masquées)
  address: /("address"\s*:\s*")(.*?)(")/gi
};

/**
 * Masque les données sensibles dans un texte
 */
function sanitizeLogData(data) {
  if (typeof data !== 'string') {
    data = JSON.stringify(data);
  }
  
  let sanitized = data;
  
  // Masquer les mots de passe
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.password, '$1***MASKED***$3');
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.confirmPassword, '$1***MASKED***$3');
  
  // Masquer les tokens
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.jwt, '$1***TOKEN_MASKED***$3');
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.bearer, '$1***TOKEN_MASKED***');
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.stripeKey, '$1***KEY_MASKED***');
  
  // Masquer les emails (garder le domaine)
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.email, (match, user, domain) => {
    const maskedUser = user.length > 2 ? user[0] + '*'.repeat(user.length - 2) + user[user.length - 1] : '***';
    return `${maskedUser}@${domain}`;
  });
  
  // Masquer les téléphones
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.phone, (match) => {
    return match.length > 4 ? match.substring(0, 2) + '*'.repeat(match.length - 4) + match.substring(match.length - 2) : '***';
  });
  
  // Masquer les codes de vérification
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.verificationCode, '$1***CODE***$3');
  
  // Masquer les credentials MongoDB
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.mongoUri, '$1***USER***:***PASS***@');
  
  // Masquer partiellement les adresses
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.address, (match, prefix, address, suffix) => {
    if (address.length > 10) {
      return `${prefix}${address.substring(0, 5)}***${address.substring(address.length - 3)}${suffix}`;
    }
    return `${prefix}***MASKED***${suffix}`;
  });
  
  return sanitized;
}

/**
 * Logger sécurisé qui remplace console.log
 */
class SecureLogger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
  }
  
  log(...args) {
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'object') {
        return sanitizeLogData(JSON.stringify(arg));
      }
      return sanitizeLogData(String(arg));
    });
    
    console.log(...sanitizedArgs);
  }
  
  error(...args) {
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'object') {
        // Pour les erreurs, garder la stack trace mais masquer les données sensibles
        if (arg instanceof Error) {
          return {
            message: sanitizeLogData(arg.message),
            stack: this.isProduction ? undefined : sanitizeLogData(arg.stack || ''),
            name: arg.name
          };
        }
        return sanitizeLogData(JSON.stringify(arg));
      }
      return sanitizeLogData(String(arg));
    });
    
    console.error(...sanitizedArgs);
  }
  
  warn(...args) {
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'object') {
        return sanitizeLogData(JSON.stringify(arg));
      }
      return sanitizeLogData(String(arg));
    });
    
    console.warn(...sanitizedArgs);
  }
  
  info(...args) {
    this.log(...args);
  }
  
  debug(...args) {
    // En production, ne pas logger les debug
    if (this.isProduction) return;
    
    this.log('[DEBUG]', ...args);
  }
}

// Instance singleton
const secureLogger = new SecureLogger();

// Export pour utilisation dans le code
export default secureLogger;

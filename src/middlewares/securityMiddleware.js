/**
 * 🛡️ MIDDLEWARE DE SÉCURITÉ GRAPHQL
 * Protection contre les injections et requêtes malveillantes
 */

import secureLogger from '../utils/secureLogger.js';

// Configuration de sécurité
const SECURITY_CONFIG = {
  // Limite de profondeur des requêtes GraphQL
  maxDepth: 10,
  
  // Limite de complexité des requêtes
  maxComplexity: 1000,
  
  // Limite de longueur des requêtes
  maxQueryLength: 10000,
  
  // Limite du nombre de champs demandés
  maxFieldCount: 100,
  
  // Rate limiting par IP
  maxRequestsPerMinute: 60,
  
  // Patterns suspects à détecter
  suspiciousPatterns: [
    /\$where/gi,           // Injection MongoDB
    /<script/gi,           // XSS
    /javascript:/gi,       // XSS
    /vbscript:/gi,         // XSS
    /onload=/gi,           // XSS
    /onerror=/gi,          // XSS
    /eval\(/gi,            // Code injection
    /function\(/gi,        // Code injection
    /setTimeout/gi,        // Code injection
    /setInterval/gi,       // Code injection
  ]
};

// Cache pour le rate limiting
const requestCache = new Map();

/**
 * Analyse la profondeur d'une requête GraphQL
 */
function analyzeQueryDepth(query) {
  const depthCount = (query.match(/\{/g) || []).length;
  return depthCount;
}

/**
 * Compte le nombre de champs dans une requête
 */
function countFields(query) {
  // Nettoyer les commentaires et strings
  const cleanQuery = query.replace(/["'][^"']*["']/g, '""')
                          .replace(/#[^\n\r]*/g, '');
  
  // Compter les sélections de champs (approximatif)
  const fieldMatches = cleanQuery.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\s*(?:\([^)]*\))?\s*(?:\{|$)/g) || [];
  return fieldMatches.length;
}

/**
 * Détecte les patterns suspects dans une requête
 */
function detectSuspiciousPatterns(query) {
  const suspiciousFound = [];
  
  for (const pattern of SECURITY_CONFIG.suspiciousPatterns) {
    if (pattern.test(query)) {
      suspiciousFound.push(pattern.source);
    }
  }
  
  return suspiciousFound;
}

/**
 * Validation de sécurité des variables GraphQL
 */
function validateVariables(variables) {
  if (!variables || typeof variables !== 'object') {
    return { isValid: true, errors: [] };
  }
  
  const errors = [];
  
  function validateValue(value, path = '') {
    if (typeof value === 'string') {
      // Vérifier la longueur
      if (value.length > 10000) {
        errors.push(`Variable trop longue à ${path}: ${value.length} caractères`);
      }
      
      // Vérifier les patterns suspects
      const suspicious = detectSuspiciousPatterns(value);
      if (suspicious.length > 0) {
        errors.push(`Patterns suspects détectés à ${path}: ${suspicious.join(', ')}`);
      }
      
      // Vérifier les caractères de contrôle
      if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value)) {
        errors.push(`Caractères de contrôle détectés à ${path}`);
      }
      
    } else if (Array.isArray(value)) {
      // Limiter la taille des tableaux
      if (value.length > 1000) {
        errors.push(`Tableau trop grand à ${path}: ${value.length} éléments`);
      }
      
      value.forEach((item, index) => {
        validateValue(item, `${path}[${index}]`);
      });
      
    } else if (value && typeof value === 'object') {
      // Limiter le nombre de propriétés
      const keys = Object.keys(value);
      if (keys.length > 50) {
        errors.push(`Objet trop complexe à ${path}: ${keys.length} propriétés`);
      }
      
      // Vérifier les noms de propriétés
      for (const key of keys) {
        if (typeof key === 'string') {
          if (key.length > 100) {
            errors.push(`Nom de propriété trop long à ${path}.${key}`);
          }
          
          // Vérifier les caractères suspects dans les noms
          if (/[<>'"&\x00-\x1F]/.test(key)) {
            errors.push(`Caractères suspects dans le nom de propriété à ${path}.${key}`);
          }
        }
        
        validateValue(value[key], `${path}.${key}`);
      }
    }
  }
  
  validateValue(variables);
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Rate limiting par IP/utilisateur
 */
function checkRateLimit(identifier) {
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute
  
  if (!requestCache.has(identifier)) {
    requestCache.set(identifier, []);
  }
  
  const requests = requestCache.get(identifier);
  
  // Nettoyer les anciennes requêtes
  const recentRequests = requests.filter(timestamp => timestamp > windowStart);
  
  // Vérifier la limite
  if (recentRequests.length >= SECURITY_CONFIG.maxRequestsPerMinute) {
    return {
      allowed: false,
      retryAfter: Math.ceil((recentRequests[0] + 60000 - now) / 1000)
    };
  }
  
  // Ajouter la nouvelle requête
  recentRequests.push(now);
  requestCache.set(identifier, recentRequests);
  
  return { allowed: true };
}

/**
 * Middleware de sécurité principal
 */
export function createSecurityMiddleware() {
  return {
    requestDidStart() {
      return {
        didResolveOperation(requestContext) {
          const { request, context } = requestContext;
          const query = request.query;
          const variables = request.variables;
          
          try {
            // 1. Vérifier la longueur de la requête
            if (query.length > SECURITY_CONFIG.maxQueryLength) {
              throw new Error(`Requête trop longue: ${query.length} caractères (max: ${SECURITY_CONFIG.maxQueryLength})`);
            }
            
            // 2. Analyser la profondeur
            const depth = analyzeQueryDepth(query);
            if (depth > SECURITY_CONFIG.maxDepth) {
              throw new Error(`Requête trop profonde: ${depth} niveaux (max: ${SECURITY_CONFIG.maxDepth})`);
            }
            
            // 3. Compter les champs
            const fieldCount = countFields(query);
            if (fieldCount > SECURITY_CONFIG.maxFieldCount) {
              throw new Error(`Trop de champs demandés: ${fieldCount} (max: ${SECURITY_CONFIG.maxFieldCount})`);
            }
            
            // 4. Détecter les patterns suspects
            const suspiciousPatterns = detectSuspiciousPatterns(query);
            if (suspiciousPatterns.length > 0) {
              secureLogger.warn('🚨 Patterns suspects détectés:', {
                patterns: suspiciousPatterns,
                ip: context?.headers?.['x-forwarded-for'] || 'unknown',
                userAgent: context?.headers?.['user-agent'] || 'unknown'
              });
              throw new Error('Requête contient des patterns suspects');
            }
            
            // 5. Valider les variables
            const variableValidation = validateVariables(variables);
            if (!variableValidation.isValid) {
              secureLogger.warn('🚨 Variables invalides:', variableValidation.errors);
              throw new Error('Variables de requête invalides');
            }
            
            // 6. Rate limiting
            const identifier = context?.user?.id || 
                             context?.headers?.['x-forwarded-for'] || 
                             context?.headers?.['x-real-ip'] || 
                             'anonymous';
            
            const rateLimitResult = checkRateLimit(identifier);
            if (!rateLimitResult.allowed) {
              throw new Error(`Rate limit atteint. Réessayez dans ${rateLimitResult.retryAfter} secondes`);
            }
            
            // Log des requêtes suspectes ou complexes
            if (depth > 7 || fieldCount > 50 || query.length > 5000) {
              secureLogger.info('🔍 Requête complexe détectée:', {
                depth,
                fieldCount,
                queryLength: query.length,
                user: context?.user?.id || 'anonymous',
                ip: context?.headers?.['x-forwarded-for'] || 'unknown'
              });
            }
            
          } catch (error) {
            secureLogger.error('🛡️ Requête bloquée par le middleware de sécurité:', error.message);
            throw error;
          }
        },
        
        didEncounterErrors(requestContext) {
          const { errors, context } = requestContext;
          
          // Logger les erreurs de sécurité
          const securityErrors = errors.filter(err => 
            err.message.includes('suspects') || 
            err.message.includes('Rate limit') ||
            err.message.includes('trop')
          );
          
          if (securityErrors.length > 0) {
            secureLogger.warn('🚨 Erreurs de sécurité GraphQL:', {
              errors: securityErrors.map(err => err.message),
              ip: context?.headers?.['x-forwarded-for'] || 'unknown',
              userAgent: context?.headers?.['user-agent'] || 'unknown'
            });
          }
        }
      };
    }
  };
}

/**
 * Nettoyage périodique du cache de rate limiting
 */
setInterval(() => {
  const now = Date.now();
  const cutoff = now - 300000; // 5 minutes
  
  for (const [key, requests] of requestCache.entries()) {
    const recentRequests = requests.filter(timestamp => timestamp > cutoff);
    if (recentRequests.length === 0) {
      requestCache.delete(key);
    } else {
      requestCache.set(key, recentRequests);
    }
  }
}, 60000); // Nettoyer toutes les minutes

export default createSecurityMiddleware;

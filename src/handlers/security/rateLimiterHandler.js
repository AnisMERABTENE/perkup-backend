const distributedCache = require('../../services/cache/cacheService.js');

// Stats globales du rate limiter
let rateLimiterStats = {
  totalRequests: 0,
  allowedRequests: 0,
  blockedRequests: 0,
  uniqueIPs: new Set(),
  resetTime: Date.now()
};

const handler = async (event, context) => {
  const startTime = Date.now();
  
  try {
    console.log('🛡️ Rate Limiter: Vérification en cours...');
    
    // Extraire les informations de la requête
    const requestInfo = extractRequestInfo(event);
    const { identifier, ip, userAgent, endpoint } = requestInfo;
    
    // Mettre à jour les stats
    rateLimiterStats.totalRequests++;
    rateLimiterStats.uniqueIPs.add(ip);
    
    // Vérifier les différents niveaux de rate limiting
    const checks = await Promise.all([
      checkGlobalRateLimit(),
      checkIPRateLimit(ip),
      checkUserRateLimit(identifier),
      checkEndpointRateLimit(endpoint, ip),
      checkSuspiciousActivity(ip, userAgent)
    ]);
    
    // Analyser les résultats
    const blockedCheck = checks.find(check => !check.allowed);
    
    if (blockedCheck) {
      rateLimiterStats.blockedRequests++;
      console.log(`🚫 Requête bloquée: ${blockedCheck.reason}`);
      
      // Enregistrer l'incident
      await logSecurityIncident(requestInfo, blockedCheck);
      
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': blockedCheck.retryAfter || 60,
          'X-RateLimit-Limit': blockedCheck.limit,
          'X-RateLimit-Remaining': blockedCheck.remaining || 0,
          'X-RateLimit-Reset': blockedCheck.resetTime || Date.now() + 60000
        },
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          reason: blockedCheck.reason,
          retryAfter: blockedCheck.retryAfter || 60
        })
      };
    }
    
    rateLimiterStats.allowedRequests++;
    
    const duration = Date.now() - startTime;
    console.log(`✅ Rate Limiter: Requête autorisée en ${duration}ms`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Check': 'passed'
      },
      body: JSON.stringify({
        allowed: true,
        stats: {
          checkDuration: duration,
          checks: checks.length
        }
      })
    };
    
  } catch (error) {
    console.error('❌ Erreur Rate Limiter:', error);
    
    // En cas d'erreur, on laisse passer (fail-open)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Check': 'error'
      },
      body: JSON.stringify({
        allowed: true,
        error: 'Rate limiter error - request allowed'
      })
    };
  }
};

// Extraction des informations de la requête
function extractRequestInfo(event) {
  const headers = event.headers || {};
  const requestContext = event.requestContext || {};
  
  return {
    ip: requestContext.identity?.sourceIp || headers['X-Forwarded-For'] || 'unknown',
    userAgent: headers['User-Agent'] || 'unknown',
    identifier: headers['Authorization'] ? 
      extractUserIdFromToken(headers['Authorization']) : 
      (requestContext.identity?.sourceIp || 'anonymous'),
    endpoint: `${event.httpMethod || 'UNKNOWN'} ${event.path || '/'}`,
    timestamp: Date.now(),
    requestId: requestContext.requestId
  };
}

function extractUserIdFromToken(authHeader) {
  try {
    const token = authHeader.replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return `user:${decoded.id}`;
  } catch (error) {
    return 'invalid_token';
  }
}

// Vérifications de rate limiting
async function checkGlobalRateLimit() {
  const limit = parseInt(process.env.RATE_LIMIT_GLOBAL) || 50000;
  const window = 3600; // 1 heure
  
  const result = await distributedCache.checkRateLimit('global', limit, window);
  
  return {
    type: 'global',
    allowed: result.allowed,
    limit: limit,
    remaining: result.remaining,
    current: result.current,
    reason: result.allowed ? null : 'Limite globale dépassée',
    retryAfter: result.allowed ? null : window
  };
}

async function checkIPRateLimit(ip) {
  const limit = 1000; // 1000 requêtes par heure par IP
  const window = 3600;
  
  const result = await distributedCache.checkRateLimit(`ip:${ip}`, limit, window);
  
  return {
    type: 'ip',
    allowed: result.allowed,
    limit: limit,
    remaining: result.remaining,
    current: result.current,
    reason: result.allowed ? null : `Limite IP dépassée pour ${ip}`,
    retryAfter: result.allowed ? null : window
  };
}

async function checkUserRateLimit(identifier) {
  const limit = parseInt(process.env.RATE_LIMIT_PER_USER) || 1000;
  const window = 3600;
  
  const result = await distributedCache.checkRateLimit(`user:${identifier}`, limit, window);
  
  return {
    type: 'user',
    allowed: result.allowed,
    limit: limit,
    remaining: result.remaining,
    current: result.current,
    reason: result.allowed ? null : `Limite utilisateur dépassée pour ${identifier}`,
    retryAfter: result.allowed ? null : window
  };
}

async function checkEndpointRateLimit(endpoint, ip) {
  // Limites spécifiques par endpoint
  const endpointLimits = {
    'POST /graphql': { limit: 500, window: 3600 },
    'POST /webhook/stripe': { limit: 100, window: 3600 },
    'GET /health': { limit: 60, window: 60 }, // 1 par seconde
    'default': { limit: 200, window: 3600 }
  };
  
  const config = endpointLimits[endpoint] || endpointLimits.default;
  const key = `endpoint:${endpoint}:${ip}`;
  
  const result = await distributedCache.checkRateLimit(key, config.limit, config.window);
  
  return {
    type: 'endpoint',
    allowed: result.allowed,
    limit: config.limit,
    remaining: result.remaining,
    current: result.current,
    reason: result.allowed ? null : `Limite endpoint dépassée: ${endpoint}`,
    retryAfter: result.allowed ? null : config.window
  };
}

async function checkSuspiciousActivity(ip, userAgent) {
  // Détecter les activités suspectes
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i
  ];
  
  const isSuspiciousUserAgent = suspiciousPatterns.some(pattern => 
    pattern.test(userAgent)
  );
  
  if (isSuspiciousUserAgent) {
    // Limite plus stricte pour les bots
    const limit = 10;
    const window = 3600;
    
    const result = await distributedCache.checkRateLimit(`suspicious:${ip}`, limit, window);
    
    if (!result.allowed) {
      // Enregistrer l'activité suspecte
      await logSuspiciousActivity(ip, userAgent);
    }
    
    return {
      type: 'suspicious',
      allowed: result.allowed,
      limit: limit,
      remaining: result.remaining,
      current: result.current,
      reason: result.allowed ? null : `Activité suspecte détectée: ${userAgent}`,
      retryAfter: result.allowed ? null : window
    };
  }
  
  return {
    type: 'suspicious',
    allowed: true
  };
}

// Logging et monitoring
async function logSecurityIncident(requestInfo, blockedCheck) {
  const incident = {
    type: 'rate_limit_exceeded',
    timestamp: new Date().toISOString(),
    ip: requestInfo.ip,
    userAgent: requestInfo.userAgent,
    endpoint: requestInfo.endpoint,
    identifier: requestInfo.identifier,
    reason: blockedCheck.reason,
    blockType: blockedCheck.type,
    limit: blockedCheck.limit,
    current: blockedCheck.current
  };
  
  try {
    // Stocker l'incident pour analyse
    await distributedCache.set(
      `incident:${Date.now()}:${requestInfo.ip}`,
      incident,
      'geo', // TTL long pour analyse
      86400 * 7 // 7 jours
    );
    
    console.log('🚨 Incident de sécurité enregistré:', incident);
    
    // Vérifier si on doit bannir temporairement cette IP
    await checkForTempBan(requestInfo.ip);
    
  } catch (error) {
    console.error('❌ Erreur enregistrement incident:', error);
  }
}

async function logSuspiciousActivity(ip, userAgent) {
  const activity = {
    type: 'suspicious_activity',
    timestamp: new Date().toISOString(),
    ip: ip,
    userAgent: userAgent
  };
  
  try {
    await distributedCache.set(
      `suspicious:${Date.now()}:${ip}`,
      activity,
      'geo',
      86400 // 24h
    );
    
    console.log('🔍 Activité suspecte enregistrée:', activity);
    
  } catch (error) {
    console.error('❌ Erreur enregistrement activité suspecte:', error);
  }
}

async function checkForTempBan(ip) {
  try {
    // Compter les incidents récents pour cette IP
    const recentIncidents = await countRecentIncidents(ip);
    
    if (recentIncidents >= 5) {
      // Bannir temporairement l'IP
      const banDuration = 3600; // 1 heure
      
      await distributedCache.set(
        `banned:${ip}`,
        {
          timestamp: new Date().toISOString(),
          reason: 'Trop d\'incidents de rate limiting',
          incidents: recentIncidents,
          duration: banDuration
        },
        'rate',
        banDuration
      );
      
      console.log(`🔒 IP bannie temporairement: ${ip} (${recentIncidents} incidents)`);
    }
    
  } catch (error) {
    console.error('❌ Erreur vérification bannissement:', error);
  }
}

async function countRecentIncidents(ip) {
  // Cette fonction devrait compter les incidents récents
  // Pour l'instant, on simule
  return Math.floor(Math.random() * 3) + 1;
}

// Fonction pour obtenir les stats du rate limiter
const getRateLimiterStats = () => {
  const uptime = Date.now() - rateLimiterStats.resetTime;
  
  return {
    ...rateLimiterStats,
    uniqueIPs: rateLimiterStats.uniqueIPs.size,
    uptime: uptime,
    requestsPerSecond: rateLimiterStats.totalRequests / (uptime / 1000),
    blockRate: (rateLimiterStats.blockedRequests / rateLimiterStats.totalRequests * 100).toFixed(2) + '%'
  };
};

// Health check du rate limiter
const healthCheck = async () => {
  try {
    const cacheHealth = await distributedCache.health();
    const stats = getRateLimiterStats();
    
    return {
      status: 'healthy',
      component: 'rate_limiter',
      cache: cacheHealth,
      stats: stats,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      status: 'unhealthy',
      component: 'rate_limiter',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Export CommonJS
module.exports = {
  handler,
  getRateLimiterStats,
  healthCheck
};

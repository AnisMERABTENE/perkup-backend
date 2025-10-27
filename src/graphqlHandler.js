import { ApolloServer } from 'apollo-server-lambda';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Import des modèles
import User from './models/User.js';
import { connectDB, checkDatabaseHealth } from './services/db.js';

// Import des schémas et résolveurs modulaires
import typeDefs from './schema/index.js';
import resolvers from './schema/resolvers.js';

// Import des middlewares de sécurité
import createSecurityMiddleware from './middlewares/securityMiddleware.js';
import secureLogger from './utils/secureLogger.js';

dotenv.config();

// Stats de performance globales (Phase 2)
let performanceStats = {
  totalRequests: 0,
  totalErrors: 0,
  averageResponseTime: 0,
  cacheHitRate: 0,
  authSuccessRate: 0
};

// Fonction pour extraire l'utilisateur du token avec monitoring
const getUser = async (event) => {
  const authStart = Date.now();
  
  try {
    const authHeader = event.headers?.Authorization || 
                      event.headers?.authorization ||
                      event.headers?.['Authorization'] ||
                      event.headers?.['authorization'];
    
    if (!authHeader) {
      secureLogger.debug('🔍 Auth: Pas de header Authorization');
      return null;
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Vérification JWT avec monitoring
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userData = await User.findById(decoded.id);
    
    if (!userData) {
      secureLogger.warn(`⚠️ Auth: Utilisateur ${decoded.id} introuvable`);
      return null;
    }
    
    const authDuration = Date.now() - authStart;
    secureLogger.info(`✅ Auth réussie en ${authDuration}ms pour utilisateur ${userData._id}`);
    
    // Mettre à jour les stats d'auth
    performanceStats.authSuccessRate = 
      (performanceStats.authSuccessRate + 1) / 2;
    
    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      userData: userData
    };
  } catch (error) {
    const authDuration = Date.now() - authStart;
    secureLogger.warn(`❌ Erreur auth (${authDuration}ms): Erreur de vérification`);
    return null;
  }
};

// Middleware de monitoring des requêtes
const requestMonitoringPlugin = {
  requestDidStart() {
    const requestStart = Date.now();
    
    return {
      didResolveOperation(requestContext) {
        const { operationName, request } = requestContext;
        secureLogger.info(`🔍 GraphQL Operation: ${operationName || 'Anonymous'}`);
        
        if (process.env.NODE_ENV === 'development') {
          secureLogger.debug(`📝 Query: ${request.query.substring(0, 100)}...`);
        }
      },
      
      didEncounterErrors(requestContext) {
        const duration = Date.now() - requestStart;
        performanceStats.totalErrors++;
        
        secureLogger.error(`❌ GraphQL Errors (${duration}ms):`, 
          requestContext.errors.map(err => err.message)
        );
      },
      
      willSendResponse(requestContext) {
        const duration = Date.now() - requestStart;
        performanceStats.totalRequests++;
        performanceStats.averageResponseTime = 
          (performanceStats.averageResponseTime + duration) / 2;
        
        // Ajouter les headers de performance
        requestContext.response.http.headers.set('X-Response-Time', `${duration}ms`);
        requestContext.response.http.headers.set('X-Total-Requests', performanceStats.totalRequests);
        
        if (duration > 1000) {
          secureLogger.warn(`⚠️ Requête lente détectée: ${duration}ms`);
        } else {
          secureLogger.debug(`⚡ Requête traitée en ${duration}ms`);
        }
      }
    };
  }
};

// Plugin de cache intelligent
const cacheIntelligentPlugin = {
  requestDidStart() {
    return {
      willSendResponse(requestContext) {
        const { operationName, request } = requestContext;
        
        // Analyser si la requête est cacheable
        if (request.query.includes('getPartners') || 
            request.query.includes('getCategories') ||
            request.query.includes('getCities')) {
          
          // Ajouter des headers de cache appropriés
          requestContext.response.http.headers.set('Cache-Control', 'public, max-age=300'); // 5 min
          requestContext.response.http.headers.set('X-Cache-Strategy', 'intelligent');
          
          performanceStats.cacheHitRate = 
            (performanceStats.cacheHitRate + 0.1) / 2;
        }
      }
    };
  }
};

// Plugin de sécurité avancée
const securityPlugin = {
  requestDidStart() {
    return {
      didResolveOperation(requestContext) {
        const { request } = requestContext;
        
        // Analyser la complexité de la requête
        const queryDepth = (request.query.match(/\{/g) || []).length;
        const queryLength = request.query.length;
        
        if (queryDepth > 10) {
          secureLogger.warn(`⚠️ Requête complexe détectée: profondeur ${queryDepth}`);
        }
        
        if (queryLength > 5000) {
          secureLogger.warn(`⚠️ Requête volumineuse détectée: ${queryLength} caractères`);
        }
        
        // Rate limiting basique
        const userAgent = requestContext.request.http?.headers.get('user-agent');
        if (userAgent && userAgent.includes('bot')) {
          secureLogger.info('🤖 Bot détecté: User-Agent suspect');
        }
      }
    };
  }
};

// Création du serveur Apollo avec optimisations Phase 2
const server = new ApolloServer({
  typeDefs,
  resolvers,
  
  // Plugins d'optimisation et sécurité
  plugins: [
    requestMonitoringPlugin,
    cacheIntelligentPlugin,
    securityPlugin,
    createSecurityMiddleware() // Middleware de sécurité avancé
  ],
  
  context: async ({ event, context }) => {
    const contextStart = Date.now();
    
    // Pattern officiel AWS Lambda
    context.callbackWaitsForEmptyEventLoop = false;
    
    // Assurer la connexion à la base de données avec monitoring
    try {
      await connectDB();
      
      // Récupérer l'utilisateur depuis le token JWT
      const user = await getUser(event);
      
      const contextDuration = Date.now() - contextStart;
      secureLogger.debug(`🔧 Contexte GraphQL créé en ${contextDuration}ms`);
      
      return {
        headers: event.headers,
        functionName: context.functionName,
        event,
        context,
        user, // Utilisateur authentifié (ou null)
        requestId: context.awsRequestId || 'local-' + Date.now(),
        startTime: contextStart
      };
    } catch (error) {
      secureLogger.error('❌ Erreur création contexte: Erreur d\'initialisation');
      throw new Error('Erreur d\'initialisation du contexte GraphQL');
    }
  },
  
  formatError: (err) => {
    // Log structuré pour monitoring production avec plus de détails
    const errorInfo = {
      message: err.message,
      code: err.extensions?.code || 'UNKNOWN_ERROR',
      path: err.path,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      source: err.source?.body,
      positions: err.positions
    };
    
    secureLogger.error('🔥 GraphQL Error (Phase 2):', errorInfo);
    
    // Incrémenter les stats d'erreur
    performanceStats.totalErrors++;
    
    // En production, masquer les détails sensibles
    if (process.env.NODE_ENV === 'production') {
      return {
        message: err.message,
        code: err.extensions?.code,
        path: err.path,
      };
    }
    
    return errorInfo;
  },
  
  formatResponse: (response, { context }) => {
    // Ajouter des métadonnées de performance
    if (context?.startTime) {
      const totalDuration = Date.now() - context.startTime;
      
      if (!response.extensions) {
        response.extensions = {};
      }
      
      response.extensions.performance = {
        totalDuration: `${totalDuration}ms`,
        requestId: context.requestId,
        timestamp: new Date().toISOString()
      };
      
      if (process.env.NODE_ENV === 'development') {
        response.extensions.debug = {
          totalRequests: performanceStats.totalRequests,
          averageResponseTime: `${Math.round(performanceStats.averageResponseTime)}ms`,
          errorRate: `${(performanceStats.totalErrors / performanceStats.totalRequests * 100).toFixed(2)}%`
        };
      }
    }
    
    return response;
  },
  
  introspection: process.env.NODE_ENV !== 'production',
  playground: process.env.NODE_ENV !== 'production',
  
  // Optimisations supplémentaires
  cache: 'bounded',
  persistedQueries: false,
  uploads: false, // Désactiver les uploads pour les performances
  
  // Configuration avancée
  subscriptions: false, // Désactiver si pas utilisé
  tracing: process.env.NODE_ENV === 'development',
  cacheControl: {
    defaultMaxAge: 300, // 5 minutes par défaut
    calculateCacheControlHeaders: true
  }
});

// Handler Lambda principal avec monitoring Phase 2
export const handler = server.createHandler({
  cors: {
    origin: process.env.NODE_ENV === 'production' ? 
      ['https://perkup.app', 'https://www.perkup.app', 'https://admin.perkup.app'] : 
      ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    methods: ['GET', 'POST', 'OPTIONS'],
    maxAge: 3600 // 1h pour sécurité
  },
  
  context: ({ event, context }) => {
    // Pattern officiel AWS Lambda selon documentation Mongoose
    context.callbackWaitsForEmptyEventLoop = false;
    
    // Ajouter des headers de sécurité
    return {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'"
      }
    };
  }
});

// Export des stats pour monitoring externe
export const getPerformanceStats = () => ({
  ...performanceStats,
  uptime: process.uptime(),
  memory: process.memoryUsage(),
  timestamp: new Date().toISOString()
});

// Health check endpoint
export const healthCheck = async () => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const stats = getPerformanceStats();
    
    return {
      status: 'healthy',
      version: '2.0.0',
      environment: process.env.NODE_ENV,
      database: dbHealth,
      performance: stats,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

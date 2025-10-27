import cacheService from '../cacheService.js';
import jwt from 'jsonwebtoken';
import { UserCache } from './userCache.js';

// Cache optimisé pour l'authentification
export class AuthCache {
  
  // Cache des tokens JWT décodés
  static async getCachedToken(token) {
    // Utiliser le token complet avec hash pour éviter les collisions
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const cacheKey = `token:${tokenHash}`;
    
    return await cacheService.get(cacheKey, 'auth');
  }
  
  static async setCachedToken(token, decodedData) {
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const cacheKey = `token:${tokenHash}`;
    // TTL plus court pour les tokens (15 min)
    return await cacheService.set(cacheKey, decodedData, 'auth', 900);
  }
  
  // Authentification avec cache multi-couches
  static async authenticateUser(token) {
    if (!token) return null;
    
    try {
      // Étape 1: Vérifier le cache du token
      let decoded = await this.getCachedToken(token);
      
      if (!decoded) {
        // Étape 2: Décoder le JWT
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Mettre en cache le token décodé
        await this.setCachedToken(token, decoded);
      }
      
      // Étape 3: Récupérer les données utilisateur (avec cache)
      const userData = await UserCache.getUser(decoded.id);
      
      if (!userData) {
        // Invalider le cache du token si l'utilisateur n'existe plus
        await this.invalidateToken(token);
        return null;
      }
      
      return {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        userData: userData
      };
    } catch (error) {
      console.error('Erreur authentification:', error.message);
      // Invalider le cache en cas d'erreur
      await this.invalidateToken(token);
      return null;
    }
  }
  
  // Invalider un token en cache
  static async invalidateToken(token) {
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const cacheKey = `token:${tokenHash}`;
    return await cacheService.del(cacheKey, 'auth');
  }
  
  // Invalider tous les tokens d'un utilisateur
  static async invalidateUserTokens(userId) {
    const pattern = `token:*`;
    // Note: Cette opération est coûteuse, à utiliser avec parcimonie
    return await cacheService.invalidatePattern(pattern, 'auth');
  }
  
  // Rate limiting par utilisateur avec cache
  static async checkUserRateLimit(userId, limit = 1000, window = 3600) {
    const identifier = `user:${userId}`;
    return await cacheService.checkRateLimit(identifier, limit, window);
  }
  
  // Rate limiting par IP
  static async checkIPRateLimit(ip, limit = 100, window = 3600) {
    const identifier = `ip:${ip}`;
    return await cacheService.checkRateLimit(identifier, limit, window);
  }
  
  // Cache des sessions utilisateur actives
  static async setUserSession(userId, sessionData) {
    const cacheKey = `session:${userId}`;
    // TTL plus long pour les sessions (2h)
    return await cacheService.set(cacheKey, sessionData, 'auth', 7200);
  }
  
  static async getUserSession(userId) {
    const cacheKey = `session:${userId}`;
    return await cacheService.get(cacheKey, 'auth');
  }
  
  static async invalidateUserSession(userId) {
    const cacheKey = `session:${userId}`;
    return await cacheService.del(cacheKey, 'auth');
  }
}

export default AuthCache;

import cacheService from '../cacheService.js';
import User from '../../../models/User.js';

// Cache des données utilisateur
export class UserCache {
  
  // Récupérer utilisateur avec cache
  static async getUser(userId) {
    return await cacheService.getOrSet(
      userId,
      'user',
      async () => {
        const user = await User.findById(userId);
        return user ? user.toObject() : null;
      }
    );
  }
  
  // Mettre à jour cache utilisateur
  static async setUser(userId, userData) {
    return await cacheService.set(userId, userData, 'user');
  }
  
  // Invalider cache utilisateur
  static async invalidateUser(userId) {
    return await cacheService.del(userId, 'user');
  }
  
  // Cache des utilisateurs par email
  static async getUserByEmail(email) {
    const cacheKey = `email:${email}`;
    
    return await cacheService.getOrSet(
      cacheKey,
      'user',
      async () => {
        const user = await User.findOne({ email });
        return user ? user.toObject() : null;
      }
    );
  }
  
  // Invalider cache après modification
  static async invalidateUserByEmail(email) {
    const cacheKey = `email:${email}`;
    return await cacheService.del(cacheKey, 'user');
  }
  
  // Invalider tous les caches d'un utilisateur
  static async invalidateAllUserCache(userId, email) {
    await Promise.all([
      this.invalidateUser(userId),
      email ? this.invalidateUserByEmail(email) : Promise.resolve()
    ]);
  }
}

export default UserCache;

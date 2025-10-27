import cacheService from '../cacheService.js';

// Cache intelligent pour cartes digitales - SEULEMENT les données statiques
export class DigitalCardCache {
  
  // Cache des abonnements utilisateur (déjà fait dans SubscriptionCache)
  // Pas besoin de duplication
  
  // Cache des partenaires pour validation (déjà fait dans PartnerCache)
  // Pas besoin de duplication
  
  // PAS de cache pour :
  // - Tokens TOTP (changent toutes les 2min)
  // - État de validation en temps réel
  // - Historique d'utilisation des tokens
  
  // Cache UNIQUEMENT les données statiques de calcul
  static async getDiscountCalculation(partnerDiscount, userPlan) {
    const cacheKey = `discount:${partnerDiscount}_${userPlan}`;
    
    return await cacheService.getOrSet(
      cacheKey,
      'calculations',
      async () => {
        // Calcul des réductions selon les plans
        const maxDiscounts = {
          basic: 5,
          super: 10,
          premium: 100
        };
        
        const maxDiscount = maxDiscounts[userPlan] || 0;
        const finalDiscount = userPlan === "premium" ? partnerDiscount : Math.min(partnerDiscount, maxDiscount);
        
        return {
          offered: partnerDiscount,
          applied: finalDiscount,
          maxForPlan: maxDiscount,
          reason: userPlan === 'premium' ? 'Premium - accès total' : `${userPlan} - plafonné à ${maxDiscount}%`
        };
      },
      3600 // 1h TTL - calculs statiques
    );
  }
  
  // Cache des statistiques utilisateur (moins critique)
  static async getUserCouponStats(userId) {
    const cacheKey = `stats:${userId}`;
    
    return await cacheService.getOrSet(
      cacheKey,
      'stats',
      async () => {
        const Coupon = (await import('../../../models/Coupon.js')).default;
        
        const stats = await Coupon.aggregate([
          { $match: { user: userId, status: 'used' } },
          {
            $group: {
              _id: '$digitalCardValidation',
              count: { $sum: 1 },
              totalSavings: { $sum: '$discountAmount' }
            }
          }
        ]);
        
        const digitalStats = stats.find(s => s._id === true) || { count: 0, totalSavings: 0 };
        const couponStats = stats.find(s => s._id === false || s._id === null) || { count: 0, totalSavings: 0 };
        
        return {
          digitalCardTransactions: digitalStats.count,
          digitalCardSavings: digitalStats.totalSavings,
          couponTransactions: couponStats.count,
          couponSavings: couponStats.totalSavings,
          totalSavings: digitalStats.totalSavings + couponStats.totalSavings
        };
      },
      300 // 5min TTL - stats peuvent être légèrement en retard
    );
  }
  
  // Invalider stats après nouvelle transaction
  static async invalidateUserStats(userId) {
    await cacheService.del(`stats:${userId}`, 'stats');
  }
}

export default DigitalCardCache;

import User from '../models/User.js';

// Cache en mémoire pour les vérifications d'abonnement (TTL: 5 minutes)
const subscriptionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper pour nettoyer le cache expiré
const cleanExpiredCache = () => {
  const now = Date.now();
  for (const [key, entry] of subscriptionCache.entries()) {
    if (now > entry.expiry) {
      subscriptionCache.delete(key);
    }
  }
};

// Vérifier et mettre en cache le statut d'abonnement
const checkSubscriptionStatus = async (userId) => {
  const cacheKey = `sub_${userId}`;
  const now = Date.now();
  
  // Nettoyer le cache périodiquement
  if (Math.random() < 0.01) cleanExpiredCache();
  
  // Vérifier le cache
  const cached = subscriptionCache.get(cacheKey);
  if (cached && now < cached.expiry) {
    return cached.data;
  }
  
  // Récupérer depuis la DB
  const user = await User.findById(userId).select('subscription').lean();
  if (!user) {
    throw new Error('Utilisateur introuvable');
  }
  
  const subscription = user.subscription;
  const result = {
    hasSubscription: !!(subscription && subscription.status === 'active'),
    plan: subscription?.plan || null,
    isExpired: false,
    subscription: subscription
  };
  
  // Vérifier l'expiration
  if (result.hasSubscription) {
    const now = new Date();
    if (subscription.currentPeriodEnd) {
      result.isExpired = now > new Date(subscription.currentPeriodEnd);
    } else if (subscription.endDate) {
      result.isExpired = now > new Date(subscription.endDate);
    }
    
    // Si expiré, marquer comme inactif
    if (result.isExpired) {
      result.hasSubscription = false;
      // Mise à jour asynchrone sans bloquer
      setImmediate(async () => {
        try {
          await User.findByIdAndUpdate(userId, {
            $set: { 'subscription.status': 'inactive' }
          });
        } catch (error) {
          console.error('Erreur mise à jour statut expiration:', error);
        }
      });
    }
  }
  
  // Mettre en cache
  subscriptionCache.set(cacheKey, {
    data: result,
    expiry: now + CACHE_TTL
  });
  
  return result;
};

// Middleware GraphQL avec pattern Higher-Order Function
export const withSubscription = (requiredPlan = null) => {
  return (resolver) => {
    return async (parent, args, context, info) => {
      try {
        const { user } = context;
        
        if (!user) {
          throw new Error('UNAUTHORIZED', {
            extensions: {
              code: 'UNAUTHENTICATED',
              message: 'Authentification requise pour accéder à ce contenu'
            }
          });
        }
        
        const subscriptionStatus = await checkSubscriptionStatus(user.id);
        
        if (!subscriptionStatus.hasSubscription) {
          throw new Error('SUBSCRIPTION_REQUIRED', {
            extensions: {
              code: 'SUBSCRIPTION_REQUIRED',
              message: 'Un abonnement actif est requis pour accéder à ce contenu',
              currentStatus: subscriptionStatus.subscription?.status || 'none'
            }
          });
        }
        
        if (subscriptionStatus.isExpired) {
          throw new Error('SUBSCRIPTION_EXPIRED', {
            extensions: {
              code: 'SUBSCRIPTION_EXPIRED',
              message: 'Votre abonnement a expiré',
              expiredAt: subscriptionStatus.subscription.currentPeriodEnd || subscriptionStatus.subscription.endDate
            }
          });
        }
        
        // Vérification du plan requis
        if (requiredPlan) {
          const requiredPlans = Array.isArray(requiredPlan) ? requiredPlan : [requiredPlan];
          const userPlan = subscriptionStatus.plan;
          
          if (!userPlan || !requiredPlans.includes(userPlan)) {
            throw new Error('INSUFFICIENT_PLAN', {
              extensions: {
                code: 'INSUFFICIENT_PLAN',
                message: `Plan ${requiredPlans.join(' ou ')} requis`,
                required: requiredPlans,
                current: userPlan
              }
            });
          }
        }
        
        // Ajouter les informations d'abonnement au contexte
        context.userSubscription = subscriptionStatus.subscription;
        context.subscriptionStatus = subscriptionStatus;
        
        // Exécuter le résolveur original
        return await resolver(parent, args, context, info);
        
      } catch (error) {
        // Log des erreurs pour monitoring
        console.error(`[SUBSCRIPTION_MIDDLEWARE] Error for user ${context.user?.id}:`, {
          error: error.message,
          requiredPlan,
          timestamp: new Date().toISOString(),
          operation: info.fieldName
        });
        
        throw error;
      }
    };
  };
};

// Directive GraphQL pour usage déclaratif dans le schéma
export const createSubscriptionDirective = () => {
  return {
    requiresSubscription: (next, src, args, context, info) => {
      return withSubscription()(next)(src, args, context, info);
    },
    
    requiresPlan: (next, src, args, context, info) => {
      const plan = args.plan || info.variableValues?.plan;
      return withSubscription(plan)(next)(src, args, context, info);
    }
  };
};

// Fonction utilitaire pour vérifier manuellement dans les résolveurs
export const requireActiveSubscription = async (context, requiredPlan = null) => {
  const { user } = context;
  
  if (!user) {
    throw new Error('Authentification requise');
  }
  
  const subscriptionStatus = await checkSubscriptionStatus(user.id);
  
  if (!subscriptionStatus.hasSubscription || subscriptionStatus.isExpired) {
    throw new Error('Abonnement actif requis');
  }
  
  if (requiredPlan) {
    const requiredPlans = Array.isArray(requiredPlan) ? requiredPlan : [requiredPlan];
    if (!requiredPlans.includes(subscriptionStatus.plan)) {
      throw new Error(`Plan ${requiredPlans.join(' ou ')} requis. Plan actuel: ${subscriptionStatus.plan}`);
    }
  }
  
  return subscriptionStatus.subscription;
};

// Fonction pour invalider le cache d'un utilisateur (après changement d'abonnement)
export const invalidateSubscriptionCache = (userId) => {
  const cacheKey = `sub_${userId}`;
  subscriptionCache.delete(cacheKey);
};

// Fonction pour obtenir les statistiques du cache (monitoring)
export const getSubscriptionCacheStats = () => {
  return {
    size: subscriptionCache.size,
    entries: Array.from(subscriptionCache.keys())
  };
};

// Export des constantes d'erreur pour usage dans les tests
export const SUBSCRIPTION_ERRORS = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  INSUFFICIENT_PLAN: 'INSUFFICIENT_PLAN'
};

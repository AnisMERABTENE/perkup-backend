import User from '../models/User.js';
import { SubscriptionCache } from '../services/cache/strategies/subscriptionCache.js';
import { UserCache } from '../services/cache/strategies/userCache.js';

// Middleware GraphQL robuste pour production
export const withSubscription = (requiredPlan = null) => {
  return (resolver) => {
    return async (parent, args, context, info) => {
      try {
        // Vérification authentification
        if (!context.user) {
          throw new Error('Authentification requise');
        }

        // Récupération utilisateur complet avec cache
        const userData = await UserCache.getUser(context.user.id);
        if (!userData) {
        throw new Error('Utilisateur introuvable');
        }

        // Récupération des features d'abonnement avec cache
        const subscriptionFeatures = await SubscriptionCache.getSubscriptionFeatures(context.user.id);
        
        if (!subscriptionFeatures || !subscriptionFeatures.isActive) {
        throw new Error('Abonnement actif requis');
        }

        // Vérification du plan requis
        if (requiredPlan) {
          const requiredPlans = Array.isArray(requiredPlan) ? requiredPlan : [requiredPlan];
          
          if (!requiredPlans.includes(subscriptionFeatures.plan)) {
            throw new Error(
              `Plan ${requiredPlans.join(' ou ')} requis. Plan actuel: ${subscriptionFeatures.plan || 'aucun'}`
            );
          }
        }

        // Enrichissement du contexte avec données subscription en cache
        const enrichedContext = {
          ...context,
          userSubscription: {
            plan: subscriptionFeatures.plan,
            status: subscriptionFeatures.status,
            isActive: subscriptionFeatures.isActive,
            features: subscriptionFeatures.features,
            maxDiscount: subscriptionFeatures.maxDiscount
          }
        };

        // Exécution du résolveur avec contexte enrichi
        return await resolver(parent, args, enrichedContext, info);
        
      } catch (error) {
        // Log structuré pour monitoring
        console.error('Subscription middleware error:', {
          userId: context.user?.id,
          error: error.message,
          requiredPlan,
          timestamp: new Date().toISOString()
        });
        
        throw error;
      }
    };
  };
};

// Helper pour déterminer les features par plan
const getFeaturesByPlan = (plan) => {
  const features = {
    basic: ['discount_5', 'basic_support'],
    super: ['discount_10', 'priority_support', 'advanced_search'],
    premium: ['discount_15', 'vip_support', 'advanced_search', 'real_time_notifications', 'analytics']
  };
  
  return features[plan] || [];
};

// Middleware pour vérifier seulement l'authentification (pas d'abonnement)
export const withAuth = (resolver) => {
  return async (parent, args, context, info) => {
    if (!context.user) {
      throw new Error('Authentification requise');
    }
    
    const userData = await User.findById(context.user.id);
    if (!userData) {
      throw new Error('Utilisateur introuvable');
    }
    
    const enrichedContext = {
      ...context,
      userData
    };
    
    return await resolver(parent, args, enrichedContext, info);
  };
};

// Utilitaires pour validation et gestion subscription
export const SubscriptionUtils = {
  // Vérifier si un plan donne accès à une feature
  hasFeature: (userPlan, featureName) => {
    const features = getFeaturesByPlan(userPlan);
    return features.includes(featureName);
  },
  
  // Obtenir le pourcentage de réduction selon le plan
  getDiscountPercent: (plan) => {
    const discounts = { basic: 5, super: 10, premium: 15 };
    return discounts[plan] || 0;
  },
  
  // Valider qu'un plan existe
  isValidPlan: (plan) => {
    return ['basic', 'super', 'premium'].includes(plan);
  },
  
  // Calculer les jours restants d'abonnement
  getDaysRemaining: (subscription) => {
    const endDate = subscription.currentPeriodEnd || subscription.endDate;
    if (!endDate) return 0;
    
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }
};

// Factory pour créer des middlewares spécialisés
export const createSubscriptionMiddleware = (config = {}) => {
  const {
    requiredPlan = null,
    features = [],
    gracePeriodDays = 0,
    customValidator = null
  } = config;
  
  return withSubscription(requiredPlan);
};

// Export des constantes pour les plans
export const SUBSCRIPTION_PLANS = {
  BASIC: 'basic',
  SUPER: 'super', 
  PREMIUM: 'premium'
};

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  CANCELED: 'canceled',
  PAST_DUE: 'past_due'
};

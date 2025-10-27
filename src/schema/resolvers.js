// Import de tous les résolveurs modulaires
import baseResolvers from './base/resolvers.js';
import authResolvers from './auth/resolvers.js';
import subscriptionResolvers from './subscription/resolvers.js';
import partnerResolvers from './partner/resolvers.js';
import vendorResolvers from './vendor/resolvers.js';
import digitalCardResolvers from './digitalCard/resolvers.js';
import couponResolvers from './coupon/resolvers.js';

// Fonction utilitaire pour fusionner les résolveurs
const mergeResolvers = (resolversArray) => {
  return resolversArray.reduce((merged, resolvers) => {
    // Fusionner les Query
    if (resolvers.Query) {
      merged.Query = { ...merged.Query, ...resolvers.Query };
    }
    
    // Fusionner les Mutation
    if (resolvers.Mutation) {
      merged.Mutation = { ...merged.Mutation, ...resolvers.Mutation };
    }
    
    // Fusionner les Subscription
    if (resolvers.Subscription) {
      merged.Subscription = { ...merged.Subscription, ...resolvers.Subscription };
    }
    
    // Fusionner d'autres types personnalisés
    Object.keys(resolvers).forEach(key => {
      if (key !== 'Query' && key !== 'Mutation' && key !== 'Subscription') {
        merged[key] = { ...merged[key], ...resolvers[key] };
      }
    });
    
    return merged;
  }, { Query: {}, Mutation: {}, Subscription: {} });
};

// Fusion de tous les résolveurs
const resolvers = mergeResolvers([
  baseResolvers,
  authResolvers,
  subscriptionResolvers,
  partnerResolvers,
  vendorResolvers,
  digitalCardResolvers,
  couponResolvers
]);

export default resolvers;

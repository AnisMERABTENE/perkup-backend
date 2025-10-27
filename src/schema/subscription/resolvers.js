import { handler as createSubscriptionHandler } from '../../handlers/subscription/createSubscriptionHandler.js';
import { handler as getSubscriptionStatusHandler } from '../../handlers/subscription/getSubscriptionStatusHandler.js';
import { handler as cancelSubscriptionHandler } from '../../handlers/subscription/cancelSubscriptionHandler.js';
import { handler as reactivateSubscriptionHandler } from '../../handlers/subscription/reactivateSubscriptionHandler.js';
import { withAuth, withSubscription } from '../../middlewares/checkSubscription.js';

const subscriptionResolvers = {
  Query: {
    getSubscriptionStatus: withAuth(async (_, __, context) => {
      const event = { context };
      return await getSubscriptionStatusHandler(event);
    }),

    getPartnerDiscount: withSubscription()(async (_, { partnerDiscount }, context) => {
      const subscription = context.userSubscription;
      
      // Plafonds par plan
      const maxDiscounts = {
        basic: 5,
        super: 10,
        premium: 100 // Pas de plafond
      };
      
      const maxDiscount = maxDiscounts[subscription.plan] || 5;
      const cappedDiscount = Math.min(partnerDiscount, maxDiscount);
      
      return {
        originalDiscount: partnerDiscount,
        cappedDiscount: cappedDiscount,
        userPlan: subscription.plan,
        maxDiscount: maxDiscount,
        message: cappedDiscount < partnerDiscount ? 
          `Réduction plafonnée à ${cappedDiscount}% (plan ${subscription.plan})` :
          `Réduction complète de ${cappedDiscount}% appliquée`
      };
    })
  },

  Mutation: {
    createSubscription: withAuth(async (_, args, context) => {
      const event = { arguments: args, context };
      return await createSubscriptionHandler(event);
    }),
    
    cancelSubscription: withAuth(async (_, __, context) => {
      const event = { context };
      return await cancelSubscriptionHandler(event);
    }),
    
    reactivateSubscription: withAuth(async (_, __, context) => {
      const event = { context };
      return await reactivateSubscriptionHandler(event);
    })
  }
};

export default subscriptionResolvers;

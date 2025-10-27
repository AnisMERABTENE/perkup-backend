import { getMyCouponsHandler, generateCouponHandler, useCouponHandler, verifyCouponHandler } from '../../handlers/digitalCard/couponHandler.js';
import { withAuth } from '../../middlewares/checkSubscription.js';

const couponResolvers = {
  Query: {
    getMyCoupons: withAuth(async (_, args, context) => {
      const event = { args, context };
      
      if (context.user.role !== 'client') {
        throw new Error('Accès réservé aux clients');
      }
      
      return await getMyCouponsHandler(event);
    }),
    
    verifyCoupon: withAuth(async (_, args, context) => {
      const event = { args, context };
      return await verifyCouponHandler(event);
    })
  },

  Mutation: {
    generateCoupon: withAuth(async (_, args, context) => {
      const event = { args, context };
      
      if (context.user.role !== 'client') {
        throw new Error('Seuls les clients peuvent générer des coupons');
      }
      
      return await generateCouponHandler(event);
    }),
    
    useCoupon: withAuth(async (_, args, context) => {
      const event = { args, context };
      
      if (context.user.role !== 'vendor') {
        throw new Error('Seuls les vendeurs peuvent utiliser des coupons');
      }
      
      return await useCouponHandler(event);
    })
  }
};

export default couponResolvers;

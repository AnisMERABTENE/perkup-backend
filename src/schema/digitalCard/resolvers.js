import { getMyDigitalCardHandler, toggleDigitalCardHandler, getCardUsageHistoryHandler, resetDigitalCardHandler } from '../../handlers/digitalCard/cardHandler.js';
import { validateDigitalCardHandler } from '../../handlers/digitalCard/validationHandler.js';
import { withAuth } from '../../middlewares/checkSubscription.js';

const digitalCardResolvers = {
  Query: {
    getMyDigitalCard: withAuth(async (_, __, context) => {
      const event = { context };
      
      if (context.user.role !== 'client') {
        throw new Error('Accès réservé aux clients');
      }
      
      return await getMyDigitalCardHandler(event);
    }),
    
    getCardUsageHistory: withAuth(async (_, __, context) => {
      const event = { context };
      
      if (context.user.role !== 'client') {
        throw new Error('Accès réservé aux clients');
      }
      
      return await getCardUsageHistoryHandler(event);
    })
  },

  Mutation: {
    toggleDigitalCard: withAuth(async (_, __, context) => {
      const event = { context };
      
      if (context.user.role !== 'client') {
        throw new Error('Accès réservé aux clients');
      }
      
      return await toggleDigitalCardHandler(event);
    }),
    
    resetDigitalCard: withAuth(async (_, __, context) => {
      const event = { context };
      
      if (context.user.role !== 'client') {
        throw new Error('Accès réservé aux clients');
      }
      
      return await resetDigitalCardHandler(event);
    }),
    
    validateDigitalCard: withAuth(async (_, args, context) => {
      const event = { args, context };
      
      if (context.user.role !== 'vendor') {
        throw new Error('Seuls les vendeurs peuvent valider des cartes');
      }
      
      return await validateDigitalCardHandler(event);
    })
  }
};

export default digitalCardResolvers;

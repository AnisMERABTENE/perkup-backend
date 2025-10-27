import { createStoreHandler, updateStoreHandler, getVendorProfileHandler, getVendorStoresHandler } from '../../handlers/vendor/storeHandler.js';
import { generateUploadSignature } from '../../services/cloudinaryService.js';
import { withAuth } from '../../middlewares/checkSubscription.js';

const vendorResolvers = {
  Query: {
    getVendorProfile: withAuth(async (_, __, context) => {
      const event = { context };
      
      if (context.user.role !== 'vendor') {
        throw new Error('Accès réservé aux vendeurs');
      }
      
      return await getVendorProfileHandler(event);
    }),
    
    getVendorStores: withAuth(async (_, __, context) => {
      const event = { context };
      
      if (context.user.role !== 'vendor') {
        throw new Error('Accès réservé aux vendeurs');
      }
      
      return await getVendorStoresHandler(event);
    }),

    generateUploadSignature: withAuth(async (_, args, context) => {
      if (context.user.role !== 'vendor') {
        throw new Error('Accès réservé aux vendeurs');
      }

      try {
        const { folder } = args.input || {};
        console.log('🔑 Génération signature upload pour vendeur:', context.user.id);
        
        return generateUploadSignature(folder || 'vendor-logos');
      } catch (error) {
        console.error('❌ Erreur génération signature:', error);
        return {
          success: false,
          error: error.message || 'Erreur lors de la génération de signature'
        };
      }
    })
  },

  Mutation: {
    createStore: withAuth(async (_, args, context) => {
      const event = { args, context };
      
      if (context.user.role !== 'vendor') {
        throw new Error('Seuls les vendeurs peuvent créer des boutiques');
      }
      
      return await createStoreHandler(event);
    }),
    
    updateStore: withAuth(async (_, args, context) => {
      const event = { args, context };
      
      if (context.user.role !== 'vendor') {
        throw new Error('Seuls les vendeurs peuvent modifier des boutiques');
      }
      
      return await updateStoreHandler(event);
    })
  }
};

export default vendorResolvers;

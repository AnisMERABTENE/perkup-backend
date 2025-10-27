import { searchPartnersHandler, getPartnersHandler, getPartnerHandler, getCategoriesHandler, getCitiesHandler, getCityCoordinatesHandler } from '../../handlers/vendor/partnerHandler.js';
import { withAuth } from '../../middlewares/checkSubscription.js';

const partnerResolvers = {
  Query: {
    searchPartners: withAuth(async (_, args, context) => {
      const event = { args, context };
      return await searchPartnersHandler(event);
    }),
    
    getPartners: withAuth(async (_, args, context) => {
      const event = { args, context };
      return await getPartnersHandler(event);
    }),
    
    getPartner: withAuth(async (_, args, context) => {
      const event = { args, context };
      return await getPartnerHandler(event);
    }),
    
    getCategories: withAuth(async () => {
      return await getCategoriesHandler();
    }),
    
    getCities: withAuth(async () => {
      return await getCitiesHandler();
    }),
    
    getCityCoordinates: withAuth(async () => {
      return await getCityCoordinatesHandler();
    })
  }
};

export default partnerResolvers;

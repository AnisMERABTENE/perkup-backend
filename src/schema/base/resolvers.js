const baseResolvers = {
  Query: {
    health: () => "Perkup GraphQL API is running!",
    
    cacheHealth: async () => {
      const cacheService = (await import('../../services/cache/cacheService.js')).default;
      return await cacheService.health();
    }
  }
};

export default baseResolvers;

// Import de tous les typeDefs modulaires
import baseTypeDefs from './base/typeDefs.js';
import authTypeDefs from './auth/typeDefs.js';
import subscriptionTypeDefs from './subscription/typeDefs.js';
import partnerTypeDefs from './partner/typeDefs.js';
import vendorTypeDefs from './vendor/typeDefs.js';
import digitalCardTypeDefs from './digitalCard/typeDefs.js';
import couponTypeDefs from './coupon/typeDefs.js';

// Assemblage de tous les types
const typeDefs = [
  baseTypeDefs,
  authTypeDefs,
  subscriptionTypeDefs,
  partnerTypeDefs,
  vendorTypeDefs,
  digitalCardTypeDefs,
  couponTypeDefs
];

export default typeDefs;

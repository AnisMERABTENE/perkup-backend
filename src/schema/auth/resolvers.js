import { handler as registerClientHandler } from '../../handlers/auth/registerClientHandler.js';
import { handler as registerVendorHandler } from '../../handlers/auth/registerVendorHandler.js';
import { handler as verifyEmailHandler } from '../../handlers/auth/verifyEmailHandler.js';
import { handler as loginHandler } from '../../handlers/auth/loginHandler.js';
import { withAuth } from '../../middlewares/checkSubscription.js';

const authResolvers = {
  Query: {
    me: withAuth(async (_, __, { userData }) => {
      return {
        id: userData._id.toString(),
        firstname: userData.firstname,
        lastname: userData.lastname,
        email: userData.email,
        role: userData.role,
        isVerified: userData.isVerified,
        subscription: userData.subscription
      };
    })
  },

  Mutation: {
    registerClient: async (_, args) => {
      const event = { arguments: args };
      return await registerClientHandler(event);
    },

    registerVendor: async (_, args) => {
      const event = { arguments: args };
      return await registerVendorHandler(event);
    },

    verifyEmail: async (_, args) => {
      const event = { arguments: args };
      return await verifyEmailHandler(event);
    },

    login: async (_, args) => {
      const event = { arguments: args };
      return await loginHandler(event);
    }
  }
};

export default authResolvers;

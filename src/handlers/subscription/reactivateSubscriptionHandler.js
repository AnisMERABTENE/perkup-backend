import Stripe from 'stripe';
import User from '../../models/User.js';
import { connectDB } from '../../services/db.js';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const handler = async (event) => {
  try {
    await connectDB();
    
    const userId = event.context.user.id;
    const user = await User.findById(userId);
    
    if (!user || !user.subscription?.stripeSubscriptionId) {
      throw new Error('Aucun abonnement trouvé');
    }

    await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    return { message: 'Abonnement réactivé avec succès' };
  } catch (error) {
    console.error('Erreur réactivation:', error);
    throw new Error('Erreur lors de la réactivation');
  }
};

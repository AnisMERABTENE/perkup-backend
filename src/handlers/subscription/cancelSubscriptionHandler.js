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
      throw new Error('Aucun abonnement actif trouvé');
    }

    // Annuler à la fin de la période actuelle
    await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    return { 
      message: 'Abonnement programmé pour annulation à la fin de la période',
      currentPeriodEnd: user.subscription.currentPeriodEnd
    };
  } catch (error) {
    console.error('Erreur annulation:', error);
    throw new Error('Erreur lors de l\'annulation');
  }
};

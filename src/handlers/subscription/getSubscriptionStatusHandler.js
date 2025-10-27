import User from '../../models/User.js';
import { connectDB } from '../../services/db.js';

export const handler = async (event) => {
  try {
    await connectDB();
    
    const userId = event.context.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('Utilisateur introuvable');
    }

    const subscription = user.subscription;
    let isActive = false;

    if (subscription.status === 'active') {
      // Pour les abonnements Stripe natifs, vérifier currentPeriodEnd
      if (subscription.currentPeriodEnd) {
        isActive = new Date() < subscription.currentPeriodEnd;
      }
      // Pour l'ancien système, vérifier endDate
      else if (subscription.endDate) {
        isActive = new Date() < subscription.endDate;
      }
    }

    return {
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        endDate: subscription.endDate
      },
      isActive,
      subscriptionType: subscription.stripeSubscriptionId ? 'stripe_subscription' : 'payment_intent'
    };
  } catch (error) {
    console.error('Erreur récupération statut:', error);
    throw new Error('Erreur serveur');
  }
};

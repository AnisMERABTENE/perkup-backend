import Stripe from 'stripe';
import User from '../../models/User.js';
import { connectDB } from '../../services/db.js';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Plans disponibles avec mapping vers les prix Stripe
const planToPriceId = {
  basic: process.env.STRIPE_PRICE_BASIC,
  super: process.env.STRIPE_PRICE_SUPER,
  premium: process.env.STRIPE_PRICE_PREMIUM
};

const plans = {
  basic: { name: "Basic", discount: 5 },
  super: { name: "Super", discount: 10 },
  premium: { name: "Premium", discount: 15 }
};

export const handler = async (event) => {
  try {
    await connectDB();
    
    const { plan } = event.arguments.input;
    const userId = event.context.user.id;
    
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Utilisateur introuvable');
    }

    if (!planToPriceId[plan]) {
      throw new Error('Plan invalide');
    }

    console.log(`Plan: ${plan}, PriceId: ${planToPriceId[plan]}`);
    const priceId = planToPriceId[plan];

    // Créer ou récupérer le customer Stripe
    let customerId = user.subscription?.stripeCustomerId;
    
    // FORCAGE : Si customerId est null ou undefined, créer un nouveau customer
    if (!customerId) {
      console.log('Création d\'un nouveau customer Stripe (customerId était:', customerId, ')');
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstname} ${user.lastname}`,
        metadata: { userId: user._id.toString() }
      });
      customerId = customer.id;

      // Mettre à jour l'utilisateur avec le customer ID IMMÉDIATEMENT
      await User.findByIdAndUpdate(user._id, {
        $set: { 'subscription.stripeCustomerId': customerId }
      });
      console.log('Customer ID sauvegardé:', customerId);
    } else {
      console.log('Customer ID existant trouvé:', customerId);
    }

    // Vérifier si l'utilisateur a déjà un abonnement actif
    const hasActiveSubscription = Boolean(
      user.subscription?.stripeSubscriptionId && 
      user.subscription?.status === 'active' &&
      user.subscription?.currentPeriodEnd &&
      new Date() < new Date(user.subscription.currentPeriodEnd)
    );

    let subscription;
    let clientSecret = null;

    if (hasActiveSubscription) {
      console.log('Upgrade demandé - création nouveau abonnement...');
      
      // Créer un nouvel abonnement
      subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription'
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: user._id.toString(),
          plan: plan,
          isUpgrade: true,
          previousPlan: user.subscription.plan,
          previousSubscriptionId: user.subscription.stripeSubscriptionId
        }
      });
      
      // Vérifier si un PaymentIntent existe
      let paymentIntent = subscription.latest_invoice?.payment_intent;
      
      if (!paymentIntent || typeof paymentIntent !== 'object') {
        const invoice = subscription.latest_invoice;
        
        const manualPaymentIntent = await stripe.paymentIntents.create({
          amount: invoice.amount_due,
          currency: invoice.currency,
          customer: customerId,
          setup_future_usage: 'off_session',
          metadata: {
            invoice_id: invoice.id,
            subscription_id: subscription.id,
            user_id: user._id.toString(),
            plan: plan,
            previousSubscriptionId: user.subscription.stripeSubscriptionId
          }
        });
        
        paymentIntent = manualPaymentIntent;
      }
      
      if (paymentIntent && typeof paymentIntent === 'object') {
        clientSecret = paymentIntent.client_secret;
      }
    } else {
      console.log('Création d\'un nouvel abonnement...');
      
      subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription'
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: user._id.toString(),
          plan: plan,
          isNewSubscription: true
        }
      });
      
      let paymentIntent = subscription.latest_invoice?.payment_intent;
      
      if (!paymentIntent || typeof paymentIntent !== 'object') {
        const invoice = subscription.latest_invoice;
        
        const manualPaymentIntent = await stripe.paymentIntents.create({
          amount: invoice.amount_due,
          currency: invoice.currency,
          customer: customerId,
          setup_future_usage: 'off_session',
          metadata: {
            invoice_id: invoice.id,
            subscription_id: subscription.id,
            user_id: user._id.toString(),
            plan: plan
          }
        });
        
        paymentIntent = manualPaymentIntent;
      }
      
      if (paymentIntent && typeof paymentIntent === 'object') {
        clientSecret = paymentIntent.client_secret;
      }
    }

    // Sauvegarder les informations d'abonnement en base
    const updateData = {
      'subscription.stripeCustomerId': customerId,  // AJOUT: toujours sauvegarder le customerId
      'subscription.stripeSubscriptionId': subscription.id,
      'subscription.plan': plan,
      'subscription.status': subscription.status
    };
    
    if (subscription.current_period_start && subscription.current_period_end) {
      updateData['subscription.currentPeriodStart'] = new Date(subscription.current_period_start * 1000);
      updateData['subscription.currentPeriodEnd'] = new Date(subscription.current_period_end * 1000);
    } else if (!hasActiveSubscription) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      updateData['subscription.currentPeriodStart'] = startDate;
      updateData['subscription.currentPeriodEnd'] = endDate;
    }
    
    await User.findByIdAndUpdate(user._id, {
      $set: updateData
    });

    // Retourner la réponse avec toutes les valeurs requises
    const response = {
      subscriptionId: subscription.id,
      clientSecret: clientSecret || null,
      status: subscription.status || 'incomplete',
      isUpgrade: hasActiveSubscription,
      requiresPayment: Boolean(clientSecret)
    };
    
    console.log('Réponse création abonnement:', response);
    return response;
  } catch (err) {
    console.error('Erreur création abonnement Stripe:', err);
    throw new Error(err.message || 'Erreur lors de la création de l\'abonnement');
  }
};

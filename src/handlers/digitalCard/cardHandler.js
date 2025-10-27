import DigitalCard from '../../models/DigitalCard.js';
import Coupon from '../../models/Coupon.js';
import Partner from '../../models/Partner.js';
import { UserCache } from '../../services/cache/strategies/userCache.js';
import { SubscriptionCache } from '../../services/cache/strategies/subscriptionCache.js';
import { 
  generateTOTP, 
  generateCardNumber, 
  generateTOTPSecret, 
  TOTP_WINDOW 
} from '../../services/totpService.js';

// Créer ou récupérer la carte digitale de l'utilisateur (CLIENT uniquement)
export const getMyDigitalCardHandler = async (event) => {
  const userId = event.context.user.id;
  
  try {
    // Vérifier l'abonnement
    const subscriptionFeatures = await SubscriptionCache.getSubscriptionFeatures(userId);
    if (!subscriptionFeatures?.isActive) {
      throw new Error('Abonnement requis pour accéder à la carte digitale');
    }
    
    let digitalCard = await DigitalCard.findOne({ user: userId });
    
    if (!digitalCard) {
      // Créer une nouvelle carte digitale
      const userSecret = generateTOTPSecret();
      const currentToken = generateTOTP(userSecret);
      const cardNumber = generateCardNumber();
      
      digitalCard = new DigitalCard({
        user: userId,
        currentToken,
        previousToken: null,
        cardNumber,
        lastRotation: new Date(),
        secret: userSecret,
        qrCodeData: JSON.stringify({
          userId,
          token: currentToken,
          cardNumber,
          timestamp: Date.now(),
          userPlan: subscriptionFeatures.plan
        }),
        tokenHistory: [{
          token: currentToken,
          createdAt: new Date()
        }]
      });
      
      await digitalCard.save();
      
      console.log(`Carte digitale créée pour utilisateur ${userId} - Numéro: ${cardNumber}`);
    } else {
      // Vérifier si le token doit être mis à jour
      const now = new Date();
      const timeSinceRotation = (now - digitalCard.lastRotation) / 1000;
      
      if (timeSinceRotation >= TOTP_WINDOW) {
        // Générer un nouveau token avec le secret existant
        const newToken = generateTOTP(digitalCard.secret);
        
        // Sauvegarder l'ancien token et générer le nouveau
        digitalCard.previousToken = digitalCard.currentToken;
        digitalCard.currentToken = newToken;
        digitalCard.lastRotation = now;
        digitalCard.qrCodeData = JSON.stringify({
          userId,
          token: newToken,
          cardNumber: digitalCard.cardNumber,
          timestamp: Date.now(),
          userPlan: subscriptionFeatures.plan
        });
        
        // Ajouter à l'historique (garder seulement les 10 derniers)
        digitalCard.tokenHistory.push({
          token: newToken,
          createdAt: now
        });
        
        if (digitalCard.tokenHistory.length > 10) {
          digitalCard.tokenHistory = digitalCard.tokenHistory.slice(-10);
        }
        
        await digitalCard.save();
        
        console.log(`Token mis à jour pour utilisateur ${userId} - Nouveau: ${newToken}`);
      }
    }
    
    // Calculer le temps restant avant la prochaine rotation
    const timeSinceRotation = (Date.now() - digitalCard.lastRotation) / 1000;
    const timeUntilRotation = Math.max(0, TOTP_WINDOW - timeSinceRotation);
    
    // Récupérer les informations utilisateur
    const userData = await UserCache.getUser(userId);
    
    return {
      card: {
        cardNumber: digitalCard.cardNumber,
        qrCode: digitalCard.currentToken,
        qrCodeData: digitalCard.qrCodeData,
        isActive: digitalCard.isActive,
        validUntil: new Date(Date.now() + (timeUntilRotation * 1000)),
        timeUntilRotation: Math.ceil(timeUntilRotation),
        userPlan: subscriptionFeatures.plan,
        userInfo: {
          name: `${userData.firstname} ${userData.lastname}`,
          email: userData.email
        }
      },
      instructions: 'Présentez ce QR code au vendeur pour bénéficier de votre réduction',
      security: {
        tokenRotates: `Toutes les ${TOTP_WINDOW} secondes (2 minutes)`,
        currentlyValid: `${Math.ceil(timeUntilRotation)} secondes restantes`
      }
    };
  } catch (error) {
    console.error('Erreur récupération carte digitale:', error);
    throw error;
  }
};

// Activer/désactiver la carte digitale
export const toggleDigitalCardHandler = async (event) => {
  const userId = event.context.user.id;
  
  try {
    const digitalCard = await DigitalCard.findOne({ user: userId });
    
    if (!digitalCard) {
      throw new Error('Aucune carte digitale trouvée');
    }
    
    digitalCard.isActive = !digitalCard.isActive;
    await digitalCard.save();
    
    const status = digitalCard.isActive ? 'activée' : 'désactivée';
    console.log(`Carte ${status} pour utilisateur ${userId}`);
    
    return {
      message: `Carte ${status} avec succès`,
      card: {
        cardNumber: digitalCard.cardNumber,
        isActive: digitalCard.isActive
      }
    };
  } catch (error) {
    console.error('Erreur toggle carte:', error);
    throw error;
  }
};

// Historique d'utilisation de la carte
export const getCardUsageHistoryHandler = async (event) => {
  const userId = event.context.user.id;
  
  try {
    const digitalCard = await DigitalCard.findOne({ user: userId });
    
    if (!digitalCard) {
      throw new Error('Aucune carte digitale trouvée');
    }
    
    // Récupérer les tokens utilisés
    const usedTokens = digitalCard.tokenHistory.filter(t => t.isUsed);
    
    return {
      card: {
        cardNumber: digitalCard.cardNumber,
        createdAt: digitalCard.createdAt,
        isActive: digitalCard.isActive
      },
      usage: {
        totalScans: usedTokens.length,
        recentUsage: usedTokens.slice(-10).map(t => ({
          usedAt: t.usedAt,
          token: t.token.replace(/./g, '*').slice(0, -2) + t.token.slice(-2) // Masquer partiellement
        }))
      },
      security: {
        lastRotation: digitalCard.lastRotation,
        rotationInterval: `${TOTP_WINDOW} secondes (2 minutes)`
      }
    };
  } catch (error) {
    console.error('Erreur historique carte:', error);
    throw error;
  }
};

// Supprimer/réinitialiser la carte
export const resetDigitalCardHandler = async (event) => {
  const userId = event.context.user.id;
  
  try {
    const result = await DigitalCard.findOneAndDelete({ user: userId });
    
    if (result) {
      console.log(`Carte supprimée pour utilisateur ${userId}`);
      return { 
        message: 'Carte supprimée avec succès',
        cardNumber: result.cardNumber
      };
    } else {
      return { message: 'Aucune carte à supprimer' };
    }
  } catch (error) {
    console.error('Erreur suppression carte:', error);
    throw error;
  }
};

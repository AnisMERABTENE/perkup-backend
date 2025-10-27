import Coupon from '../../models/Coupon.js';

// Historique des coupons/réductions d'un client
export const getMyCouponsHandler = async (event) => {
  const userId = event.context.user.id;
  const { status, limit = 20, page = 1 } = event.args;
  
  try {
    console.log('Récupération historique coupons pour utilisateur:', userId);
    
    let query = { user: userId };
    if (status) {
      query.status = status;
    }
    
    console.log('Query MongoDB:', JSON.stringify(query, null, 2));
    
    const coupons = await Coupon.find(query)
      .populate('partner', 'name category address logo')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    console.log('Nombre de coupons trouvés:', coupons.length);
    
    const total = await Coupon.countDocuments(query);
    
    // Calculer les économies totales
    const totalSavings = await Coupon.aggregate([
      { $match: { user: userId, status: 'used', discountAmount: { $exists: true } } },
      { $group: { _id: null, total: { $sum: '$discountAmount' } } }
    ]);
    
    // Statistiques par type de transaction
    const transactionStats = await Coupon.aggregate([
      { $match: { user: userId, status: 'used' } },
      {
        $group: {
          _id: '$digitalCardValidation',
          count: { $sum: 1 },
          totalSavings: { $sum: '$discountAmount' }
        }
      }
    ]);
    
    const digitalCardStats = transactionStats.find(s => s._id === true) || { count: 0, totalSavings: 0 };
    const couponStats = transactionStats.find(s => s._id === false || s._id === null) || { count: 0, totalSavings: 0 };
    
    return {
      coupons: coupons.map(coupon => ({
        id: coupon._id,
        code: coupon.code,
        partner: coupon.partner,
        discountApplied: coupon.discountApplied,
        originalAmount: coupon.originalAmount,
        discountAmount: coupon.discountAmount,
        finalAmount: coupon.finalAmount,
        status: coupon.status,
        createdAt: coupon.createdAt,
        usedAt: coupon.usedAt,
        expiresAt: coupon.expiresAt,
        isDigitalCard: coupon.digitalCardValidation || false,
        type: coupon.digitalCardValidation ? 'digital_card' : 'coupon'
      })),
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: coupons.length,
        totalCoupons: total
      },
      stats: {
        totalSavings: totalSavings.length > 0 ? totalSavings[0].total : 0,
        digitalCardTransactions: digitalCardStats.count,
        digitalCardSavings: digitalCardStats.totalSavings,
        couponTransactions: couponStats.count,
        couponSavings: couponStats.totalSavings
      }
    };
  } catch (error) {
    console.error('Erreur historique coupons client:', error);
    throw error;
  }
};

// Générer un coupon traditionnel pour un partenaire
export const generateCouponHandler = async (event) => {
  const { partnerId, originalAmount } = event.args.input;
  const userId = event.context.user.id;
  
  try {
    const Partner = (await import('../../models/Partner.js')).default;
    const partner = await Partner.findById(partnerId);
    
    if (!partner || !partner.isActive) {
      throw new Error('Partenaire introuvable ou inactif');
    }
    
    // Récupérer l'abonnement de l'utilisateur
    const { SubscriptionCache } = await import('../../services/cache/strategies/subscriptionCache.js');
    const subscriptionFeatures = await SubscriptionCache.getSubscriptionFeatures(userId);
    
    if (!subscriptionFeatures?.isActive) {
      throw new Error('Abonnement requis pour générer des coupons');
    }
    
    // Calculer la réduction applicable
    const { calculateUserDiscount, calculateAmounts } = await import('../../services/totpService.js');
    const discountApplied = calculateUserDiscount(partner.discount, subscriptionFeatures.plan);
    
    // Générer un code unique
    const generateCouponCode = () => {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      return `PERK-${timestamp}-${random}`;
    };
    
    const code = generateCouponCode();
    
    // Calculer les montants si fournis
    let amounts = { original: null, discountAmount: null, finalAmount: null };
    if (originalAmount && originalAmount > 0) {
      amounts = calculateAmounts(originalAmount, discountApplied);
    }
    
    // Créer le coupon
    const coupon = new Coupon({
      code,
      user: userId,
      partner: partner._id,
      discountApplied,
      originalAmount: amounts.original,
      discountAmount: amounts.discountAmount,
      finalAmount: amounts.finalAmount,
      status: 'generated',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expire dans 24h
      qrCode: code,
      metadata: {
        userPlan: subscriptionFeatures.plan,
        partnerOriginalDiscount: partner.discount,
        generatedAt: new Date()
      }
    });
    
    await coupon.save();
    
    console.log(`Coupon généré: ${code} pour utilisateur ${userId} chez ${partner.name} (${discountApplied}%)`);
    
    return {
      message: 'Coupon généré avec succès',
      coupon: {
        id: coupon._id,
        code: coupon.code,
        partner: {
          id: partner._id,
          name: partner.name,
          category: partner.category,
          address: partner.address
        },
        discountApplied,
        originalAmount: amounts.original,
        discountAmount: amounts.discountAmount,
        finalAmount: amounts.finalAmount,
        status: coupon.status,
        expiresAt: coupon.expiresAt,
        qrCode: coupon.qrCode
      }
    };
  } catch (error) {
    console.error('Erreur génération coupon:', error);
    throw error;
  }
};

// Utiliser/valider un coupon traditionnel (côté vendeur)
export const useCouponHandler = async (event) => {
  const { code, actualAmount } = event.args.input;
  const vendorId = event.context.user.id;
  
  try {
    const coupon = await Coupon.findOne({ code }).populate('user partner');
    
    if (!coupon) {
      throw new Error('Coupon introuvable');
    }
    
    if (coupon.status === 'used') {
      throw new Error('Coupon déjà utilisé');
    }
    
    if (coupon.status === 'expired' || (coupon.expiresAt && new Date() > coupon.expiresAt)) {
      throw new Error(`Coupon expiré le ${coupon.expiresAt}`);
    }
    
    // Vérifier que le vendor peut utiliser ce coupon
    if (coupon.partner && coupon.partner.owner && coupon.partner.owner.toString() !== vendorId) {
      throw new Error('Vous n\'êtes pas autorisé à utiliser ce coupon');
    }
    
    // Calculer le montant final si un montant réel est fourni
    let finalAmounts = {
      original: coupon.originalAmount,
      discountAmount: coupon.discountAmount,
      finalAmount: coupon.finalAmount
    };
    
    if (actualAmount && actualAmount > 0) {
      const { calculateAmounts } = await import('../../services/totpService.js');
      finalAmounts = calculateAmounts(actualAmount, coupon.discountApplied);
    }
    
    // Marquer le coupon comme utilisé
    coupon.status = 'used';
    coupon.usedAt = new Date();
    coupon.originalAmount = finalAmounts.original;
    coupon.discountAmount = finalAmounts.discountAmount;
    coupon.finalAmount = finalAmounts.finalAmount;
    coupon.validatedBy = vendorId;
    
    await coupon.save();
    
    console.log(`Coupon utilisé: ${code} par vendeur ${vendorId} pour client ${coupon.user.email}`);
    
    return {
      message: 'Coupon utilisé avec succès',
      coupon: {
        id: coupon._id,
        code: coupon.code,
        client: {
          name: `${coupon.user.firstname} ${coupon.user.lastname}`,
          email: coupon.user.email
        },
        partner: coupon.partner ? {
          name: coupon.partner.name,
          category: coupon.partner.category
        } : null,
        discountApplied: coupon.discountApplied,
        originalAmount: coupon.originalAmount,
        discountAmount: coupon.discountAmount,
        finalAmount: coupon.finalAmount,
        usedAt: coupon.usedAt,
        savings: coupon.discountAmount
      }
    };
  } catch (error) {
    console.error('Erreur utilisation coupon:', error);
    throw error;
  }
};

// Vérifier un coupon
export const verifyCouponHandler = async (event) => {
  const { code } = event.args;
  
  try {
    const coupon = await Coupon.findOne({ code })
      .populate('user', 'firstname lastname email')
      .populate('partner', 'name category address owner');
    
    if (!coupon) {
      throw new Error('Coupon introuvable');
    }
    
    const isExpired = coupon.expiresAt && new Date() > coupon.expiresAt;
    
    return {
      exists: true,
      coupon: {
        id: coupon._id,
        code: coupon.code,
        status: isExpired ? 'expired' : coupon.status,
        client: coupon.user ? {
          name: `${coupon.user.firstname} ${coupon.user.lastname}`,
          email: coupon.user.email
        } : null,
        partner: coupon.partner,
        discountApplied: coupon.discountApplied,
        createdAt: coupon.createdAt,
        expiresAt: coupon.expiresAt,
        usedAt: coupon.usedAt,
        isExpired,
        isDigitalCard: coupon.digitalCardValidation || false
      }
    };
  } catch (error) {
    console.error('Erreur vérification coupon:', error);
    throw error;
  }
};

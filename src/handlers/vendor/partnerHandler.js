import Partner from '../../models/Partner.js';
import { PartnerCache } from '../../services/cache/strategies/partnerCache.js';
import { SubscriptionCache } from '../../services/cache/strategies/subscriptionCache.js';
import cacheService from '../../services/cache/cacheService.js';
import websocketService from '../../services/websocketService.js';

// Fonction utilitaire pour calculer la distance
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Fonction pour calculer la réduction utilisateur
const calculateUserDiscount = (partnerDiscount, userPlan) => {
  if (userPlan === "premium") {
    return partnerDiscount; // Accès complet
  }
  
  const maxDiscounts = {
    basic: 5,
    super: 10,
    premium: 100 // Pas de limite
  };
  
  const maxDiscount = maxDiscounts[userPlan] || 0;
  return Math.min(partnerDiscount, maxDiscount);
};

// Rechercher des partenaires
export const searchPartnersHandler = async (event) => {
  const { lat, lng, radius = 10, category, city, name, limit = 20 } = event.args;
  const userId = event.context.user.id;
  
  try {
    // Récupérer le plan utilisateur avec cache
    const subscriptionFeatures = await SubscriptionCache.getSubscriptionFeatures(userId);
    const userPlan = subscriptionFeatures?.isActive ? subscriptionFeatures.plan : 'free';
    
    console.log('Recherche avec filtres:', { lat, lng, radius, category, city, name, limit });
    
    // Recherche avec cache
    const partners = await PartnerCache.searchPartners({
      lat, lng, radius, category, city, name, limit
    });
    
    console.log('Partenaires trouvés:', partners.length);
    
    const result = partners.map(partner => {
      const finalDiscount = calculateUserDiscount(partner.discount, userPlan);
      
      let distance = null;
      if (lat && lng && partner.location?.coordinates) {
        const partnerLng = partner.location.coordinates[0];
        const partnerLat = partner.location.coordinates[1];
        distance = calculateDistance(parseFloat(lat), parseFloat(lng), partnerLat, partnerLng);
      }
      
      return {
        id: partner._id,
        name: partner.name,
        category: partner.category,
        address: partner.address,
        city: partner.city,
        zipCode: partner.zipCode,
        location: {
          latitude: partner.location?.coordinates[1],
          longitude: partner.location?.coordinates[0]
        },
        distance: distance ? Math.round(distance * 100) / 100 : null,
        logo: partner.logo,
        description: partner.description,
        phone: partner.phone,
        website: partner.website,
        offeredDiscount: partner.discount,
        userDiscount: finalDiscount,
        isPremiumOnly: partner.discount > 15,
        canAccessFullDiscount: userPlan === "premium" || partner.discount <= (userPlan === "super" ? 10 : userPlan === "basic" ? 5 : 0),
        needsSubscription: userPlan === "free" && partner.discount > 0,
        createdAt: partner.createdAt
      };
    });
    
    // Trier par distance si géolocalisé
    if (lat && lng) {
      result.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }
    
    return {
      partners: result,
      userPlan,
      searchParams: {
        location: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
        radius: parseFloat(radius),
        category,
        city,
        name
      },
      totalFound: result.length,
      isGeoSearch: !!(lat && lng)
    };
  } catch (error) {
    console.error('Erreur recherche partenaires:', error);
    throw error;
  }
};

// Lister tous les partenaires
export const getPartnersHandler = async (event) => {
  const { category } = event.args;
  const userId = event.context.user.id;
  
  try {
    // 🔥 CACHE GLOBAL: Récupérer les données brutes (partagé entre tous) v2
    let partners;
    if (category) {
      const cacheKey = `category:${category}:v2`;
      partners = await cacheService.getOrSet(
        cacheKey,
        'partners',
        async () => {
          const partners = await Partner.find({ 
            category, 
            isActive: true 
          }).sort({ name: 1 });
          return partners.map(p => {
            const obj = p.toObject();
            obj._id = obj._id.toString();
            if (obj.owner) obj.owner = obj.owner.toString();
            return obj;
          });
        }
      );
    } else {
      // Cache global pour tous les partenaires v2
      partners = await cacheService.getOrSet(
        'all_partners:v2',
        'partners', 
        async () => {
          const partners = await Partner.find({ isActive: true }).sort({ name: 1 }).limit(100);
          return partners.map(p => {
            const obj = p.toObject();
            obj._id = obj._id.toString();
            if (obj.owner) obj.owner = obj.owner.toString();
            return obj;
          });
        }
      );
    }
    
    // 👤 CALCUL UTILISATEUR: Après récupération cache (pas caché)
    const subscriptionFeatures = await SubscriptionCache.getSubscriptionFeatures(userId);
    const userPlan = subscriptionFeatures?.isActive ? subscriptionFeatures.plan : 'free';
    
    const result = partners.map(partner => {
      const finalDiscount = calculateUserDiscount(partner.discount, userPlan);
      
      return {
        id: partner._id,
        name: partner.name,
        category: partner.category,
        address: partner.address,
        city: partner.city,
        zipCode: partner.zipCode,
        phone: partner.phone || '',
        discount: partner.discount,
        logo: partner.logo,
        description: partner.description,
        website: partner.website,
        location: partner.location ? {
          latitude: partner.location.coordinates[1],
          longitude: partner.location.coordinates[0]
        } : null,
        offeredDiscount: partner.discount,
        userDiscount: finalDiscount,
        isPremiumOnly: partner.discount > 15,
        canAccessFullDiscount: userPlan === "premium" || partner.discount <= (userPlan === "super" ? 10 : userPlan === "basic" ? 5 : 0),
        needsSubscription: userPlan === "free" && partner.discount > 0,
        isActive: partner.isActive,
        createdAt: partner.createdAt
      };
    });
    
    return {
      partners: result,
      userPlan: userPlan,
      totalPartners: result.length,
      availableCategories: [...new Set(partners.map(p => p.category))]
    };
  } catch (error) {
    console.error('Erreur récupération partenaires:', error);
    throw error;
  }
};

// 🔥 DÉTAIL D'UN PARTENAIRE AVEC CACHE PARTAGÉ PAR PLAN UTILISATEUR - OPTIMISÉ
export const getPartnerHandler = async (event) => {
  const { id } = event.args;
  const userId = event.context.user.id;
  
  try {
    console.log(`🔍 getPartnerHandler: partnerId=${id}, userId=${userId}`);
    
    // 🎯 ÉTAPE 1: Récupérer le plan utilisateur en PREMIER (optimisé avec cache)
    const subscriptionFeatures = await SubscriptionCache.getSubscriptionFeatures(userId);
    const userPlan = subscriptionFeatures?.isActive ? subscriptionFeatures.plan : 'free';
    
    console.log(`👤 Plan utilisateur: ${userPlan}`);
    
    // 🔥 ÉTAPE 2: Cache partagé par plan utilisateur - CLÉ INTELLIGENTE
    const cacheKey = `partner_detail:${id}:${userPlan}`;
    
    console.log(`🔑 Clé de cache partagé: ${cacheKey}`);
    
    // Essayer de récupérer depuis le cache partagé
    const cachedPartnerDetail = await cacheService.getOrSet(
      cacheKey,
      'partners',
      async () => {
        console.log(`💾 Cache MISS pour partner ${id} plan ${userPlan} - Génération des données`);
        
        // 🎯 Récupérer le partenaire - SOIT par ID MongoDB SOIT par nom
        let partner;
        
        // Vérifier si c'est un ID MongoDB valide (24 caractères hexadécimaux)
        const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
        
        if (isValidObjectId) {
          // Recherche par ID MongoDB
          console.log(`🔑 Recherche par ID MongoDB: ${id}`);
          partner = await PartnerCache.getPartner(id);
        } else {
          // Recherche par nom (slug décodé)
          const partnerName = decodeURIComponent(id).replace(/-/g, ' ');
          console.log(`📝 Recherche par nom: ${partnerName}`);
          
          // Recherche directe dans la base de données par nom
          const partnerFromDB = await Partner.findOne({ 
            name: { $regex: new RegExp(`^${partnerName}$`, 'i') },
            isActive: true 
          });
          
          if (partnerFromDB) {
            partner = {
              ...partnerFromDB.toObject(),
              _id: partnerFromDB._id.toString()
            };
          }
        }
        
        if (!partner) {
          throw new Error('Partenaire introuvable');
        }
        
        if (!partner.isActive) {
          throw new Error('Ce partenaire n\'est plus disponible');
        }
        
        // Calculer les données adaptées au plan utilisateur
        const finalDiscount = calculateUserDiscount(partner.discount, userPlan);
        
        const partnerDetail = {
          id: partner._id,
          name: partner.name,
          category: partner.category,
          address: partner.address,
          city: partner.city,
          zipCode: partner.zipCode,
          discount: partner.discount,
          logo: partner.logo,
          description: partner.description,
          phone: partner.phone,
          website: partner.website,
          location: partner.location ? {
            latitude: partner.location.coordinates[1],
            longitude: partner.location.coordinates[0]
          } : null,
          offeredDiscount: partner.discount,
          userDiscount: finalDiscount,
          isPremiumOnly: partner.discount > 15,
          userPlan: userPlan,
          canAccessFullDiscount: userPlan === "premium" || partner.discount <= (userPlan === "super" ? 10 : userPlan === "basic" ? 5 : 0),
          needsSubscription: userPlan === "free" && partner.discount > 0,
          createdAt: partner.createdAt,
          updatedAt: partner.updatedAt,
          // ✅ Métadonnées de cache pour debug
          _cacheInfo: {
            generatedAt: new Date().toISOString(),
            forPlan: userPlan,
            cacheKey: cacheKey,
            source: 'DB_GENERATION',
            searchMethod: isValidObjectId ? 'BY_ID' : 'BY_NAME'
          }
        };
        
        console.log(`✅ Données générées pour plan ${userPlan}:`, {
          partnerId: id,
          partnerName: partner.name,
          originalDiscount: partner.discount,
          userDiscount: finalDiscount,
          userPlan,
          searchMethod: isValidObjectId ? 'BY_ID' : 'BY_NAME'
        });
        
        return partnerDetail;
      },
      1800 // TTL: 30 minutes - Cache partagé entre users du même plan
    );
    
    // Mettre à jour les métadonnées si c'était un cache hit
    if (cachedPartnerDetail._cacheInfo && cachedPartnerDetail._cacheInfo.source === 'DB_GENERATION') {
      console.log(`🎯 Cache HIT: Partner ${id} pour plan ${userPlan} depuis cache partagé`);
      cachedPartnerDetail._cacheInfo.source = 'SHARED_CACHE_HIT';
      cachedPartnerDetail._cacheInfo.retrievedAt = new Date().toISOString();
    }
    
    console.log(`✅ Partner detail ${id} pour plan ${userPlan} retourné`);
    
    return cachedPartnerDetail;
    
  } catch (error) {
    console.error('❌ Erreur récupération partenaire:', error);
    throw error;
  }
};

// Lister les catégories
export const getCategoriesHandler = async () => {
  try {
    const categories = await PartnerCache.getCategories();
    
    return {
      categories,
      total: categories.length
    };
  } catch (error) {
    console.error('Erreur récupération catégories:', error);
    throw error;
  }
};

// Lister les villes disponibles
export const getCitiesHandler = async () => {
  try {
    const cities = await Partner.distinct("city", { isActive: true });
    
    return {
      cities: cities.filter(city => city && city.trim()).sort(),
      total: cities.length
    };
  } catch (error) {
    console.error('Erreur récupération villes:', error);
    throw error;
  }
};

// Coordonnées des villes avec partenaires
export const getCityCoordinatesHandler = async () => {
  try {
    const cityData = await Partner.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$city",
          coordinates: { $first: "$location.coordinates" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    const cityCoordinates = {};
    cityData.forEach(city => {
      if (city._id && city.coordinates && city.coordinates.length === 2) {
        cityCoordinates[city._id] = {
          latitude: city.coordinates[1],
          longitude: city.coordinates[0],
          partnerCount: city.count
        };
      }
    });
    
    return {
      cityCoordinates,
      totalCities: Object.keys(cityCoordinates).length,
      cities: Object.keys(cityCoordinates).sort()
    };
  } catch (error) {
    console.error('Erreur récupération coordonnées villes:', error);
    throw error;
  }
};

// 🚀 NOUVEAU: Créer un partenaire avec notification WebSocket
export const createPartnerHandler = async (event) => {
  const { input } = event.args;
  const userId = event.context.user.id;
  const userRole = event.context.user.role;
  
  try {
    console.log('🚀 Création d\'un nouveau partenaire:', input.name);
    
    // Vérifier les permissions
    if (userRole !== 'admin' && userRole !== 'vendor') {
      throw new Error('Non autorisé : seuls les admins et vendeurs peuvent créer des partenaires');
    }
    
    // Préparer les données du partenaire
    const partnerData = {
      ...input,
      owner: userId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Ajouter la géolocalisation si fournie
    if (input.latitude && input.longitude) {
      partnerData.location = {
        type: 'Point',
        coordinates: [input.longitude, input.latitude]
      };
    }
    
    // Créer le partenaire en base
    const newPartner = await Partner.create(partnerData);
    
    console.log('✅ Partenaire créé:', newPartner._id);
    
    // 🔥 INVALIDATION CACHE
    await PartnerCache.invalidateCache();
    await cacheService.invalidateGroup('partners');
    
    // 🚀 NOTIFICATION WEBSOCKET - Nouveau partenaire créé
    await websocketService.notifyPartnerChange(
      newPartner._id.toString(),
      'created',
      {
        id: newPartner._id.toString(),
        name: newPartner.name,
        category: newPartner.category,
        city: newPartner.city,
        discount: newPartner.discount,
        logo: newPartner.logo
      }
    );
    
    // 🎯 NOTIFICATION PAR GÉOLOCALISATION
    await websocketService.notifyPartnerChangeByLocation(
      newPartner._id.toString(),
      'created',
      newPartner,
      newPartner.city,
      newPartner.category
    );
    
    // 🔄 NOTIFICATION INVALIDATION CACHE
    await websocketService.notifyCacheInvalidation([
      'all_partners',
      `category:${newPartner.category}`,
      `city:${newPartner.city}`
    ]);
    
    console.log('📡 Notifications WebSocket envoyées pour nouveau partenaire');
    
    return {
      success: true,
      message: 'Partenaire créé avec succès',
      partner: {
        id: newPartner._id.toString(),
        name: newPartner.name,
        category: newPartner.category,
        address: newPartner.address,
        city: newPartner.city,
        discount: newPartner.discount,
        isActive: newPartner.isActive,
        createdAt: newPartner.createdAt.toISOString()
      }
    };
    
  } catch (error) {
    console.error('❌ Erreur création partenaire:', error);
    throw error;
  }
};

// 🔄 NOUVEAU: Mettre à jour un partenaire avec notification WebSocket
export const updatePartnerHandler = async (event) => {
  const { id, input } = event.args;
  const userId = event.context.user.id;
  const userRole = event.context.user.role;
  
  try {
    console.log(`🔄 Mise à jour partenaire ${id}:`, Object.keys(input));
    
    // Vérifier les permissions
    if (userRole !== 'admin' && userRole !== 'vendor') {
      throw new Error('Non autorisé : seuls les admins et vendeurs peuvent modifier des partenaires');
    }
    
    // Récupérer le partenaire existant
    const existingPartner = await Partner.findById(id);
    if (!existingPartner) {
      throw new Error('Partenaire introuvable');
    }
    
    // Vérifier que le vendeur ne peut modifier que ses propres partenaires
    if (userRole === 'vendor' && existingPartner.owner.toString() !== userId) {
      throw new Error('Non autorisé : vous ne pouvez modifier que vos propres partenaires');
    }
    
    // Préparer les données de mise à jour
    const updateData = {
      ...input,
      updatedAt: new Date()
    };
    
    // Mettre à jour la géolocalisation si fournie
    if (input.latitude && input.longitude) {
      updateData.location = {
        type: 'Point',
        coordinates: [input.longitude, input.latitude]
      };
    }
    
    // Effectuer la mise à jour
    const updatedPartner = await Partner.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    console.log('✅ Partenaire mis à jour:', id);
    
    // 🔥 INVALIDATION CACHE
    await PartnerCache.invalidatePartner(id);
    await PartnerCache.invalidateCache();
    await cacheService.invalidateGroup('partners');
    
    // 🚀 NOTIFICATION WEBSOCKET - Partenaire modifié
    await websocketService.notifyPartnerChange(
      id,
      'updated',
      {
        id: updatedPartner._id.toString(),
        name: updatedPartner.name,
        category: updatedPartner.category,
        city: updatedPartner.city,
        discount: updatedPartner.discount,
        changes: Object.keys(input),
        updatedAt: updatedPartner.updatedAt.toISOString()
      }
    );
    
    // 🎯 NOTIFICATION PAR GÉOLOCALISATION (si ville/catégorie modifiées)
    if (input.city || input.category) {
      await websocketService.notifyPartnerChangeByLocation(
        id,
        'updated',
        updatedPartner,
        updatedPartner.city,
        updatedPartner.category
      );
    }
    
    // 🔄 NOTIFICATION INVALIDATION CACHE
    await websocketService.notifyCacheInvalidation([
      `partner:${id}`,
      'all_partners',
      `category:${updatedPartner.category}`,
      `city:${updatedPartner.city}`,
      `partner_detail:${id}:*` // Invalider tous les caches de détail pour ce partenaire
    ]);
    
    console.log('📡 Notifications WebSocket envoyées pour mise à jour partenaire');
    
    return {
      success: true,
      message: 'Partenaire mis à jour avec succès',
      partner: {
        id: updatedPartner._id.toString(),
        name: updatedPartner.name,
        category: updatedPartner.category,
        address: updatedPartner.address,
        city: updatedPartner.city,
        discount: updatedPartner.discount,
        isActive: updatedPartner.isActive,
        updatedAt: updatedPartner.updatedAt.toISOString()
      }
    };
    
  } catch (error) {
    console.error(`❌ Erreur mise à jour partenaire ${id}:`, error);
    throw error;
  }
};

// 🗑️ NOUVEAU: Supprimer un partenaire avec notification WebSocket
export const deletePartnerHandler = async (event) => {
  const { id } = event.args;
  const userId = event.context.user.id;
  const userRole = event.context.user.role;
  
  try {
    console.log(`🗑️ Suppression partenaire ${id}`);
    
    // Vérifier les permissions (seuls les admins peuvent supprimer)
    if (userRole !== 'admin') {
      throw new Error('Non autorisé : seuls les admins peuvent supprimer des partenaires');
    }
    
    // Récupérer le partenaire avant suppression
    const partner = await Partner.findById(id);
    if (!partner) {
      throw new Error('Partenaire introuvable');
    }
    
    // Supprimer le partenaire
    await Partner.findByIdAndDelete(id);
    
    console.log('✅ Partenaire supprimé:', id);
    
    // 🔥 INVALIDATION CACHE COMPLÈTE
    await PartnerCache.invalidatePartner(id);
    await PartnerCache.invalidateCache();
    await cacheService.invalidateGroup('partners');
    
    // 🚀 NOTIFICATION WEBSOCKET - Partenaire supprimé
    await websocketService.notifyPartnerChange(
      id,
      'deleted',
      {
        id: id,
        name: partner.name,
        category: partner.category,
        city: partner.city,
        deletedAt: new Date().toISOString()
      }
    );
    
    // 🎯 NOTIFICATION PAR GÉOLOCALISATION
    await websocketService.notifyPartnerChangeByLocation(
      id,
      'deleted',
      { id, name: partner.name },
      partner.city,
      partner.category
    );
    
    // 🔄 NOTIFICATION INVALIDATION CACHE
    await websocketService.notifyCacheInvalidation([
      `partner:${id}`,
      'all_partners',
      `category:${partner.category}`,
      `city:${partner.city}`
    ]);
    
    console.log('📡 Notifications WebSocket envoyées pour suppression partenaire');
    
    return {
      success: true,
      message: `Partenaire "${partner.name}" supprimé avec succès`
    };
    
  } catch (error) {
    console.error(`❌ Erreur suppression partenaire ${id}:`, error);
    throw error;
  }
};

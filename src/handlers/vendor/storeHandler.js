import Partner from '../../models/Partner.js';
import User from '../../models/User.js';
import { UserCache } from '../../services/cache/strategies/userCache.js';
import { PartnerCache } from '../../services/cache/strategies/partnerCache.js';
import { validateCloudinaryUrl } from '../../services/cloudinaryService.js';
import GeocodingService from '../../services/geocodingService.js';
import { websocketService } from '../../services/websocketService.js';

// Créer une boutique
export const createStoreHandler = async (event) => {
  const { input } = event.args;
  const userId = event.context.user.id;
  
  try {
    // Vérifier que l'utilisateur est un vendeur
    const user = await UserCache.getUser(userId);
    if (!user || user.role !== 'vendor') {
      throw new Error('Seuls les vendeurs peuvent créer des boutiques');
    }
    
    // Vérifier si le vendeur a déjà une boutique
    const existingStores = await PartnerCache.getPartnersByVendor(userId);
    if (existingStores && existingStores.length > 0) {
      throw new Error('Vous avez déjà une boutique. Utilisez la modification pour la mettre à jour.');
    }
    
    const { name, category, address, phone, discount, description, logo, location } = input;
    
    // Validations
    if (!name || !category || !address || !phone || discount === undefined) {
      throw new Error('Les champs name, category, address, phone et discount sont requis');
    }
    
    if (discount < 0 || discount > 100) {
      throw new Error('La réduction doit être entre 0 et 100%');
    }

    // Valider l'URL du logo si fournie
    if (logo && !validateCloudinaryUrl(logo)) {
      throw new Error('URL du logo invalide. L\'image doit être uploadée via notre système.');
    }
    
    console.log(`Création boutique: ${name}`);
    
    // PRIORITÉ AUX COORDONNÉES DU FRONTEND (plus précises)
    let coordinates = null;
    
    if (location && location.coordinates && location.coordinates.length === 2) {
      coordinates = location.coordinates;
      console.log(`Coordonnées précises reçues du frontend: ${coordinates[1]}, ${coordinates[0]}`);
    } else {
      console.log('Aucune coordonnée fournie par le frontend, géocodage backend précis...');
      
      // Utiliser le nouveau service de géocodage précis
      const geoResult = await GeocodingService.geocodeAddress(address);
      
      if (geoResult) {
        coordinates = [geoResult.longitude, geoResult.latitude];
        console.log(`Géocodage réussi: ${geoResult.latitude}, ${geoResult.longitude}`);
      }
    }
    
    if (!coordinates) {
      throw new Error('Impossible de localiser cette adresse. Vérifiez l\'adresse saisie.');
    }
    
    // Extraire ville et code postal avec le nouveau service
    const { city, zipCode } = GeocodingService.extractCityAndZipCode(address);
    
    // Créer l'objet GeoJSON pour MongoDB
    const geoLocation = GeocodingService.createGeoJSONLocation(coordinates[1], coordinates[0]);
    
    // Créer la boutique
    const storeData = {
      name,
      category,
      address,
      city: city || address.split(',').pop()?.trim() || '',
      zipCode,
      phone,
      discount,
      description: description || '',
      logo: logo || null,
      owner: userId,
      location: geoLocation
    };
    
    const store = new Partner(storeData);
    await store.save();
    
    console.log(`Boutique créée avec coordonnées précises: ${name} - ${coordinates[1]}, ${coordinates[0]}`);
    
    // 🔥 INVALIDATION CACHE + NOTIFICATION WEBSOCKET TEMPS RÉEL
    await PartnerCache.invalidatePartner(store._id, userId);
    
    // 📡 Notifier tous les clients en temps réel
    await websocketService.notifyPartnerChangeByLocation(
      store._id.toString(),
      'created',
      {
        id: store._id.toString(),
        name: store.name,
        category: store.category,
        city: store.city,
        discount: store.discount
      },
      store.city,
      store.category
    );
    
    // 🔄 Notifier invalidation cache globale
    await websocketService.notifyCacheInvalidation(['partners', 'search', 'categories']);
    
    return {
      message: "Boutique créée avec succès",
      store: {
        id: store._id,
        name: store.name,
        category: store.category,
        address: store.address,
        city: store.city,
        zipCode: store.zipCode,
        phone: store.phone,
        discount: store.discount,
        description: store.description,
        logo: store.logo,
        location: {
          latitude: store.location.coordinates[1],
          longitude: store.location.coordinates[0]
        },
        isActive: store.isActive,
        createdAt: store.createdAt
      }
    };
  } catch (error) {
    console.error('Erreur création boutique:', error);
    throw error;
  }
};

// Modifier une boutique
export const updateStoreHandler = async (event) => {
  const { input } = event.args;
  const userId = event.context.user.id;
  
  try {
    const { name, category, address, phone, discount, description, logo, location } = input;
    
    // Validations
    if (!name || !category || !address || !phone || discount === undefined) {
      throw new Error('Les champs name, category, address, phone et discount sont requis');
    }
    
    if (discount < 0 || discount > 100) {
      throw new Error('La réduction doit être entre 0 et 100%');
    }
    
    // Trouver la boutique du vendeur
    const existingStore = await Partner.findOne({ owner: userId });
    if (!existingStore) {
      throw new Error('Aucune boutique trouvée pour ce vendeur');
    }
    
    console.log(`Modification boutique: ${name}`);
    
    // PRIORITÉ AUX COORDONNÉES DU FRONTEND (position manuelle)
    let coordinates = null;
    
    if (location && location.coordinates && location.coordinates.length === 2) {
      coordinates = location.coordinates;
    } else if (existingStore.location?.coordinates) {
      // Garder les anciennes coordonnées si pas de nouvelles
      coordinates = existingStore.location.coordinates;
      console.log(`Conservation des anciennes coordonnées: ${coordinates[1]}, ${coordinates[0]}`);
    } else {
      // Géocodage avec le nouveau service si aucune coordonnée disponible
      console.log('Aucune coordonnée, tentative géocodage précis...');
      const geoResult = await GeocodingService.geocodeAddress(address);
      
      if (geoResult) {
        coordinates = [geoResult.longitude, geoResult.latitude];
        console.log(`Géocodage backend: ${geoResult.latitude}, ${geoResult.longitude}`);
      }
    }
    
    if (!coordinates) {
      throw new Error('Impossible de localiser cette adresse');
    }
    
    // Extraire ville et code postal
    const { city, zipCode } = GeocodingService.extractCityAndZipCode(address);
    
    // Préparer les données de mise à jour
    const updateData = {
      name,
      category,
      address,
      city: city || address.split(',').pop()?.trim() || existingStore.city,
      zipCode,
      phone,
      discount,
      description: description || '',
      logo: logo || existingStore.logo,
      location: GeocodingService.createGeoJSONLocation(coordinates[1], coordinates[0]),
      updatedAt: new Date()
    };
    
    const updatedStore = await Partner.findByIdAndUpdate(
      existingStore._id,
      updateData,
      { new: true, runValidators: true }
    );
    
    console.log(`Boutique modifiée: ${name}`);
    
    // 🔥 INVALIDATION CACHE + NOTIFICATION WEBSOCKET TEMPS RÉEL
    await PartnerCache.invalidatePartner(updatedStore._id, userId);
    
    // 📡 Notifier modification en temps réel
    await websocketService.notifyPartnerChangeByLocation(
      updatedStore._id.toString(),
      'updated',
      {
        id: updatedStore._id.toString(),
        name: updatedStore.name,
        category: updatedStore.category,
        city: updatedStore.city,
        discount: updatedStore.discount
      },
      updatedStore.city,
      updatedStore.category
    );
    
    // 🔄 Notifier invalidation cache
    await websocketService.notifyCacheInvalidation(['partners', 'search', 'categories']);
    
    return {
      message: "Boutique mise à jour avec succès",
      store: {
        id: updatedStore._id,
        name: updatedStore.name,
        category: updatedStore.category,
        address: updatedStore.address,
        city: updatedStore.city,
        zipCode: updatedStore.zipCode,
        phone: updatedStore.phone,
        discount: updatedStore.discount,
        description: updatedStore.description,
        logo: updatedStore.logo,
        location: {
          latitude: updatedStore.location.coordinates[1],
          longitude: updatedStore.location.coordinates[0]
        },
        isActive: updatedStore.isActive,
        createdAt: updatedStore.createdAt,
        updatedAt: updatedStore.updatedAt
      }
    };
  } catch (error) {
    console.error('Erreur modification boutique:', error);
    throw error;
  }
};

// Récupérer le profil vendeur avec boutiques
export const getVendorProfileHandler = async (event) => {
  const userId = event.context.user.id;
  
  try {
    // Récupérer les données utilisateur avec cache
    const userData = await UserCache.getUser(userId);
    if (!userData || userData.role !== 'vendor') {
      throw new Error('Profil vendeur introuvable');
    }
    
    // Récupérer les boutiques avec cache
    const stores = await PartnerCache.getPartnersByVendor(userId);
    
    return {
      user: {
        id: userData._id,
        firstname: userData.firstname,
        lastname: userData.lastname,
        email: userData.email,
        role: userData.role,
        isVerified: userData.isVerified,
        createdAt: userData.createdAt
      },
      stores: stores.map(store => ({
        id: store._id,
        name: store.name,
        category: store.category,
        address: store.address,
        city: store.city,
        zipCode: store.zipCode,
        phone: store.phone,
        discount: store.discount,
        description: store.description,
        logo: store.logo,
        location: store.location ? {
          latitude: store.location.coordinates[1],
          longitude: store.location.coordinates[0]
        } : null,
        isActive: store.isActive,
        createdAt: store.createdAt
      })),
      hasStores: stores.length > 0,
      totalStores: stores.length,
      isSetupComplete: stores.length > 0
    };
  } catch (error) {
    console.error('Erreur récupération profil vendeur:', error);
    throw error;
  }
};

// Récupérer les boutiques du vendeur
export const getVendorStoresHandler = async (event) => {
  const userId = event.context.user.id;
  
  try {
    const stores = await PartnerCache.getPartnersByVendor(userId);
    const userData = await UserCache.getUser(userId);
    
    return {
      stores: stores.map(store => ({
        id: store._id,
        name: store.name,
        category: store.category,
        address: store.address,
        city: store.city,
        zipCode: store.zipCode,
        phone: store.phone,
        discount: store.discount,
        description: store.description,
        logo: store.logo,
        location: store.location ? {
          latitude: store.location.coordinates[1],
          longitude: store.location.coordinates[0]
        } : null,
        isActive: store.isActive,
        createdAt: store.createdAt
      })),
      total: stores.length,
      vendor: {
        id: userData._id,
        name: `${userData.firstname} ${userData.lastname}`,
        email: userData.email
      }
    };
  } catch (error) {
    console.error('Erreur récupération boutiques vendeur:', error);
    throw error;
  }
};

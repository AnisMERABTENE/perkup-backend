import cacheService from '../cacheService.js';
import Partner from '../../../models/Partner.js';
import GeocodingService from '../../geocodingService.js';

// Cache des données partenaires
export class PartnerCache {
  
  // Récupérer partenaire avec cache
  static async getPartner(partnerId) {
    return await cacheService.getOrSet(
      partnerId,
      'partners',
      async () => {
        const partner = await Partner.findById(partnerId);
        if (!partner) return null;
        const obj = partner.toObject();
        obj._id = obj._id.toString();
        if (obj.owner) obj.owner = obj.owner.toString();
        return obj;
      }
    );
  }
  
  // Cache des partenaires par vendeur
  static async getPartnersByVendor(vendorId) {
    const cacheKey = `vendor:${vendorId}`;
    
    return await cacheService.getOrSet(
      cacheKey,
      'partners',
      async () => {
        const partners = await Partner.find({ owner: vendorId }).sort({ createdAt: -1 });
        return partners.map(p => {
          const obj = p.toObject();
          obj._id = obj._id.toString();
          if (obj.owner) obj.owner = obj.owner.toString();
          return obj;
        });
      },
      1800 // 30min TTL
    );
  }
  
  // Cache des partenaires par géolocalisation
  static async getPartnersByLocation(lat, lng, radius = 10, category = null) {
    const cacheKey = `geo:${lat}_${lng}_${radius}_${category || 'all'}`;
    
    return await cacheService.getOrSet(
      cacheKey,
      'geo',
      async () => {
        const radiusInMeters = parseFloat(radius) * 1000;
        
        let query = { 
          isActive: true,
          location: {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [parseFloat(lng), parseFloat(lat)]
              },
              $maxDistance: radiusInMeters
            }
          }
        };
        
        if (category) {
          query.category = category;
        }
        
        const partners = await Partner.find(query).limit(50);
        return partners.map(p => {
          const obj = p.toObject();
          obj._id = obj._id.toString();
          if (obj.owner) obj.owner = obj.owner.toString();
          return obj;
        });
      },
      3600 // 1h TTL pour géo
    );
  }
  
  // Cache des catégories
  static async getCategories() {
    return await cacheService.getOrSet(
      'all_categories',
      'partners',
      async () => {
        const categories = await Partner.distinct("category", { isActive: true });
        return categories.sort().map(cat => ({
          value: cat,
          label: this.getCategoryLabel(cat)
        }));
      },
      7200 // 2h TTL
    );
  }
  
  // Cache des partenaires par catégorie
  static async getPartnersByCategory(category) {
    const cacheKey = `category:${category}`;
    
    return await cacheService.getOrSet(
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
  }
  
  // Recherche avec cache intelligent et géocodage automatique
  static async searchPartners(filters) {
    const { lat, lng, radius, category, city, name, limit = 20 } = filters;
    
    console.log('Cache search avec filtres:', filters);
    
    // Générer une clé de cache basée sur tous les filtres (v2 pour forcer invalidation)
    const filterKey = JSON.stringify({ lat, lng, radius, category, city, name, limit, v: 2 });
    const cacheKey = `search:${Buffer.from(filterKey).toString('base64').substring(0, 20)}`;
    
    return await cacheService.getOrSet(
      cacheKey,
      'partners',
      async () => {
        console.log('Exécution de la requête MongoDB avec filtres:', { category, city, name });
        
        let query = { isActive: true };
        let useGeoSearch = false;
        let searchLat = lat;
        let searchLng = lng;
        let searchRadius = radius || 10;
        
        // Si on a une ville mais pas de coordonnées, géocoder la ville avec précision
        if (city && !lat && !lng) {
          console.log('Géocodage précis de la ville:', city);
          try {
            const geoResult = await GeocodingService.geocodeAddress(city);
            
            if (geoResult) {
              searchLat = geoResult.latitude;
              searchLng = geoResult.longitude;
              useGeoSearch = true;
              console.log(`Ville géocodée avec précision: ${city} -> ${searchLat}, ${searchLng}`);
            } else {
              console.log('Impossible de géocoder la ville, recherche par nom de ville');
              query.city = new RegExp(city, 'i');
            }
          } catch (error) {
            console.error('Erreur géocodage précis:', error.message);
            query.city = new RegExp(city, 'i');
          }
        } else if (lat && lng) {
          useGeoSearch = true;
        }
        
        if (category) {
          query.category = category;
          console.log('Filtre catégorie appliqué:', category);
        }
        if (name) {
          query.name = new RegExp(name, 'i');
          console.log('Filtre nom appliqué:', name);
        }
        
        console.log('Requête MongoDB finale:', query);
        console.log('Recherche géo:', useGeoSearch, searchLat, searchLng, searchRadius);
        
        let partners;
        
        if (useGeoSearch && searchLat && searchLng) {
          const radiusInMeters = parseFloat(searchRadius) * 1000;
          
          partners = await Partner.find({
            ...query,
            location: {
              $near: {
                $geometry: {
                  type: "Point",
                  coordinates: [parseFloat(searchLng), parseFloat(searchLat)]
                },
                $maxDistance: radiusInMeters
              }
            }
          }).limit(parseInt(limit));
        } else {
          partners = await Partner.find(query)
            .sort({ name: 1 })
            .limit(parseInt(limit));
        }
        
        console.log('Résultats MongoDB:', partners.length, 'partenaires trouvés');
        
        return partners.map(p => {
          const obj = p.toObject();
          obj._id = obj._id.toString();
          if (obj.owner) obj.owner = obj.owner.toString();
          return obj;
        });
      },
      600 // 10min TTL pour recherches
    );
  }
  
  // Invalidation après modification
  static async invalidatePartner(partnerId, vendorId = null) {
    console.log(`🔥 DÉBUT INVALIDATION CACHE - partnerId: ${partnerId}, vendorId: ${vendorId}`);
    
    await Promise.all([
      cacheService.del(partnerId, 'partners'),
      vendorId ? cacheService.del(`vendor:${vendorId}`, 'partners') : Promise.resolve(),
      // 🔥 INVALIDATION CACHE GLOBAL PARTENAIRES - CORRECTION CRITIQUE
      cacheService.del('all_partners:v2', 'partners'),
      cacheService.del('all_categories', 'partners')
    ]);
    
    console.log(`✅ INVALIDATION CACHE TERMINÉE - Clés supprimées:`);
    console.log(`- ${partnerId} (partners)`);
    if (vendorId) console.log(`- vendor:${vendorId} (partners)`);
    console.log(`- all_partners:v2 (partners) <- CLÉ PRINCIPALE`);
    console.log(`- all_categories (partners)`);
  }
  
  // Labels des catégories
  static getCategoryLabel(category) {
    const labels = {
      'restaurant': 'Restaurant',
      'boulangerie': 'Boulangerie',
      'bar': 'Bar/Café',
      'fleuriste': 'Fleuriste',
      'kebab': 'Kebab',
      'jeux': 'Jeux vidéo',
      'cinema': 'Cinéma',
      'pharmacie': 'Pharmacie',
      'vetements': 'Vêtements',
      'beaute': 'Beauté',
      'sport': 'Sport',
      'tabac': 'Tabac/Presse',
      'technologie': 'Technologie',
      'maison': 'Maison/Déco',
      'sante': 'Santé',
      'automobile': 'Automobile',
      'loisirs': 'Loisirs',
      'services': 'Services'
    };
    
    return labels[category] || category;
  }
}

export default PartnerCache;

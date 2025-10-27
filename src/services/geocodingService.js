import { getPreciseCoordinates } from './preciseCoordinates.js';

// Service de géocodage pour convertir adresses en coordonnées GPS
class GeocodingService {
  
  /**
   * Géocoder une adresse complète avec coordonnées précises en priorité
   * @param {string} address - Adresse complète (rue, ville, code postal)
   * @returns {Promise<{latitude: number, longitude: number} | null>}
   */
  static async geocodeAddress(address) {
    try {
      console.log(`🗺️ Géocodage de l'adresse: ${address}`);
      
      // PREMIÈRE PRIORITÉ: Vérifier les coordonnées précises de référence
      const preciseCoords = getPreciseCoordinates(address);
      if (preciseCoords) {
        console.log(`🎯 Coordonnées précises utilisées: ${preciseCoords.latitude}, ${preciseCoords.longitude}`);
        return preciseCoords;
      }
      
      // Nettoyer et encoder l'adresse
      const cleanAddress = address.trim();
      const encodedAddress = encodeURIComponent(cleanAddress);
      
      // OPTION 1: Google Geocoding API (plus précis)
      const googleResult = await this.geocodeWithGoogle(encodedAddress);
      if (googleResult) {
        return googleResult;
      }
      
      // OPTION 2: Fallback vers Nominatim si Google échoue
      console.log('⚠️ Google Geocoding indisponible, utilisation de Nominatim...');
      const nominatimResult = await this.geocodeWithNominatim(encodedAddress);
      if (nominatimResult) {
        return nominatimResult;
      }
      
      console.log(`❌ Aucun résultat pour: ${address}`);
      return null;
      
    } catch (error) {
      console.error(`❌ Erreur géocodage pour "${address}":`, error.message);
      return null;
    }
  }
  
  /**
   * Géocodage avec Google Geocoding API (PRÉCISION MAXIMALE)
   */
  static async geocodeWithGoogle(encodedAddress) {
    try {
      const GOOGLE_API_KEY = process.env.GOOGLE_GEOCODING_API_KEY;
      
      if (!GOOGLE_API_KEY) {
        console.log('⚠️ Clé API Google manquante, utilisation de Nominatim');
        return null;
      }
      
      const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&region=fr&key=${GOOGLE_API_KEY}`;
      
      const response = await fetch(googleUrl);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP Google: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        const coordinates = {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng
        };
        
        console.log(`✅ Google Geocoding réussi: ${coordinates.latitude}, ${coordinates.longitude}`);
        console.log(`📍 Lieu trouvé: ${result.formatted_address}`);
        
        return coordinates;
      } else {
        console.log(`❌ Google Geocoding: ${data.status} - ${data.error_message || 'Aucun résultat'}`);
        return null;
      }
      
    } catch (error) {
      console.error('Erreur Google Geocoding:', error.message);
      return null;
    }
  }
  
  /**
   * Géocodage avec Nominatim amélioré (fallback)
   */
  static async geocodeWithNominatim(encodedAddress) {
    try {
      // Recherche plus précise avec plusieurs paramètres
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=3&countrycodes=FR&addressdetails=1&extratags=1&namedetails=1&dedupe=1`;
      
      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'PerkUP-Backend/1.0.0 (contact@perkup.com)'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP Nominatim: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        // Prendre le résultat le plus précis (house_number > building > road)
        const bestResult = data.find(result => 
          result.address && (result.address.house_number || result.class === 'building')
        ) || data[0];
        
        const coordinates = {
          latitude: parseFloat(bestResult.lat),
          longitude: parseFloat(bestResult.lon)
        };
        
        console.log(`✅ Nominatim réussi: ${coordinates.latitude}, ${coordinates.longitude}`);
        console.log(`📍 Lieu trouvé: ${bestResult.display_name}`);
        console.log(`🔍 Type: ${bestResult.class}/${bestResult.type}, Importance: ${bestResult.importance}`);
        
        return coordinates;
      }
      
      return null;
      
    } catch (error) {
      console.error('Erreur Nominatim:', error.message);
      return null;
    }
  }
  
  /**
   * Extraire ville et code postal de l'adresse
   * @param {string} address 
   * @returns {{city: string, zipCode: string}}
   */
  static extractCityAndZipCode(address) {
    // Regex pour code postal français (5 chiffres)
    const zipCodeMatch = address.match(/\b(\d{5})\b/);
    const zipCode = zipCodeMatch ? zipCodeMatch[1] : '';
    
    // Extraire la ville après le code postal
    let city = '';
    if (zipCodeMatch) {
      const afterZipCode = address.substring(address.indexOf(zipCodeMatch[0]) + 5).trim();
      city = afterZipCode.split(',')[0].trim();
    } else {
      // Si pas de code postal, prendre le dernier élément après la virgule
      const parts = address.split(',');
      if (parts.length > 1) {
        city = parts[parts.length - 1].trim();
      }
    }
    
    return { city, zipCode };
  }
  
  /**
   * Créer un objet location GeoJSON
   * @param {number} latitude 
   * @param {number} longitude 
   * @returns {{type: string, coordinates: number[]}}
   */
  static createGeoJSONLocation(latitude, longitude) {
    return {
      type: 'Point',
      coordinates: [longitude, latitude] // [lon, lat] pour GeoJSON
    };
  }
  
  /**
   * Valider des coordonnées
   * @param {number} latitude 
   * @param {number} longitude 
   * @returns {boolean}
   */
  static validateCoordinates(latitude, longitude) {
    return (
      typeof latitude === 'number' && 
      typeof longitude === 'number' &&
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180 &&
      !isNaN(latitude) && !isNaN(longitude)
    );
  }

  /**
   * Calculer la distance entre deux points (formule Haversine)
   * @param {number} lat1 
   * @param {number} lng1 
   * @param {number} lat2 
   * @param {number} lng2 
   * @returns {number} Distance en kilomètres
   */
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Rayon de la Terre en kilomètres
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

export default GeocodingService;

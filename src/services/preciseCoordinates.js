// Coordonnées de référence précises pour les adresses principales
const PRECISE_COORDINATES = {
  // Paris 1er arrondissement
  "123 rue de rivoli, 75001 paris": { latitude: 48.8606, longitude: 2.3376 },
  "789 rue saint-honoré, 75001 paris": { latitude: 48.8606, longitude: 2.3297 },
  "123 rue de la paix, 75001 paris": { latitude: 48.8692848, longitude: 2.3312305 },
  
  // Paris 8ème arrondissement  
  "456 avenue des champs-élysées, 75008 paris": { latitude: 48.8698, longitude: 2.3065 },
  
  // Paris 9ème arrondissement
  "15 boulevard des capucines, 75009 paris": { latitude: 48.8698, longitude: 2.331 },
  
  // Paris 10ème arrondissement
  "22 boulevard saint-martin, 75010 paris": { latitude: 48.8677, longitude: 2.3665 },
  
  // Paris 14ème arrondissement
  "74 avenue du maine, 75014 paris": { latitude: 48.8422, longitude: 2.3213 },
  
  // Herblay-sur-Seine (95220)
  "25 rue des martyrs, 95220 herblay-sur-seine": { latitude: 49.0189, longitude: 2.1689 },
  "8 place de la gare, 95220 herblay-sur-seine": { latitude: 49.0145, longitude: 2.1634 },
  "18 rue maurice berteaux, 95220 herblay-sur-seine": { latitude: 49.0198, longitude: 2.1712 },
  "7 avenue du général de gaulle, 95220 herblay-sur-seine": { latitude: 49.0156, longitude: 2.1645 },
  "centre commercial leclerc, 95220 herblay-sur-seine": { latitude: 49.0134, longitude: 2.1723 },
  "15 rue de paris, 95220 herblay-sur-seine": { latitude: 49.0178, longitude: 2.1678 },
  "22 place de la république, 95220 herblay-sur-seine": { latitude: 49.0187, longitude: 2.169 },
  "centre commercial val d'oise, 95220 herblay-sur-seine": { latitude: 49.0156, longitude: 2.1701 },
  "28 rue du commerce, 95220 herblay-sur-seine": { latitude: 49.0189, longitude: 2.1667 },
  "zone commerciale des copistes, 95220 herblay-sur-seine": { latitude: 49.0201, longitude: 2.1634 },
  "5 place du marché, 95220 herblay-sur-seine": { latitude: 49.0167, longitude: 2.1689 },
  "12 avenue de la division leclerc, 95220 herblay-sur-seine": { latitude: 49.0167, longitude: 2.1658 },
  
  // Marseille
  "route de la sabliere , centre commercial auchan": { latitude: 43.2914823, longitude: 5.48889399 },
  
  // Herbley (variante orthographique)
  "06 boulevard oscar thevenin": { latitude: 48.99011525, longitude: 2.16333032 },
  
  // Normalisation des variations d'écriture
  "89 boulevard de port-royal": { latitude: 48.8387, longitude: 2.3370 },
  "logic street": { latitude: 48.8566, longitude: 2.3522 }
};

/**
 * Récupère les coordonnées précises pour une adresse donnée
 */
export function getPreciseCoordinates(address) {
  // Normaliser l'adresse pour la recherche
  const normalized = address.toLowerCase()
    .replace(/[-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Chercher une correspondance exacte
  if (PRECISE_COORDINATES[normalized]) {
    console.log(`🎯 Coordonnées précises trouvées pour: ${address}`);
    return PRECISE_COORDINATES[normalized];
  }
  
  // Chercher une correspondance partielle (rue principale)
  for (const [key, coords] of Object.entries(PRECISE_COORDINATES)) {
    const keyStreet = key.split(',')[0].trim();
    const inputStreet = normalized.split(',')[0].trim();
    
    if (keyStreet.includes(inputStreet) || inputStreet.includes(keyStreet)) {
      console.log(`🎯 Correspondance partielle trouvée pour: ${address}`);
      return coords;
    }
  }
  
  return null;
}

export default PRECISE_COORDINATES;

// Test de validation du token JWT
const jwt = require('jsonwebtoken');

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MDMxNTNiODJjOTUyMjVlYTNjNmEyZCIsImVtYWlsIjoiY2FjaGUtcmVkaXMtZmluYWxAZ21haWwuY29tIiwicm9sZSI6InZlbmRvciIsImlhdCI6MTc2MTgyMzUzMiwiZXhwIjoxNzYyNDI4MzMyfQ.8viHu1cp9o1f_A38gpmsCRu8xTo6kl6ZWjxMfeqvg5c";

// Décoder sans vérifier (pour voir le payload)
try {
  const decoded = jwt.decode(token);
  console.log('🔍 TOKEN JWT DÉCODÉ:');
  console.log(JSON.stringify(decoded, null, 2));
  console.log('');
  
  // Vérifications importantes
  console.log('✅ VÉRIFICATIONS:');
  console.log('📌 Champ "id" présent:', decoded.id ? '✅ OUI' : '❌ NON');
  console.log('📌 Valeur id:', decoded.id);
  console.log('📌 Email:', decoded.email);
  console.log('📌 Role:', decoded.role);
  console.log('📌 Émis le:', new Date(decoded.iat * 1000).toLocaleString());
  console.log('📌 Expire le:', new Date(decoded.exp * 1000).toLocaleString());
  console.log('📌 Encore valide:', Date.now() < decoded.exp * 1000 ? '✅ OUI' : '❌ EXPIRÉ');
  
  // Test de ce que fait notre fonction verifyToken
  console.log('');
  console.log('🔧 SIMULATION DU CONNECTHANDLER:');
  if (decoded.id) {
    console.log('✅ decoded.id trouvé:', decoded.id);
    console.log('✅ Le connectHandler devrait accepter ce token');
  } else {
    console.log('❌ decoded.id manquant - le connectHandler refuserait ce token');
  }
  
} catch (error) {
  console.error('❌ Erreur décodage token:', error.message);
}

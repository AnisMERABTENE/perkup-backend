import WebSocket from 'ws';

// Nouveau token JWT obtenu du login
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MDMxNTNiODJjOTUyMjVlYTNjNmEyZCIsImVtYWlsIjoiY2FjaGUtcmVkaXMtZmluYWxAZ21haWwuY29tIiwicm9sZSI6InZlbmRvciIsImlhdCI6MTc2MTgyMzUzMiwiZXhwIjoxNzYyNDI4MzMyfQ.8viHu1cp9o1f_A38gpmsCRu8xTo6kl6ZWjxMfeqvg5c";

// URL WebSocket avec les corrections appliquées
const wsUrl = `wss://0p6v60p0l3.execute-api.eu-west-1.amazonaws.com/prod?token=${token}`;

console.log('🔌 Test connexion WebSocket avec TOKEN FRAIS...');
console.log('📍 URL:', wsUrl);
console.log('🔑 Token (premiers caractères):', token.substring(0, 50) + '...');
console.log('👤 User: cache-redis-final@gmail.com (vendor)');
console.log('🕐 Token valide jusqu\'au:', new Date(1762428332 * 1000).toLocaleString());
console.log('');

const ws = new WebSocket(wsUrl);

ws.on('open', function open() {
  console.log('✅ Connexion WebSocket établie !');
  console.log('🎉 Les corrections ont fonctionné !');
  console.log('🔧 Endpoint HTTPS corrigé : OK');
  console.log('🔑 Token JWT valide : OK');
  console.log('💬 Pas d\'erreur 410 : SUCCESS');
  console.log('');
  
  // Test ping après 1 seconde
  setTimeout(() => {
    console.log('🏓 Envoi ping...');
    ws.send(JSON.stringify({
      type: 'ping',
      timestamp: new Date().toISOString()
    }));
  }, 1000);
  
  // Test subscription après 2 secondes
  setTimeout(() => {
    console.log('📡 Test subscription...');
    ws.send(JSON.stringify({
      type: 'subscribe',
      data: {
        topics: ['partners', 'notifications']
      }
    }));
  }, 2000);
});

ws.on('message', function message(data) {
  try {
    const parsed = JSON.parse(data);
    console.log('📨 Message reçu:', JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log('📨 Message brut:', data.toString());
  }
});

ws.on('error', function error(err) {
  console.error('❌ Erreur WebSocket:', err.message);
  console.error('💡 Si erreur 401, vérifiez que le token JWT est valide');
});

ws.on('close', function close(code, reason) {
  console.log('🔒 Connexion fermée:', { 
    code, 
    reason: reason.toString(),
    meaning: code === 1000 ? 'Normal' : code === 1001 ? 'Going Away' : code === 1006 ? 'Abnormal' : 'Other'
  });
});

// Fermer automatiquement après 15 secondes
setTimeout(() => {
  console.log('⏱️ Test terminé - fermeture automatique');
  ws.close();
  process.exit(0);
}, 15000);

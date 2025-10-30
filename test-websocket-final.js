import WebSocket from 'ws';

// Nouveau token JWT obtenu du login
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MDMxNTNiODJjOTUyMjVlYTNjNmEyZCIsImVtYWlsIjoiY2FjaGUtcmVkaXMtZmluYWxAZ21haWwuY29tIiwicm9sZSI6InZlbmRvciIsImlhdCI6MTc2MTgyMzUzMiwiZXhwIjoxNzYyNDI4MzMyfQ.8viHu1cp9o1f_A38gpmsCRu8xTo6kl6ZWjxMfeqvg5c";

// URL WebSocket avec endpoint corrigé
const wsUrl = `wss://0p6v60p0l3.execute-api.eu-west-1.amazonaws.com/prod?token=${token}`;

console.log('🔌 Test connexion WebSocket avec TOKEN FRAIS...');
console.log('📍 URL:', wsUrl);
console.log('🔑 Token valide jusqu\'au:', new Date(1762428332 * 1000).toLocaleString());
console.log('👤 User ID:', "6903153b82c95225ea3c6a2d");
console.log('📧 Email:', "cache-redis-final@gmail.com");
console.log('🏷️ Role:', "vendor");
console.log('');

const ws = new WebSocket(wsUrl);

ws.on('open', function open() {
  console.log('🎉 CONNEXION WEBSOCKET ÉTABLIE AVEC SUCCÈS !');
  console.log('✅ Les corrections ont fonctionné parfaitement !');
  console.log('🔧 Endpoint HTTPS corrigé : OK');
  console.log('🔑 Token JWT valide : OK');
  console.log('');
  
  // Test ping après 1 seconde
  setTimeout(() => {
    console.log('🏓 Test PING...');
    ws.send(JSON.stringify({
      type: 'ping',
      timestamp: new Date().toISOString()
    }));
  }, 1000);
  
  // Test subscription après 3 secondes
  setTimeout(() => {
    console.log('📡 Test SUBSCRIPTION...');
    ws.send(JSON.stringify({
      type: 'subscribe',
      data: {
        topics: ['partners', 'notifications', 'vendor_updates']
      }
    }));
  }, 3000);
});

ws.on('message', function message(data) {
  try {
    const parsed = JSON.parse(data);
    console.log('📨 MESSAGE REÇU:');
    console.log(JSON.stringify(parsed, null, 2));
    
    if (parsed.type === 'connection_success') {
      console.log('✅ Message de bienvenue reçu - CORRECTION RÉUSSIE !');
    }
    if (parsed.type === 'pong') {
      console.log('🏓 PONG reçu - Communication bidirectionnelle OK !');
    }
  } catch (e) {
    console.log('📨 Message brut:', data.toString());
  }
});

ws.on('error', function error(err) {
  console.error('❌ ERREUR WebSocket:', err.message);
  if (err.message.includes('401')) {
    console.error('🔑 Token JWT invalide ou expiré');
  }
  if (err.message.includes('410')) {
    console.error('💀 Erreur 410 - Les corrections n\'ont pas fonctionné');
  }
});

ws.on('close', function close(code, reason) {
  console.log('🔒 Connexion fermée:', { 
    code, 
    reason: reason.toString(),
    meaning: code === 1000 ? '✅ Normal (test réussi)' : 
             code === 1001 ? '⚠️ Going Away' : 
             code === 1006 ? '❌ Abnormal (erreur)' : 
             `❓ Code ${code}`
  });
  
  if (code === 1000) {
    console.log('🎉 TEST WEBSOCKET RÉUSSI - CORRECTIONS VALIDÉES !');
  }
});

// Fermer automatiquement après 20 secondes
setTimeout(() => {
  console.log('');
  console.log('⏱️ Test terminé - fermeture propre');
  ws.close(1000, 'Test completed');
  setTimeout(() => process.exit(0), 1000);
}, 20000);

#!/usr/bin/env node

/**
 * 🧪 SCRIPT DE TEST DES MUTATIONS WEBSOCKET
 * Teste l'intégration complète WebSocket + GraphQL + Notifications
 */

import WebSocket from 'ws';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const config = {
  // 🔥 ENDPOINTS - VOS VRAIS ENDPOINTS DE PRODUCTION
  wsUrl: process.env.WS_URL || 'wss://0p6v60p0l3.execute-api.eu-west-1.amazonaws.com/prod',
  graphqlUrl: process.env.GRAPHQL_URL || 'https://63g5x92epf.execute-api.eu-west-1.amazonaws.com/prod/graphql',
  
  // 🔑 TOKEN JWT - Votre token de connexion
  token: process.env.TEST_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MDIwMjEyYmI5YjAxOWY5ZDVmN2VjZCIsImVtYWlsIjoiYW5pc21lcmFidGVuZTA2QGdtYWlsLmNvbSIsInJvbGUiOiJjbGllbnQiLCJpYXQiOjE3NjE4Mzc0NDQsImV4cCI6MTc2MjQ0MjI0NH0.wHPBQSDJ0x--ZV5uQPkRFowRkL5D3mFmrft3eHHNAEk',
  
  // 🎯 TEST PARTNER DATA
  testPartner: {
    name: 'Test Restaurant WebSocket',
    category: 'Restaurant',
    address: '123 Rue de Test',
    city: 'Paris',
    zipCode: '75001',
    phone: '01.23.45.67.89',
    discount: 15,
    description: 'Restaurant de test pour WebSocket',
    website: 'https://test-restaurant.com',
    latitude: 48.8566,
    longitude: 2.3522
  }
};

console.log('🚀 DÉMARRAGE DU TEST WEBSOCKET + MUTATIONS');
console.log('==========================================');
console.log(`WebSocket URL: ${config.wsUrl}`);
console.log(`GraphQL URL: ${config.graphqlUrl}`);
console.log('');

let ws;
let createdPartnerId = null;
let notifications = [];

// 📡 ÉTAPE 1: Connexion WebSocket
function connectWebSocket() {
  return new Promise((resolve, reject) => {
    console.log('📡 1. CONNEXION WEBSOCKET...');
    
    const wsUrlWithToken = `${config.wsUrl}?token=${config.token}`;
    ws = new WebSocket(wsUrlWithToken);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connecté');
      
      // S'abonner aux notifications de partenaires
      const subscriptionMessage = {
        type: 'subscribe',
        data: {
          topics: ['partners', 'partner_updates', 'cache_invalidation']
        }
      };
      
      ws.send(JSON.stringify(subscriptionMessage));
      console.log('🎯 Abonnement aux topics: partners, partner_updates, cache_invalidation');
      
      resolve();
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        notifications.push({
          ...message,
          receivedAt: new Date().toISOString()
        });
        
        console.log('📨 NOTIFICATION REÇUE:', {
          type: message.type,
          action: message.action,
          timestamp: message.timestamp,
          receivedAt: notifications[notifications.length - 1].receivedAt
        });
        
        if (message.data) {
          console.log('📊 Données:', JSON.stringify(message.data, null, 2));
        }
        
      } catch (error) {
        console.error('❌ Erreur parsing notification:', error);
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ Erreur WebSocket:', error);
      reject(error);
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket fermé');
    });
    
    setTimeout(() => {
      reject(new Error('Timeout connexion WebSocket'));
    }, 10000);
  });
}

// 🚀 ÉTAPE 2: Test création de partenaire
async function testCreatePartner() {
  console.log('\n🚀 2. TEST CRÉATION PARTENAIRE...');
  
  const mutation = `
    mutation CreatePartner($input: PartnerInput!) {
      createPartner(input: $input) {
        success
        message
        partner {
          id
          name
          category
          city
          discount
          createdAt
        }
      }
    }
  `;
  
  try {
    const response = await axios.post(
      config.graphqlUrl,
      {
        query: mutation,
        variables: {
          input: config.testPartner
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.errors) {
      throw new Error(`GraphQL Errors: ${JSON.stringify(response.data.errors)}`);
    }
    
    const result = response.data.data.createPartner;
    createdPartnerId = result.partner.id;
    
    console.log('✅ Partenaire créé:', {
      id: result.partner.id,
      name: result.partner.name,
      success: result.success
    });
    
    console.log('⏳ Attente des notifications WebSocket...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return result;
    
  } catch (error) {
    console.error('❌ Erreur création partenaire:', error.response?.data || error.message);
    throw error;
  }
}

// 🔄 ÉTAPE 3: Test mise à jour de partenaire
async function testUpdatePartner() {
  if (!createdPartnerId) {
    throw new Error('Aucun partenaire créé pour la mise à jour');
  }
  
  console.log('\n🔄 3. TEST MISE À JOUR PARTENAIRE...');
  
  const mutation = `
    mutation UpdatePartner($id: ID!, $input: PartnerUpdateInput!) {
      updatePartner(id: $id, input: $input) {
        success
        message
        partner {
          id
          name
          discount
          updatedAt
        }
      }
    }
  `;
  
  try {
    const response = await axios.post(
      config.graphqlUrl,
      {
        query: mutation,
        variables: {
          id: createdPartnerId,
          input: {
            discount: 25,
            description: 'Restaurant de test MODIFIÉ pour WebSocket'
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.errors) {
      throw new Error(`GraphQL Errors: ${JSON.stringify(response.data.errors)}`);
    }
    
    const result = response.data.data.updatePartner;
    
    console.log('✅ Partenaire mis à jour:', {
      id: result.partner.id,
      newDiscount: result.partner.discount,
      success: result.success
    });
    
    console.log('⏳ Attente des notifications WebSocket...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return result;
    
  } catch (error) {
    console.error('❌ Erreur mise à jour partenaire:', error.response?.data || error.message);
    throw error;
  }
}

// 🗑️ ÉTAPE 4: Test suppression de partenaire
async function testDeletePartner() {
  if (!createdPartnerId) {
    throw new Error('Aucun partenaire créé pour la suppression');
  }
  
  console.log('\n🗑️ 4. TEST SUPPRESSION PARTENAIRE...');
  
  const mutation = `
    mutation DeletePartner($id: ID!) {
      deletePartner(id: $id) {
        success
        message
      }
    }
  `;
  
  try {
    const response = await axios.post(
      config.graphqlUrl,
      {
        query: mutation,
        variables: {
          id: createdPartnerId
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.errors) {
      throw new Error(`GraphQL Errors: ${JSON.stringify(response.data.errors)}`);
    }
    
    const result = response.data.data.deletePartner;
    
    console.log('✅ Partenaire supprimé:', {
      success: result.success,
      message: result.message
    });
    
    console.log('⏳ Attente des notifications WebSocket...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return result;
    
  } catch (error) {
    console.error('❌ Erreur suppression partenaire:', error.response?.data || error.message);
    throw error;
  }
}

// 📊 ÉTAPE 5: Analyse des résultats
function analyzeResults() {
  console.log('\n📊 5. ANALYSE DES RÉSULTATS');
  console.log('============================');
  
  console.log(`📨 Total notifications reçues: ${notifications.length}`);
  
  if (notifications.length === 0) {
    console.log('❌ ÉCHEC: Aucune notification WebSocket reçue');
    console.log('🔍 Vérifications à faire:');
    console.log('   - Le service WebSocket est-il bien intégré dans les handlers?');
    console.log('   - Les variables d\'environnement WEBSOCKET_* sont-elles définies?');
    console.log('   - Les permissions IAM pour execute-api:ManageConnections?');
    return false;
  }
  
  // Vérifier les types de notifications attendus
  const notificationTypes = notifications.map(n => n.type);
  const expectedTypes = ['partner_updated', 'cache_invalidated'];
  
  console.log('🎯 Types de notifications reçues:', [...new Set(notificationTypes)]);
  
  // Vérifier les actions
  const actions = notifications
    .filter(n => n.action)
    .map(n => n.action);
  
  console.log('🎬 Actions détectées:', [...new Set(actions)]);
  
  // Détails de chaque notification
  notifications.forEach((notification, index) => {
    console.log(`\n📨 Notification ${index + 1}:`);
    console.log(`   Type: ${notification.type}`);
    console.log(`   Action: ${notification.action || 'N/A'}`);
    console.log(`   Timestamp: ${notification.timestamp}`);
    console.log(`   Reçue à: ${notification.receivedAt}`);
    
    if (notification.data) {
      console.log(`   Données:`, JSON.stringify(notification.data, null, 6));
    }
  });
  
  // Succès si on a reçu au moins une notification de partner_updated
  const hasPartnerNotifications = notifications.some(n => 
    n.type === 'partner_updated' || 
    n.type === 'partner_location_updated'
  );
  
  if (hasPartnerNotifications) {
    console.log('\n✅ SUCCÈS: Notifications de partenaires reçues');
    console.log('🎉 L\'intégration WebSocket fonctionne correctement!');
    return true;
  } else {
    console.log('\n⚠️ PARTIEL: Notifications reçues mais pas de partner_updated');
    console.log('🔍 Vérifier si les handlers appellent bien websocketService.notifyPartnerChange()');
    return false;
  }
}

// 🎯 FONCTION PRINCIPALE
async function runTest() {
  try {
    console.log('⏰ Début du test:', new Date().toISOString());
    
    // 1. Connexion WebSocket
    await connectWebSocket();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre la connexion
    
    // 2. Test création
    await testCreatePartner();
    
    // 3. Test mise à jour
    await testUpdatePartner();
    
    // 4. Test suppression
    await testDeletePartner();
    
    // 5. Analyse
    const success = analyzeResults();
    
    console.log('\n🏁 FIN DU TEST');
    console.log('==============');
    console.log(`⏰ Durée: ${new Date().toISOString()}`);
    console.log(`📊 Résultat: ${success ? '✅ SUCCÈS' : '❌ ÉCHEC'}`);
    
    // Fermer la connexion
    if (ws) {
      ws.close();
    }
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 ERREUR CRITIQUE:', error.message);
    
    if (ws) {
      ws.close();
    }
    
    process.exit(1);
  }
}

// Lancer le test
runTest();

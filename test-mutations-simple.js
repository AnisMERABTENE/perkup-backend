#!/usr/bin/env node

/**
 * 🧪 TEST RAPIDE DES MUTATIONS GRAPHQL
 * Vérifie si les nouvelles mutations fonctionnent
 */

import axios from 'axios';

const config = {
  graphqlUrl: 'https://63g5x92epf.execute-api.eu-west-1.amazonaws.com/prod/graphql',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MDIwMjEyYmI5YjAxOWY5ZDVmN2VjZCIsImVtYWlsIjoiYW5pc21lcmFidGVuZTA2QGdtYWlsLmNvbSIsInJvbGUiOiJjbGllbnQiLCJpYXQiOjE3NjE4Mzc0NDQsImV4cCI6MTc2MjQ0MjI0NH0.wHPBQSDJ0x--ZV5uQPkRFowRkL5D3mFmrft3eHHNAEk'
};

console.log('🧪 TEST RAPIDE DES MUTATIONS GRAPHQL');
console.log('====================================');

// Test simple de création de partenaire
const testMutation = `
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
      }
    }
  }
`;

const testData = {
  name: 'Test Restaurant ' + Date.now(),
  category: 'Restaurant',
  address: '123 Rue de Test',
  city: 'Paris',
  zipCode: '75001',
  phone: '01.23.45.67.89',
  discount: 15,
  description: 'Restaurant de test WebSocket',
  latitude: 48.8566,
  longitude: 2.3522
};

async function testMutations() {
  try {
    console.log('🚀 Test création partenaire...');
    console.log('Données:', JSON.stringify(testData, null, 2));
    
    const response = await axios.post(
      config.graphqlUrl,
      {
        query: testMutation,
        variables: {
          input: testData
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('\n📊 RÉPONSE GraphQL:');
    console.log('===================');
    
    if (response.data.errors) {
      console.log('❌ ERREURS GraphQL:', JSON.stringify(response.data.errors, null, 2));
      return false;
    }
    
    if (response.data.data && response.data.data.createPartner) {
      const result = response.data.data.createPartner;
      console.log('✅ SUCCÈS!');
      console.log('- Success:', result.success);
      console.log('- Message:', result.message);
      
      if (result.partner) {
        console.log('- Partenaire créé:');
        console.log('  * ID:', result.partner.id);
        console.log('  * Nom:', result.partner.name);
        console.log('  * Catégorie:', result.partner.category);
        console.log('  * Ville:', result.partner.city);
        console.log('  * Réduction:', result.partner.discount + '%');
      }
      
      console.log('\n🎉 Les mutations GraphQL fonctionnent!');
      console.log('✅ L\'intégration WebSocket devrait maintenant envoyer des notifications');
      
      return true;
    } else {
      console.log('❌ Réponse inattendue:', JSON.stringify(response.data, null, 2));
      return false;
    }
    
  } catch (error) {
    console.log('\n💥 ERREUR:');
    console.log('==========');
    
    if (error.response) {
      console.log('❌ Statut HTTP:', error.response.status);
      console.log('❌ Données:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 403) {
        console.log('\n🔍 PROBLÈME: Permissions insuffisantes');
        console.log('- Votre rôle actuel: "client"');
        console.log('- Rôles requis: "admin" ou "vendor"');
        console.log('- Solution: Tester avec un compte admin/vendor');
      }
    } else {
      console.log('❌ Erreur:', error.message);
    }
    
    return false;
  }
}

// Lancer le test
testMutations().then(success => {
  if (success) {
    console.log('\n🚀 PROCHAINE ÉTAPE: Tester les WebSocket');
    console.log('Commande: node test-websocket-mutations.js');
  } else {
    console.log('\n🔧 Vérifier les permissions ou la configuration');
  }
  
  process.exit(success ? 0 : 1);
});

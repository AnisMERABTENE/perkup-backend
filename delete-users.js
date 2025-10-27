import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

// URL de connexion MongoDB depuis votre .env
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://perkup:anisANIS14@mobile-app-cluster.5408gld.mongodb.net/?retryWrites=true&w=majority&appName=mobile-app-cluster';

async function deleteAllUsers() {
  let client;
  
  try {
    console.log('🔗 Connexion à MongoDB...');
    client = new MongoClient(MONGO_URI);
    await client.connect();
    
    const db = client.db(); // Utilise la DB par défaut
    const usersCollection = db.collection('users');
    
    // Compter les utilisateurs avant suppression
    const userCount = await usersCollection.countDocuments();
    console.log(`📊 ${userCount} utilisateurs trouvés`);
    
    if (userCount === 0) {
      console.log('✅ Aucun utilisateur à supprimer');
      return;
    }
    
    // Afficher quelques utilisateurs pour confirmation
    const sampleUsers = await usersCollection.find({}, { 
      projection: { email: 1, firstName: 1, lastName: 1, createdAt: 1 } 
    }).limit(5).toArray();
    
    console.log('👥 Exemples d\'utilisateurs qui seront supprimés:');
    sampleUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} - ${user.firstName} ${user.lastName}`);
    });
    
    // Demander confirmation (comment cette ligne pour exécution automatique)
    // console.log('\n⚠️  ATTENTION: Cette action est irréversible!');
    // console.log('Appuyez sur Ctrl+C pour annuler ou attendez 5 secondes...');
    // await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Supprimer TOUS les utilisateurs
    console.log('\n🗑️  Suppression en cours...');
    const deleteResult = await usersCollection.deleteMany({});
    
    console.log(`✅ ${deleteResult.deletedCount} utilisateurs supprimés avec succès`);
    
    // Vérification finale
    const remainingUsers = await usersCollection.countDocuments();
    console.log(`📊 Utilisateurs restants: ${remainingUsers}`);
    
    // Supprimer aussi les données liées (optionnel)
    console.log('\n🧹 Nettoyage des données liées...');
    
    // Supprimer les abonnements
    const subscriptionsCollection = db.collection('subscriptions');
    const deletedSubs = await subscriptionsCollection.deleteMany({});
    console.log(`🗑️  ${deletedSubs.deletedCount} abonnements supprimés`);
    
    // Supprimer les cartes digitales
    const cardsCollection = db.collection('digitalcards');
    const deletedCards = await cardsCollection.deleteMany({});
    console.log(`🗑️  ${deletedCards.deletedCount} cartes digitales supprimées`);
    
    console.log('\n🎉 Nettoyage complet terminé!');
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔐 Connexion MongoDB fermée');
    }
  }
}

// Exécuter le script
deleteAllUsers().catch(console.error);
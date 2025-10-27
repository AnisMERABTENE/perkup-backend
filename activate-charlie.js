import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function activateCharlieSubscription() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connexion MongoDB établie');
    
    const result = await mongoose.connection.db.collection('users').updateOne(
      { email: "charlie@client.com" },
      { $set: { "subscription.status": "active" } }
    );
    
    console.log('Résultat mise à jour:', result);
    
    if (result.modifiedCount > 0) {
      console.log('✅ Abonnement de Charlie activé !');
    } else {
      console.log('❌ Aucune modification effectuée');
    }
    
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    mongoose.disconnect();
  }
}

activateCharlieSubscription();

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Partner from './src/models/Partner.js';

// Charger les variables d'environnement
dotenv.config();

const deleteNullDiscountStores = async () => {
  try {
    console.log('🔧 Connexion à MongoDB...');
    
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/perkup');
    console.log('✅ Connecté à MongoDB');
    
    // 1. Trouver tous les partenaires avec discount null
    console.log('\n🔍 Recherche des partenaires avec discount null...');
    const partnersWithNullDiscount = await Partner.find({ 
      $or: [
        { discount: null },
        { discount: { $exists: false } }
      ]
    });
    
    console.log(`📊 Trouvé ${partnersWithNullDiscount.length} partenaire(s) avec discount null:`);
    
    if (partnersWithNullDiscount.length === 0) {
      console.log('✨ Aucun partenaire avec discount null. Tout est OK!');
      await mongoose.connection.close();
      return;
    }
    
    // 2. Lister les partenaires problématiques
    console.log('\n📋 Partenaires à SUPPRIMER:');
    console.log('━'.repeat(50));
    
    partnersWithNullDiscount.forEach((partner, index) => {
      console.log(`\n${index + 1}. ${partner.name}`);
      console.log(`   ID: ${partner._id}`);
      console.log(`   Catégorie: ${partner.category}`);
      console.log(`   Ville: ${partner.city}`);
    });
    
    console.log('\n' + '━'.repeat(50));
    
    // 3. Demander confirmation
    const forceDelete = process.argv.includes('--force');
    
    if (!forceDelete) {
      console.log('\n⚠️  ATTENTION: Ces boutiques vont être SUPPRIMÉES !');
      console.log('📌 Pour confirmer, relancez avec: node delete-null-discount-stores.js --force');
      await mongoose.connection.close();
      return;
    }
    
    // 4. SUPPRESSION
    console.log('\n🗑️  SUPPRESSION EN COURS...');
    
    for (const partner of partnersWithNullDiscount) {
      await Partner.findByIdAndDelete(partner._id);
      console.log(`✅ SUPPRIMÉ: ${partner.name}`);
    }
    
    console.log('\n✨ TERMINÉ ! Boutiques supprimées avec succès.');
    
    await mongoose.connection.close();
    console.log('✅ Connexion fermée.');
    
  } catch (error) {
    console.error('❌ ERREUR:', error);
    process.exit(1);
  }
};

// Exécuter
deleteNullDiscountStores()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('💥 Erreur:', err);
    process.exit(1);
  });
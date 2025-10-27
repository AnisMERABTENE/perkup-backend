import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Partner from './src/models/Partner.js';

// Charger les variables d'environnement
dotenv.config();

const checkPartnersDiscount = async () => {
  try {
    console.log('🔧 Connexion à MongoDB...');
    
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/perkup');
    console.log('✅ Connecté à MongoDB');
    
    // 1. Compter tous les partenaires
    const totalPartners = await Partner.countDocuments();
    console.log(`\n📊 Total partenaires dans la base: ${totalPartners}`);
    
    // 2. Vérifier les partenaires sans discount
    const partnersWithoutDiscount = await Partner.find({
      $or: [
        { discount: null },
        { discount: { $exists: false } }
      ]
    });
    
    console.log(`❌ Partenaires SANS discount: ${partnersWithoutDiscount.length}`);
    
    if (partnersWithoutDiscount.length > 0) {
      console.log('\nListe des partenaires sans discount:');
      partnersWithoutDiscount.forEach(p => {
        console.log(`  - ${p.name} (${p.category}) - Ville: ${p.city}`);
      });
    }
    
    // 3. Vérifier les partenaires avec discount = 0
    const partnersWithZeroDiscount = await Partner.find({ discount: 0 });
    console.log(`\n⚠️  Partenaires avec discount = 0: ${partnersWithZeroDiscount.length}`);
    
    if (partnersWithZeroDiscount.length > 0) {
      console.log('Liste des partenaires avec 0% de réduction:');
      partnersWithZeroDiscount.forEach(p => {
        console.log(`  - ${p.name} (${p.category}) - Ville: ${p.city}`);
      });
    }
    
    // 4. Afficher un échantillon de discounts valides
    const validPartners = await Partner.find({
      discount: { $gt: 0 }
    }).limit(5);
    
    console.log('\n✅ Échantillon de partenaires avec discount valide:');
    validPartners.forEach(p => {
      console.log(`  - ${p.name}: ${p.discount}% de réduction`);
    });
    
    // 5. Statistiques sur les discounts
    const stats = await Partner.aggregate([
      {
        $group: {
          _id: null,
          avgDiscount: { $avg: '$discount' },
          minDiscount: { $min: '$discount' },
          maxDiscount: { $max: '$discount' },
          countNull: {
            $sum: {
              $cond: [{ $eq: ['$discount', null] }, 1, 0]
            }
          }
        }
      }
    ]);
    
    if (stats.length > 0) {
      console.log('\n📈 Statistiques des discounts:');
      console.log(`  Moyenne: ${stats[0].avgDiscount?.toFixed(1)}%`);
      console.log(`  Minimum: ${stats[0].minDiscount}%`);
      console.log(`  Maximum: ${stats[0].maxDiscount}%`);
      console.log(`  Null count: ${stats[0].countNull}`);
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Connexion fermée.');
    
  } catch (error) {
    console.error('❌ ERREUR:', error);
    process.exit(1);
  }
};

// Exécuter
checkPartnersDiscount()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('💥 Erreur:', err);
    process.exit(1);
  });
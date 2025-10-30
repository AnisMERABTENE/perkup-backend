#!/usr/bin/env node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Partner from './src/models/Partner.js';

dotenv.config();

const fixNullDiscounts = async () => {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connecté à MongoDB');

    // Chercher les partenaires avec discount null ou undefined
    const partnersWithNullDiscount = await Partner.find({
      $or: [
        { discount: null },
        { discount: { $exists: false } }
      ]
    });

    console.log(`🔍 Trouvé ${partnersWithNullDiscount.length} partenaires avec discount null`);

    if (partnersWithNullDiscount.length === 0) {
      console.log('✅ Aucun partenaire à corriger');
      return;
    }

    // Afficher les partenaires problématiques
    partnersWithNullDiscount.forEach(partner => {
      console.log(`❌ ${partner.name} (${partner._id}) - discount: ${partner.discount}`);
    });

    // Demander confirmation
    console.log('\n🔧 Correction: Mettre discount = 10 pour tous ces partenaires');
    console.log('Voulez-vous continuer ? (y/N)');
    
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', async (key) => {
      if (key.toString() === 'y' || key.toString() === 'Y') {
        // Corriger les données
        const result = await Partner.updateMany(
          {
            $or: [
              { discount: null },
              { discount: { $exists: false } }
            ]
          },
          { $set: { discount: 10 } }
        );

        console.log(`\n✅ ${result.modifiedCount} partenaires corrigés avec discount = 10`);
        
        // Vérification
        const verification = await Partner.find({
          $or: [
            { discount: null },
            { discount: { $exists: false } }
          ]
        });
        
        console.log(`🔍 Vérification: ${verification.length} partenaires avec discount null restants`);
        
        process.exit(0);
      } else {
        console.log('\n❌ Annulé');
        process.exit(0);
      }
    });
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
};

// Lancer le script
fixNullDiscounts();

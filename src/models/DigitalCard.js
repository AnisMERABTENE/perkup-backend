import mongoose from "mongoose";

const digitalCardSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true, 
    unique: true 
  },
  currentToken: { 
    type: String, 
    required: true 
  }, // Token TOTP actuel
  previousToken: { 
    type: String 
  }, // Token précédent (pour éviter la réutilisation)
  lastRotation: { 
    type: Date, 
    default: Date.now 
  }, // Dernière rotation du token
  isActive: { 
    type: Boolean, 
    default: true 
  }, // Carte active ou non
  cardNumber: { 
    type: String, 
    unique: true,
    required: true
  }, // Numéro de carte unique pour l'affichage
  qrCodeData: { 
    type: String 
  }, // Données complètes pour le QR code
  secret: { 
    type: String, 
    required: true 
  }, // Secret TOTP pour l'utilisateur
  tokenHistory: [{
    token: String,
    createdAt: { type: Date, default: Date.now },
    usedAt: Date,
    isUsed: { type: Boolean, default: false }
  }], // Historique des tokens (limite aux 10 derniers)
  metadata: {
    type: Object,
    default: {}
  } // Informations supplémentaires
}, { timestamps: true });

// Index pour optimiser les recherches
digitalCardSchema.index({ user: 1 });
digitalCardSchema.index({ currentToken: 1 });
digitalCardSchema.index({ previousToken: 1 });
digitalCardSchema.index({ cardNumber: 1 });
digitalCardSchema.index({ isActive: 1 });

export default mongoose.model("DigitalCard", digitalCardSchema);

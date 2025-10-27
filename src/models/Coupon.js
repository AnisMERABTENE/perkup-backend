import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
  code: { 
    type: String, 
    required: true, 
    unique: true 
  },
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  partner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Partner", 
    required: false 
  }, // Optionnel pour les cartes digitales
  discountApplied: { 
    type: Number, 
    required: true 
  }, // réduction effectivement appliquée (en %)
  originalAmount: { 
    type: Number 
  }, // montant original en euros
  discountAmount: { 
    type: Number 
  }, // montant de la réduction en euros
  finalAmount: { 
    type: Number 
  }, // montant final en euros
  status: { 
    type: String, 
    enum: ["generated", "used", "expired"], 
    default: "generated" 
  },
  usedAt: { 
    type: Date 
  },
  expiresAt: { 
    type: Date 
  }, // expiration du coupon (optionnel)
  qrCode: { 
    type: String 
  }, // données pour générer le QR code
  metadata: { 
    type: Object, 
    default: {} 
  }, // informations supplémentaires
  digitalCardValidation: {
    type: Boolean,
    default: false
  }, // Indique si créé via carte digitale
  validatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  } // Vendeur qui a validé
}, { timestamps: true });

// Index pour optimiser les recherches
couponSchema.index({ user: 1 });
couponSchema.index({ partner: 1 });
couponSchema.index({ code: 1 });
couponSchema.index({ status: 1 });
couponSchema.index({ createdAt: -1 });
couponSchema.index({ digitalCardValidation: 1 });
couponSchema.index({ validatedBy: 1 });

export default mongoose.model("Coupon", couponSchema);

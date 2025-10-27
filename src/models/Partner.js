import mongoose from 'mongoose';

const partnerSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  category: { 
    type: String, 
    required: true,
    enum: [
      'restaurant', 'boulangerie', 'bar', 'fleuriste', 'kebab', 
      'jeux', 'cinema', 'pharmacie', 'vetements', 'beaute', 
      'sport', 'tabac', 'technologie', 'maison', 'sante', 
      'automobile', 'loisirs', 'services'
    ]
  },
  address: { 
    type: String, 
    required: true,
    trim: true
  },
  city: { 
    type: String, 
    required: true,
    trim: true
  },
  zipCode: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{5}$/.test(v);
      },
      message: 'Le code postal doit contenir exactement 5 chiffres'
    }
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: function(v) {
          return v.length === 2 && 
                 v[0] >= -180 && v[0] <= 180 && 
                 v[1] >= -90 && v[1] <= 90;
        },
        message: 'Coordonnées invalides'
      }
    }
  },
  logo: { 
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Le logo doit être une URL valide'
    }
  },
  discount: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 100
  },
  description: { 
    type: String,
    maxlength: 500
  },
  phone: { 
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^[\d\s\+\-\(\)\.]{8,20}$/.test(v);
      },
      message: 'Numéro de téléphone invalide'
    }
  },
  website: { 
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Le site web doit être une URL valide'
    }
  },
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    required: true
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String
  }
}, { 
  timestamps: true 
});

// Index optimisés pour les recherches
partnerSchema.index({ category: 1, isActive: 1 });
partnerSchema.index({ city: 1, isActive: 1 });
partnerSchema.index({ owner: 1 });
partnerSchema.index({ location: '2dsphere' });
partnerSchema.index({ name: 'text', description: 'text' });

// Middleware pour nettoyer les coordonnées
partnerSchema.pre('save', function(next) {
  if (this.location && this.location.coordinates) {
    this.location.coordinates[0] = parseFloat(this.location.coordinates[0]);
    this.location.coordinates[1] = parseFloat(this.location.coordinates[1]);
  }
  next();
});

export default mongoose.model("Partner", partnerSchema);

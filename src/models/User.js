import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  firstname: String,
  lastname: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ["client", "vendor", "admin"], default: "client" },
  isVerified: { type: Boolean, default: false },
  verificationCode: String,
  subscription: {
    plan: { type: String, enum: ["basic", "super", "premium"], default: null },
    status: { type: String, enum: ["active", "inactive", "canceled", "past_due"], default: "inactive" },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    stripePaymentIntentId: String,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    endDate: Date, // Pour compatibilité ancien système
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }
}, {
  timestamps: true
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;

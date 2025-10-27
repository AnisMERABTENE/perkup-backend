import bcrypt from "bcryptjs";
import User from "../../models/User.js";
import { connectDB } from "../../services/db.js";
import { sendVerificationEmail } from "../../services/emailService.js";

export const handler = async (event) => {
  try {
    const { firstname, lastname, email, password, confirmPassword } = event.arguments.input;

    if (!firstname || !lastname || !email || !password || !confirmPassword) {
      throw new Error("Tous les champs sont obligatoires");
    }

    if (password !== confirmPassword) {
      throw new Error("Les mots de passe ne correspondent pas");
    }

    await connectDB();

    const existingUser = await User.findOne({ email });
    if (existingUser) throw new Error("Cet email est déjà utilisé");

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const user = new User({
      firstname,
      lastname,
      email,
      password: hashedPassword,
      verificationCode,
      role: "vendor",
      isVerified: true, // ✅ Vendeurs vérifiés automatiquement
    });

    await user.save();
    // Pas d'envoi d'email pour les vendeurs

    return { message: "Compte vendeur créé avec succès ! Vous pouvez maintenant créer votre boutique." };
  } catch (err) {
    console.error("❌ Erreur registerVendor:", err);
    throw new Error(err.message || "Erreur serveur");
  }
};

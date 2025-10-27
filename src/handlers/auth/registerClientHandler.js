import bcrypt from "bcryptjs";
import User from "../../models/User.js";
import { connectDB } from "../../services/db.js";
import { sendVerificationEmail } from "../../services/emailService.js";

export const handler = async (event) => {
  try {
    // ✅ Récupérer les variables du resolver GraphQL
    const { firstname, lastname, email, password, confirmPassword } = event.arguments.input;

    // Vérification des champs
    if (!firstname || !lastname || !email || !password || !confirmPassword) {
      throw new Error("Tous les champs sont obligatoires");
    }

    if (password !== confirmPassword) {
      throw new Error("Les mots de passe ne correspondent pas");
    }

    await connectDB();

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error("Cet email est déjà utilisé");
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Générer un code de vérification
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Créer l'utilisateur
    const user = new User({
      firstname,
      lastname,
      email,
      password: hashedPassword,
      verificationCode,
      role: "client",
    });

    await user.save();

    // Envoyer l'email
    await sendVerificationEmail(email, verificationCode);

    console.log("✅ Utilisateur CLIENT créé:", { email, id: user._id });

    // Retour au format GraphQL
    return {
      message: "Compte client créé. Vérifiez votre email pour entrer le code.",
    };
  } catch (err) {
    console.error("❌ Erreur registerClient:", err);
    throw new Error(err.message || "Erreur serveur");
  }
};

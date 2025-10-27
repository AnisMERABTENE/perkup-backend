import User from "../../models/User.js";
import { connectDB } from "../../services/db.js";

export const handler = async (event) => {
  try {
    const { email, code } = event.arguments.input;

    await connectDB();

    const user = await User.findOne({ email });
    if (!user) throw new Error("Utilisateur introuvable");

    if (user.verificationCode !== code) {
      throw new Error("Code de vérification invalide");
    }

    user.isVerified = true;
    user.verificationCode = null;
    await user.save();

    return { message: "Email vérifié avec succès 🎉" };
  } catch (err) {
    console.error("❌ Erreur verifyEmail:", err);
    throw new Error(err.message || "Erreur serveur");
  }
};

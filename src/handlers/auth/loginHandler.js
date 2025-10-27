import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../../models/User.js";
import Partner from "../../models/Partner.js";
import { connectDB } from "../../services/db.js";
import dotenv from "dotenv";

dotenv.config();

export const handler = async (event) => {
  try {
    const { email, password } = event.arguments.input;

    if (!email || !password) throw new Error("Email et mot de passe requis");

    await connectDB();

    const user = await User.findOne({ email });
    if (!user) throw new Error("Utilisateur introuvable");
    if (!user.isVerified) throw new Error("Veuillez vérifier votre email avant de vous connecter");

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new Error("Mot de passe incorrect");

    let needsSetup = false;
    if (user.role === "vendor") {
      const storeCount = await Partner.countDocuments({ owner: user._id });
      needsSetup = storeCount === 0;
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return {
      message: "Connexion réussie 🎉",
      token,
      user: {
        id: user._id.toString(),
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
      },
      needsSetup,
      redirectTo: needsSetup ? "setup" : "dashboard",
    };
  } catch (err) {
    console.error("❌ Erreur login:", err);
    throw new Error(err.message || "Erreur serveur");
  }
};

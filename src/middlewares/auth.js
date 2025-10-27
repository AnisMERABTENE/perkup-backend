import jwt from 'jsonwebtoken';

/**
 * 🔐 VÉRIFICATION DU TOKEN JWT
 * Vérifie et décode un token JWT
 */
export const verifyToken = async (token) => {
  try {
    if (!token) {
      throw new Error('Token manquant');
    }

    // Retirer le préfixe "Bearer " si présent
    const cleanToken = token.replace('Bearer ', '');

    // Vérifier et décoder le token
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);

    return decoded;
  } catch (error) {
    console.error('❌ Erreur vérification token:', error.message);
    throw new Error('Token invalide ou expiré');
  }
};

/**
 * 🔐 MIDDLEWARE D'AUTHENTIFICATION POUR GRAPHQL
 * Extrait et vérifie le token depuis les headers
 */
export const authenticate = async (req) => {
  try {
    // Récupérer le token depuis les headers
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader) {
      return null;
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = await verifyToken(token);

    return decoded;
  } catch (error) {
    console.error('❌ Erreur authentification:', error.message);
    return null;
  }
};

export default {
  verifyToken,
  authenticate
};

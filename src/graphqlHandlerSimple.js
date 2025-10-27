import { ApolloServer } from '@apollo/server';
import { startServerAndCreateLambdaHandler } from '@as-integrations/aws-lambda';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Import des modèles
import User from './models/User.js';
import { connectDB } from './services/db.js';

dotenv.config();

// Schéma GraphQL minimal pour test
const typeDefs = `
  type Query {
    hello: String
    _empty: String
  }

  type Mutation {
    registerClient(input: RegisterInput!): MessageResponse!
    registerVendor(input: RegisterInput!): MessageResponse!
    verifyEmail(input: VerifyEmailInput!): MessageResponse!
    login(input: LoginInput!): LoginResponse!
  }

  # Inputs
  input RegisterInput {
    firstname: String!
    lastname: String!
    email: String!
    password: String!
    confirmPassword: String!
  }

  input VerifyEmailInput {
    email: String!
    code: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  # Types de réponse
  type MessageResponse {
    message: String!
  }

  type LoginResponse {
    message: String!
    token: String
    user: User!
    needsSetup: Boolean!
    redirectTo: String!
  }

  type User {
    id: ID!
    firstname: String!
    lastname: String!
    email: String!
    role: String!
    isVerified: Boolean
  }
`;

// Résolveurs simples
const resolvers = {
  Query: {
    hello: () => 'Hello from PerkUP GraphQL API!',
    _empty: () => null
  },
  Mutation: {
    registerClient: async (_, { input }) => {
      console.log('📝 Register client:', input.email);
      
      try {
        await connectDB();
        
        // Import dynamique pour éviter les erreurs de module
        const bcrypt = await import('bcryptjs');
        const { sendVerificationEmail } = await import('./services/emailService.js');
        
        const { firstname, lastname, email, password, confirmPassword } = input;

        // Validations
        if (!firstname || !lastname || !email || !password || !confirmPassword) {
          throw new Error("Tous les champs sont obligatoires");
        }

        if (password !== confirmPassword) {
          throw new Error("Les mots de passe ne correspondent pas");
        }

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

        return {
          message: "Compte client créé. Vérifiez votre email pour entrer le code.",
        };
      } catch (err) {
        console.error("❌ Erreur registerClient:", err);
        throw new Error(err.message || "Erreur serveur");
      }
    },

    registerVendor: async (_, { input }) => {
      // Même logique que registerClient mais avec role: "vendor"
      console.log('📝 Register vendor:', input.email);
      
      try {
        await connectDB();
        
        const bcrypt = await import('bcryptjs');
        const { sendVerificationEmail } = await import('./services/emailService.js');
        
        const { firstname, lastname, email, password, confirmPassword } = input;

        if (!firstname || !lastname || !email || !password || !confirmPassword) {
          throw new Error("Tous les champs sont obligatoires");
        }

        if (password !== confirmPassword) {
          throw new Error("Les mots de passe ne correspondent pas");
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
          throw new Error("Cet email est déjà utilisé");
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        const user = new User({
          firstname,
          lastname,
          email,
          password: hashedPassword,
          verificationCode,
          role: "vendor", // Différence ici
        });

        await user.save();
        await sendVerificationEmail(email, verificationCode);

        console.log("✅ Utilisateur VENDOR créé:", { email, id: user._id });

        return {
          message: "Compte vendeur créé. Vérifiez votre email pour entrer le code.",
        };
      } catch (err) {
        console.error("❌ Erreur registerVendor:", err);
        throw new Error(err.message || "Erreur serveur");
      }
    },

    verifyEmail: async (_, { input }) => {
      console.log('✅ Verify email:', input.email);
      
      try {
        await connectDB();
        
        const { email, code } = input;
        
        const user = await User.findOne({ email });
        if (!user) {
          throw new Error("Utilisateur introuvable");
        }

        if (user.isVerified) {
          throw new Error("Email déjà vérifié");
        }

        if (user.verificationCode !== code) {
          throw new Error("Code de vérification invalide");
        }

        // Marquer comme vérifié
        user.isVerified = true;
        user.verificationCode = undefined;
        await user.save();

        console.log("✅ Email vérifié:", email);

        return {
          message: "Email vérifié avec succès",
        };
      } catch (err) {
        console.error("❌ Erreur verifyEmail:", err);
        throw new Error(err.message || "Erreur serveur");
      }
    },

    login: async (_, { input }) => {
      console.log('🔑 Login:', input.email);
      
      try {
        await connectDB();
        
        const bcrypt = await import('bcryptjs');
        const jwt = await import('jsonwebtoken');
        
        const { email, password } = input;
        
        const user = await User.findOne({ email });
        if (!user) {
          throw new Error("Email ou mot de passe incorrect");
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          throw new Error("Email ou mot de passe incorrect");
        }

        if (!user.isVerified) {
          throw new Error("Veuillez vérifier votre email avant de vous connecter");
        }

        // Générer le token JWT
        const token = jwt.sign(
          { id: user._id, email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );

        console.log("✅ Login réussi:", email);

        return {
          message: "Connexion réussie",
          token,
          user: {
            id: user._id.toString(),
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            role: user.role,
            isVerified: user.isVerified
          },
          needsSetup: false,
          redirectTo: user.role === 'vendor' ? '/vendor/dashboard' : '/client/dashboard'
        };
      } catch (err) {
        console.error("❌ Erreur login:", err);
        throw new Error(err.message || "Erreur serveur");
      }
    }
  }
};

// Fonction d'authentification simple
const getUser = async (event) => {
  try {
    const authHeader = event.headers?.Authorization || 
                      event.headers?.authorization ||
                      event.headers?.['Authorization'] ||
                      event.headers?.['authorization'];
    
    if (!authHeader) return null;
    
    const token = authHeader.replace('Bearer ', '');
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userData = await User.findById(decoded.id);
    if (!userData) return null;
    
    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      userData: userData
    };
  } catch (error) {
    console.log('Erreur auth:', error.message);
    return null;
  }
};

// Serveur Apollo simplifié
const server = new ApolloServer({
  typeDefs,
  resolvers,
  formatError: (err) => {
    console.error('GraphQL Error:', err.message);
    return {
      message: err.message,
      path: err.path,
    };
  },
  introspection: true,
});

// Handler Lambda
export const handler = startServerAndCreateLambdaHandler(
  server,
  {
    context: async ({ event, context }) => {
      // Connexion DB automatique
      await connectDB();
      
      // Authentification optionnelle
      const user = await getUser(event);
      
      return {
        headers: event.headers,
        functionName: context.functionName,
        event,
        context,
        user
      };
    }
  }
);

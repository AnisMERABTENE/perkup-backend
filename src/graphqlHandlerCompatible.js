import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Import des modèles
import User from './models/User.js';
import { connectDB } from './services/db.js';

dotenv.config();

// Schéma GraphQL minimal
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

// Résolveurs
const resolvers = {
  Query: {
    hello: () => 'Hello from PerkUP GraphQL API! 🚀',
    _empty: () => null
  },
  Mutation: {
    registerClient: async (_, { input }) => {
      console.log('📝 Register client:', input.email);
      
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
          role: "client",
        });

        await user.save();
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
          role: "vendor",
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

// Fonction d'authentification
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

// Serveur Apollo compatible avec Lambda
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
  plugins: []
});

// Handler Lambda manuel compatible
export const handler = async (event, context) => {
  try {
    console.log('🚀 Lambda handler appelé');
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // Assurer la connexion DB
    await connectDB();
    
    // Démarrer Apollo Server si pas encore fait
    if (!server.startedApolloServer) {
      await server.start();
      server.startedApolloServer = true;
    }
    
    // Parser la requête
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body;
    }
    
    console.log('GraphQL Query:', body.query);
    console.log('GraphQL Variables:', body.variables);
    
    // Authentification
    const user = await getUser(event);
    
    // Contexte GraphQL
    const contextValue = {
      headers: event.headers,
      functionName: context.functionName,
      event,
      context,
      user
    };
    
    // Exécuter la requête GraphQL
    const result = await server.executeOperation(
      {
        query: body.query,
        variables: body.variables,
        operationName: body.operationName,
      },
      {
        contextValue
      }
    );
    
    console.log('GraphQL Result:', JSON.stringify(result, null, 2));
    
    // Retourner la réponse Lambda
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('❌ Handler Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        errors: [{
          message: error.message,
          extensions: { code: 'INTERNAL_ERROR' }
        }]
      })
    };
  }
};

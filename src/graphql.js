const { ApolloServer } = require('apollo-server-lambda');
const mongoose = require('mongoose');
require('dotenv').config();

// Import des schémas et résolveurs
const typeDefs = require('./schema/typeDefs');
const resolvers = require('./schema/resolvers');

// Middleware d'authentification
const { getUser } = require('./middlewares/authMiddleware');

let cachedDb = null;

// 🔗 Connexion MongoDB avec cache
const connectToDatabase = async () => {
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }

  try {
    const db = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    cachedDb = db;
    console.log('✅ Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
};

// 🏗️ Création du serveur Apollo
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ event, context }) => {
    // Assurer la connexion à la base de données
    await connectToDatabase();
    
    // Récupérer l'utilisateur depuis le token JWT
    const user = await getUser(event);
    
    return {
      headers: event.headers,
      functionName: context.functionName,
      event,
      context,
      user, // Utilisateur authentifié (ou null)
    };
  },
  formatError: (err) => {
    console.error('GraphQL Error:', err);
    return {
      message: err.message,
      code: err.extensions?.code,
      path: err.path,
    };
  },
  introspection: process.env.NODE_ENV !== 'production',
  playground: process.env.NODE_ENV !== 'production',
});

// 🎯 Handler Lambda principal
exports.handler = server.createHandler({
  cors: {
    origin: '*',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
});

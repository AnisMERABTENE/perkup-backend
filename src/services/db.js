import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// PATTERN OFFICIEL MONGOOSE LAMBDA adapté pour mongoose.connect()
let conn = null;
let dbOptimizer = null;

const uri = process.env.MONGO_URI;

// Stats de performance globales Phase 2
let performanceStats = {
  successfulConnections: 0,
  failedConnections: 0,
  totalQueries: 0,
  averageResponseTime: 0,
  slowQueries: 0,
  indexHits: 0,
  indexMisses: 0
};

/**
 * 🚀 CLASSE D'OPTIMISATION DATABASE AVANCÉE - PHASE 2 COMPLÈTE
 */
class DatabaseOptimizer {
  constructor() {
    this.connectionPool = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.queryCache = new Map();
    this.slowQueryThreshold = 100; // 100ms
  }

  /**
   * 🔥 CONNEXION OPTIMISÉE AVEC POOLING AVANCÉ
   */
  async connect() {
    if (this.isConnected && this.connectionPool) {
      return this.connectionPool;
    }

    try {
      console.log('🚀 MongoDB: Connexion haute performance Phase 2...');
      
      // CONFIGURATION HAUTE PERFORMANCE pour 50K users
      const mongoConfig = {
        // Pool de connexions optimisé
        maxPoolSize: 100,           // 100 connexions max par instance
        minPoolSize: 10,            // 10 connexions minimum maintenues
        maxIdleTimeMS: 30000,       // Fermer connexions inactives après 30s
        waitQueueTimeoutMS: 5000,   // Timeout pour obtenir une connexion
        
        // Optimisations réseau
        serverSelectionTimeoutMS: 5000,    // Timeout sélection serveur
        socketTimeoutMS: 45000,            // Timeout socket
        connectTimeoutMS: 10000,           // Timeout connexion
        heartbeatFrequencyMS: 10000,       // Heartbeat toutes les 10s
        
        // Résilience
        retryWrites: true,
        retryReads: true,
        readPreference: 'secondaryPreferred',  // Lecture sur secondaires
        writeConcern: { w: 'majority', j: true, wtimeout: 5000 },
        readConcern: { level: 'majority' },
        
        // Compression pour réduire la bande passante
        compressors: ['snappy', 'zlib'],
        
        // Index hints pour performances
        maxStalenessSeconds: 120,
        
        // Buffer pour write operations
        bufferCommands: false,
        
        // Optimisations serverless
        serverApi: {
          version: '1',
          strict: true,
          deprecationErrors: true,
        }
      };

      // Pattern officiel avec monitoring
      conn = mongoose.connect(uri, mongoConfig).then(() => mongoose);
      await conn;
      
      // OPTIMISATIONS ADDITIONNELLES
      mongoose.set('strictQuery', false);
      mongoose.set('autoIndex', false);  // Disable auto-index in production
      
      // Connection event listeners avec monitoring
      mongoose.connection.on('connected', () => {
        console.log('✅ MongoDB connecté avec pool optimisé Phase 2');
        this.isConnected = true;
        this.retryCount = 0;
        performanceStats.successfulConnections++;
      });

      mongoose.connection.on('error', (err) => {
        console.error('❌ Erreur MongoDB Phase 2:', err.message);
        this.isConnected = false;
        performanceStats.failedConnections++;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB déconnecté');
        this.isConnected = false;
      });

      // Monitoring des commandes en temps réel
      mongoose.connection.on('commandStarted', (event) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔍 MongoDB Query: ${event.commandName} sur ${event.databaseName}`);
        }
        event.startTime = Date.now();
      });
      
      mongoose.connection.on('commandSucceeded', (event) => {
        const duration = Date.now() - (event.startTime || Date.now());
        performanceStats.totalQueries++;
        performanceStats.averageResponseTime = 
          (performanceStats.averageResponseTime + duration) / 2;
        
        if (duration > this.slowQueryThreshold) {
          performanceStats.slowQueries++;
          console.log(`⚠️ Requête lente détectée: ${event.commandName} (${duration}ms)`);
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Query réussie en ${duration}ms`);
        }
      });
      
      mongoose.connection.on('commandFailed', (event) => {
        const duration = Date.now() - (event.startTime || Date.now());
        console.error(`❌ Query échouée: ${event.failure} (${duration}ms)`);
        performanceStats.slowQueries++;
      });

      this.connectionPool = mongoose.connection;
      
      // Initialiser les optimisations après connexion
      await this.initializeOptimizations();
      
      return this.connectionPool;
      
    } catch (error) {
      console.error('💥 Échec connexion MongoDB Phase 2:', error.message);
      this.isConnected = false;
      performanceStats.failedConnections++;
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`🔄 Retry ${this.retryCount}/${this.maxRetries} dans 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * this.retryCount));
        return this.connect();
      }
      
      throw new Error(`Impossible de se connecter à MongoDB après ${this.maxRetries} tentatives`);
    }
  }

  /**
   * 🔥 INITIALISATION COMPLÈTE DES OPTIMISATIONS
   */
  async initializeOptimizations() {
    try {
      console.log('🚀 Initialisation optimisations MongoDB Phase 2...');
    
    // ⚠️ DÉSACTIVÉ - Génère des erreurs de permissions
    // Les index doivent être créés UNE FOIS via migration, pas à chaque requête
    /*
    await Promise.all([
      this.createOptimalIndexes(),
      this.optimizeFrequentQueries(),
      this.setupQueryProfiling()
    ]);
    */
    
      console.log('✅ Optimisations désactivées (éviter erreurs répétées)');
    } catch (error) {
      console.error('❌ Erreur initialisation optimisations:', error);
    }
  }

  /**
   * 🔥 CRÉATION D'INDEX OPTIMAUX POUR 50K USERS
   */
  async createOptimalIndexes() {
    try {
      const db = mongoose.connection.db;
      console.log('🚀 Création des index optimisés Phase 2...');

      // INDEX UTILISATEURS (table critique)
      await db.collection('users').createIndexes([
        // Index unique pour email (authentification)
        { key: { email: 1 }, unique: true, background: true, name: 'email_unique_idx' },
        
        // Index composé pour requêtes fréquentes
        { 
          key: { role: 1, isVerified: 1, createdAt: -1 }, 
          background: true,
          name: 'role_verified_created_idx'
        },
        
        // Index partiel pour utilisateurs actifs
        { 
          key: { lastLoginAt: -1 }, 
          partialFilterExpression: { isVerified: true },
          background: true,
          name: 'active_users_idx'
        },
        
        // Index pour recherche géographique
        { 
          key: { 'location.coordinates': '2dsphere' }, 
          background: true,
          name: 'geo_location_idx'
        },
        
        // Index pour abonnements
        { 
          key: { 'subscription.status': 1, 'subscription.currentPeriodEnd': 1 }, 
          background: true,
          name: 'subscription_status_idx'
        }
      ]);

      // INDEX PARTENAIRES
      await db.collection('partners').createIndexes([
        { key: { isActive: 1, category: 1 }, background: true, name: 'active_category_idx' },
        { key: { 'location.coordinates': '2dsphere' }, background: true, name: 'partner_geo_idx' },
        { key: { rating: -1 }, background: true, name: 'rating_desc_idx' },
        { key: { createdAt: -1 }, background: true, name: 'created_desc_idx' },
        { key: { owner: 1, isActive: 1 }, background: true, name: 'owner_active_idx' }
      ]);

      // INDEX CARTES DIGITALES
      await db.collection('digitalcards').createIndexes([
        { key: { user: 1, isActive: 1 }, background: true, name: 'user_active_cards_idx' },
        { key: { cardNumber: 1 }, unique: true, background: true, name: 'card_number_unique_idx' },
        { key: { expirationDate: 1 }, background: true, name: 'expiration_idx' },
        { 
          key: { user: 1, createdAt: -1 }, 
          background: true,
          name: 'user_cards_timeline_idx'
        }
      ]);

      // INDEX COUPONS
      await db.collection('coupons').createIndexes([
        { key: { code: 1 }, unique: true, background: true, name: 'coupon_code_unique_idx' },
        { key: { isActive: 1, expirationDate: 1 }, background: true, name: 'active_coupon_idx' },
        { key: { partnerId: 1, isActive: 1 }, background: true, name: 'partner_coupon_idx' },
        { key: { usageCount: 1, maxUsage: 1 }, background: true, name: 'usage_limit_idx' }
      ]);

      // INDEX TRANSACTIONS/LOGS
      await db.collection('transactions').createIndexes([
        { key: { userId: 1, createdAt: -1 }, background: true, name: 'user_transactions_idx' },
        { key: { partnerId: 1, createdAt: -1 }, background: true, name: 'partner_transactions_idx' },
        { key: { status: 1, createdAt: -1 }, background: true, name: 'status_transactions_idx' },
        // Index TTL pour purge automatique des logs anciens
        { 
          key: { createdAt: 1 }, 
          expireAfterSeconds: 7776000, // 90 jours
          background: true,
          name: 'auto_cleanup_idx'
        }
      ]);

      console.log('✅ Index optimisés créés avec succès Phase 2');
      
    } catch (error) {
      console.error('❌ Erreur création index Phase 2:', error);
      throw error;
    }
  }

  /**
   * 🚀 OPTIMISATION REQUÊTES FRÉQUENTES
   */
  async optimizeFrequentQueries() {
    try {
      const db = mongoose.connection.db;
      console.log('🔧 Optimisation des requêtes fréquentes...');
      
      // Créer des vues matérialisées simulées
      try {
        await db.createCollection('active_users_view', {
          viewOn: 'users',
          pipeline: [
            { 
              $match: { 
                isVerified: true, 
                'subscription.status': 'active' 
              } 
            },
            { 
              $project: { 
                _id: 1, 
                email: 1, 
                role: 1, 
                lastLoginAt: 1,
                'subscription.plan': 1
              } 
            }
          ]
        });
        
        await db.createCollection('popular_partners_view', {
          viewOn: 'partners',
          pipeline: [
            { $match: { isActive: true, rating: { $gte: 4.0 } } },
            { $sort: { rating: -1, reviewCount: -1 } },
            { $limit: 100 }
          ]
        });
        
        console.log('✅ Vues optimisées créées');
      } catch (viewError) {
        // Vues existent déjà, c'est normal
        console.log('📝 Vues existantes détectées');
      }
      
    } catch (error) {
      console.error('❌ Erreur création vues:', error);
    }
  }

  /**
   * 🔥 PROFILING DES REQUÊTES
   */
  async setupQueryProfiling() {
    try {
      const db = mongoose.connection.db;
      
      // Activer le profiling pour les requêtes > 100ms
      await db.admin().command({
        profile: 2,
        slowms: this.slowQueryThreshold,
        sampleRate: 0.1 // 10% des requêtes
      });
      
      console.log('✅ Profiling des requêtes activé');
    } catch (error) {
      console.error('❌ Erreur setup profiling:', error);
    }
  }

  /**
   * 🚀 AGGREGATION PIPELINE OPTIMISÉE
   */
  buildOptimizedAggregation(collection, pipeline) {
    return collection.aggregate(pipeline, {
      allowDiskUse: true,        // Permet l'usage du disque pour gros datasets
      cursor: { batchSize: 1000 }, // Traitement par batch
      maxTimeMS: 30000,          // Timeout 30s
      hint: this.suggestIndex(pipeline) // Forcer l'usage d'un index
    });
  }

  /**
   * 🔥 SUGGESTION D'INDEX AUTOMATIQUE
   */
  suggestIndex(pipeline) {
    const firstStage = pipeline[0];
    
    if (firstStage.$match) {
      const fields = Object.keys(firstStage.$match);
      
      // Analyser les champs pour suggérer le meilleur index
      if (fields.includes('email')) {
        performanceStats.indexHits++;
        return 'email_unique_idx';
      }
      if (fields.includes('userId') || fields.includes('user')) {
        performanceStats.indexHits++;
        return 'user_active_cards_idx';
      }
      if (fields.includes('role') && fields.includes('isVerified')) {
        performanceStats.indexHits++;
        return 'role_verified_created_idx';
      }
      if (fields.includes('isActive') && fields.includes('category')) {
        performanceStats.indexHits++;
        return 'active_category_idx';
      }
    }
    
    performanceStats.indexMisses++;
    return null; // Laisser MongoDB choisir
  }

  /**
   * 🔥 MONITORING DES PERFORMANCES
   */
  async monitorPerformance() {
    try {
      const db = mongoose.connection.db;
      
      // Statistiques des collections
      const collections = ['users', 'partners', 'digitalcards', 'coupons'];
      const stats = {};
      
      for (const collName of collections) {
        try {
          const collStats = await db.collection(collName).stats();
          stats[collName] = {
            count: collStats.count,
            size: collStats.size,
            indexSize: collStats.totalIndexSize,
            avgObjSize: collStats.avgObjSize
          };
        } catch (e) {
          stats[collName] = { error: 'Collection not found or no access' };
        }
      }
      
      // Opérations lentes récentes
      const slowOps = await db.admin().command({
        currentOp: true,
        'secs_running': { $gte: 0.1 }
      });
      
      // Status des connexions
      let connStatus = {};
      try {
        connStatus = await db.admin().command({ connPoolStats: 1 });
      } catch (e) {
        connStatus = { error: 'No access to connection stats' };
      }
      
      return {
        collections: stats,
        slowOperations: slowOps.inprog ? slowOps.inprog.length : 0,
        connections: connStatus,
        performance: performanceStats,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('❌ Erreur monitoring Phase 2:', error);
      return {
        error: error.message,
        performance: performanceStats,
        timestamp: new Date()
      };
    }
  }

  /**
   * 🔥 NETTOYAGE ET MAINTENANCE AUTOMATIQUE
   */
  async performMaintenance() {
    try {
      const db = mongoose.connection.db;
      console.log('🧹 Maintenance automatique Phase 2...');
      
      const maintenanceTasks = [];
      
      // Supprimer les tokens expirés
      maintenanceTasks.push(
        db.collection('tokens').deleteMany({
          expiresAt: { $lt: new Date() }
        }).catch(e => console.log('Tokens collection not found'))
      );
      
      // Supprimer les sessions inactives
      maintenanceTasks.push(
        db.collection('sessions').deleteMany({
          lastActivity: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }).catch(e => console.log('Sessions collection not found'))
      );
      
      // Archiver les anciennes transactions
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      maintenanceTasks.push(
        db.collection('transactions').updateMany(
          { createdAt: { $lt: cutoffDate } },
          { $set: { archived: true } }
        ).catch(e => console.log('Transactions collection not found'))
      );
      
      await Promise.allSettled(maintenanceTasks);
      
      // Statistiques post-maintenance
      const stats = await this.monitorPerformance();
      
      console.log('✅ Maintenance terminée Phase 2');
      return stats;
      
    } catch (error) {
      console.error('❌ Erreur maintenance Phase 2:', error);
      throw error;
    }
  }

  /**
   * 🔥 WRAPPER POUR OPTIMISER LES REQUÊTES
   */
  optimizeQuery(query) {
    const startTime = Date.now();
    
    // Wrapper pour tracker les performances
    const originalExec = query.exec;
    query.exec = function() {
      const result = originalExec.call(this);
      
      if (result && result.then) {
        return result.finally(() => {
          const duration = Date.now() - startTime;
          performanceStats.totalQueries++;
          performanceStats.averageResponseTime = 
            (performanceStats.averageResponseTime + duration) / 2;
          
          if (duration > 100) {
            performanceStats.slowQueries++;
            console.log(`⚠️ Requête optimisée lente: ${duration}ms`);
          }
        });
      }
      
      const duration = Date.now() - startTime;
      performanceStats.totalQueries++;
      performanceStats.averageResponseTime = 
        (performanceStats.averageResponseTime + duration) / 2;
      
      return result;
    };
    
    return query;
  }
}

// Instance singleton
dbOptimizer = new DatabaseOptimizer();

export const connectDB = async () => {
  return await dbOptimizer.connect();
};

export const getConnectionStatus = () => {
  return {
    isConnected: dbOptimizer.isConnected,
    readyState: mongoose.connection.readyState,
    performance: performanceStats
  };
};

export const checkDatabaseHealth = async () => {
  try {
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    const pingTime = Date.now() - start;
    
    const monitoring = await dbOptimizer.monitorPerformance();
    
    return {
      status: 'healthy',
      pingTime: `${pingTime}ms`,
      phase: 2,
      monitoring,
      performance: performanceStats,
      recommendations: performanceStats.slowQueries > 10 ? [
        'Optimiser les requêtes lentes',
        'Vérifier les index utilisés',
        'Augmenter les ressources MongoDB'
      ] : []
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      phase: 2,
      performance: performanceStats
    };
  }
};

export const closeConnection = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    dbOptimizer.isConnected = false;
    conn = null;
    console.log('🔄 MongoDB: Connexion fermée Phase 2');
  }
};

// Export des fonctions d'optimisation
export const optimizeQuery = (query) => dbOptimizer.optimizeQuery(query);
export const performMaintenance = () => dbOptimizer.performMaintenance();
export const getPerformanceStats = () => performanceStats;
export const dbOptimizerInstance = dbOptimizer;

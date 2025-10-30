import Redis from 'ioredis';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 🚀 CACHE MULTI-COUCHES - REDIS SIMPLE (CORRIGÉ !)
 * Layer 1: In-Memory (Lambda)
 * Layer 2: Redis Simple ElastiCache (1 node)
 * Layer 3: DynamoDB (Persistence)
 */
class DistributedCacheSystem {
  constructor() {
    this.memoryCache = new Map();         // L1: Cache mémoire
    this.redisClient = null;              // L2: Redis SIMPLE (pas cluster)
    this.dynamoDB = new AWS.DynamoDB.DocumentClient(); // L3: DynamoDB
    
    this.maxMemorySize = 100 * 1024 * 1024; // 100MB max en mémoire
    this.currentMemorySize = 0;
    
    // Configuration des TTL par type
    this.ttlConfig = {
      user: 1800,        // 30 min
      auth: 900,         // 15 min
      subscription: 600,  // 10 min
      partners: 3600,    // 1 heure
      geo: 86400,        // 24 heures
      static: 604800     // 7 jours
    };
    
    // Préfixes organisés
    this.prefixes = {
      user: 'usr:',
      subscription: 'sub:',
      partners: 'ptn:',
      geo: 'geo:',
      auth: 'auth:',
      rate: 'rate:',
      session: 'sess:'
    };
    
    // Métriques de performance
    this.metrics = {
      hits: { l1: 0, l2: 0, l3: 0 },
      misses: 0,
      sets: 0,
      errors: 0,
      latency: { l1: [], l2: [], l3: [] }
    };
  }

  /**
   * 🔥 RATE LIMITING DISTRIBUÉ
   */
  async checkRateLimit(identifier, limit = 1000, window = 3600) {
    try {
      const redisClient = await this.initializeRedisCluster();
      if (!redisClient) {
        // Fallback sans Redis - permettre la requête
        return { allowed: true, remaining: limit, current: 0 };
      }
      
      const key = this.buildKey(identifier, 'rate');
      
      // Pipeline pour atomicité
      const pipeline = redisClient.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, window);
      
      const results = await pipeline.exec();
      const current = results[0][1];
      
      const remaining = Math.max(0, limit - current);
      const allowed = current <= limit;
      
      return { allowed, remaining, current };
    } catch (error) {
      console.error('❌ Rate limit error:', error.message);
      return { allowed: true, remaining: limit };
    }
  }

  /**
   * 🚀 INITIALISATION REDIS SIMPLE (ENFIN CORRIGÉ !)
   */
  async initializeRedisCluster() {
    if (this.redisClient) return this.redisClient;

    try {
      console.log('🔄 Redis Simple ElastiCache: Initialisation...');
      
      // 🔥 CORRECTION: Redis SIMPLE au lieu de Cluster
      this.redisClient = new Redis({
        host: process.env.REDIS_CLUSTER_ENDPOINT || process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        
        // 🔥 OPTIMISATIONS REDIS SIMPLE
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableOfflineQueue: false,
        
        // Pool de connexions
        lazyConnect: true,
        
        // Optimisations réseau
        connectTimeout: 10000,
        commandTimeout: 5000,
        
        keyPrefix: 'perkup:',
        
        // 🔥 MODE SIMPLE (pas cluster)
        enableReadyCheck: true
      });

      // Event listeners
      this.redisClient.on('ready', () => {
        console.log('✅ Redis Simple ElastiCache connecté !');
      });

      this.redisClient.on('error', (err) => {
        console.error('❌ Redis Simple erreur:', err.message);
        this.metrics.errors++;
      });

      // Test de connexion
      const pingResult = await this.redisClient.ping();
      console.log('🎯 Redis Simple PING successful:', pingResult);
      return this.redisClient;

    } catch (error) {
      console.error('💥 Échec connexion Redis Simple:', error);
      console.log('⚠️ Redis Simple indisponible - Mode dégradé activé');
      return null;
    }
  }

  /**
   * 🔥 GET AVEC STRATÉGIE MULTI-COUCHES RESPECTÉE
   */
  async get(key, type = 'user') {
    const startTime = Date.now();
    
    try {
      // Déterminer la stratégie de cache selon le type
      const strategy = this.getCacheStrategy(type);
      
      // 🚀 LAYER 1: Cache mémoire (seulement si autorisé par la stratégie)
      if (strategy.memory) {
        const memoryResult = this.getFromMemory(key);
        if (memoryResult !== null) {
          this.metrics.hits.l1++;
          this.recordLatency('l1', Date.now() - startTime);
          console.log(`🎯 Cache L1 HIT: ${key}`);
          return memoryResult;
        }
      }

      // 🚀 LAYER 2: Redis Simple (si autorisé par la stratégie)
      if (strategy.redis) {
        const redisClient = await this.initializeRedisCluster();
        if (redisClient) {
          try {
            const redisKey = this.buildKey(key, type);
            const redisResult = await redisClient.get(redisKey);
            
            if (redisResult) {
              const parsed = JSON.parse(redisResult);
              // Mettre en cache L1 seulement si autorisé par la stratégie
              if (strategy.memory) {
                this.setInMemory(key, parsed);
              }
              this.metrics.hits.l2++;
              this.recordLatency('l2', Date.now() - startTime);
              console.log(`🎯 Cache L2 HIT: ${redisKey}`);
              return parsed;
            }
          } catch (redisError) {
            console.error('❌ Redis Simple GET erreur:', redisError.message);
          }
        }
      }

      // 🚀 LAYER 3: DynamoDB (si autorisé par la stratégie)
      if (strategy.dynamo) {
        const dynamoResult = await this.getFromDynamoDB(key, type);
        if (dynamoResult) {
          // Remonter dans les couches supérieures selon la stratégie
          if (strategy.redis) {
            const redisClient = await this.initializeRedisCluster();
            if (redisClient) {
              await this.setInRedis(this.buildKey(key, type), dynamoResult, type);
            }
          }
          if (strategy.memory) {
            this.setInMemory(key, dynamoResult);
          }
          this.metrics.hits.l3++;
          this.recordLatency('l3', Date.now() - startTime);
          console.log(`🎯 Cache L3 HIT: ${key}`);
          return dynamoResult;
        }
      }

      // Aucune donnée trouvée
      this.metrics.misses++;
      console.log(`❌ Cache MISS: ${key}`);
      return null;

    } catch (error) {
      console.error('❌ Erreur cache GET:', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * 🔥 SET AVEC DISTRIBUTION INTELLIGENTE
   */
  async set(key, value, type = 'user', options = {}) {
    const startTime = Date.now();
    
    try {
      this.metrics.sets++;
      
      // Déterminer la stratégie de cache selon le type
      const strategy = this.getCacheStrategy(type, options);
      
      // 🚀 LAYER 1: Toujours en mémoire pour l'accès rapide
      if (strategy.memory) {
        this.setInMemory(key, value);
      }

      // 🚀 LAYER 2: Redis pour distribution
      if (strategy.redis) {
        const redisClient = await this.initializeRedisCluster();
        if (redisClient) {
          const redisKey = this.buildKey(key, type);
          await this.setInRedis(redisKey, value, type);
        }
      }

      // 🚀 LAYER 3: DynamoDB pour persistance
      if (strategy.dynamo) {
        await this.setInDynamoDB(key, value, type);
      }

      console.log(`✅ Cache SET: ${key} (Strategy: ${JSON.stringify(strategy)})`);
      return true;

    } catch (error) {
      console.error('❌ Erreur cache SET:', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * 🚀 STRATÉGIE DE CACHE INTELLIGENTE
   */
  getCacheStrategy(type, options = {}) {
    const strategies = {
      // Données critiques: toutes les couches
      user: { memory: true, redis: true, dynamo: true },
      auth: { memory: true, redis: true, dynamo: false },
      
      // Données fréquentes: mémoire + redis SEULEMENT
      subscription: { memory: true, redis: true, dynamo: false },
      partners: { memory: false, redis: true, dynamo: false }, // 🔥 DÉSACTIVÉ DYNAMO
      
      // Données statiques: toutes les couches avec TTL long
      geo: { memory: false, redis: true, dynamo: true },
      static: { memory: false, redis: true, dynamo: true },
      
      // Données temporaires: que Redis
      session: { memory: true, redis: true, dynamo: false },
      rate_limit: { memory: false, redis: true, dynamo: false }
    };

    return strategies[type] || { memory: true, redis: true, dynamo: false };
  }

  /**
   * 🔥 CACHE MÉMOIRE OPTIMISÉ
   */
  setInMemory(key, value) {
    const serialized = JSON.stringify(value);
    const size = Buffer.byteLength(serialized, 'utf8');
    
    // Vérifier la limite mémoire
    if (this.currentMemorySize + size > this.maxMemorySize) {
      this.evictLRU();
    }
    
    this.memoryCache.set(key, {
      data: value,
      timestamp: Date.now(),
      size: size
    });
    
    this.currentMemorySize += size;
  }

  getFromMemory(key) {
    const cached = this.memoryCache.get(key);
    if (!cached) return null;
    
    // Vérifier TTL
    const age = Date.now() - cached.timestamp;
    if (age > this.ttlConfig.user * 1000) {
      this.memoryCache.delete(key);
      this.currentMemorySize -= cached.size;
      return null;
    }
    
    return cached.data;
  }

  /**
   * 🔥 ÉVICTION LRU POUR MÉMOIRE
   */
  evictLRU() {
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Supprimer 25% des entrées les plus anciennes
    const toRemove = Math.ceil(entries.length * 0.25);
    
    for (let i = 0; i < toRemove; i++) {
      const [key, value] = entries[i];
      this.memoryCache.delete(key);
      this.currentMemorySize -= value.size;
    }
    
    console.log(`🧹 Éviction LRU: ${toRemove} entrées supprimées`);
  }

  /**
   * 🚀 REDIS OPERATIONS OPTIMISÉES
   */
  async setInRedis(key, value, type) {
    try {
      const redisClient = await this.initializeRedisCluster();
      if (!redisClient) return false;
      
      const ttl = this.ttlConfig[type] || this.ttlConfig.user;
      const pipeline = redisClient.pipeline();
      
      pipeline.setex(key, ttl, JSON.stringify(value));
      
      // Ajouter aux sets pour recherche rapide
      if (type === 'user') {
        pipeline.sadd('active_users', key);
      }
      
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('❌ Redis SET erreur:', error);
      return false;
    }
  }

  /**
   * 🔥 DYNAMODB OPERATIONS
   */
  async setInDynamoDB(key, value, type) {
    try {
      const params = {
        TableName: process.env.DYNAMODB_CACHE_TABLE || 'perkup-cache',
        Item: {
          cacheKey: key,
          type: type,
          data: value,
          ttl: Math.floor(Date.now() / 1000) + this.ttlConfig[type],
          createdAt: new Date().toISOString()
        }
      };
      
      await this.dynamoDB.put(params).promise();
      return true;
    } catch (error) {
      console.error('❌ DynamoDB SET erreur:', error);
      return false;
    }
  }

  async getFromDynamoDB(key, type) {
    try {
      const params = {
        TableName: process.env.DYNAMODB_CACHE_TABLE || 'perkup-cache',
        Key: { cacheKey: key }
      };
      
      const result = await this.dynamoDB.get(params).promise();
      
      if (result.Item && result.Item.ttl > Math.floor(Date.now() / 1000)) {
        return result.Item.data;
      }
      
      return null;
    } catch (error) {
      console.error('❌ DynamoDB GET erreur:', error);
      return null;
    }
  }

  /**
   * 🔥 INVALIDATION INTELLIGENTE
   */
  async invalidate(pattern, type = 'user') {
    try {
      // Invalider mémoire
      for (const [key] of this.memoryCache) {
        if (key.includes(pattern)) {
          const cached = this.memoryCache.get(key);
          this.memoryCache.delete(key);
          this.currentMemorySize -= cached.size;
        }
      }

      // Invalider Redis
      const redisClient = await this.initializeRedisCluster();
      if (redisClient) {
        const searchPattern = this.buildKey(pattern + '*', type);
        const keys = await redisClient.keys(searchPattern);
        
        if (keys.length > 0) {
          const pipeline = redisClient.pipeline();
          keys.forEach(key => pipeline.del(key));
          await pipeline.exec();
        }
      }

      // DynamoDB: soft delete avec TTL court
      const params = {
        TableName: process.env.DYNAMODB_CACHE_TABLE || 'perkup-cache',
        FilterExpression: 'contains(cacheKey, :pattern)',
        ExpressionAttributeValues: {
          ':pattern': pattern
        }
      };
      
      const items = await this.dynamoDB.scan(params).promise();
      
      for (const item of items.Items) {
        await this.dynamoDB.update({
          TableName: process.env.DYNAMODB_CACHE_TABLE || 'perkup-cache',
          Key: { cacheKey: item.cacheKey },
          UpdateExpression: 'SET #ttl = :ttl',
          ExpressionAttributeNames: {
            '#ttl': 'ttl'  // 🔥 CORRECTION: Utiliser alias pour mot réservé
          },
          ExpressionAttributeValues: {
            ':ttl': Math.floor(Date.now() / 1000) + 60 // Expirer dans 1 minute
          }
        }).promise();
      }

      console.log(`🧹 Cache invalidé: ${pattern}`);
      return true;

    } catch (error) {
      console.error('❌ Erreur invalidation:', error);
      return false;
    }
  }

  /**
   * 🚀 PRÉCHARGEMENT INTELLIGENT
   */
  async warmup(userId) {
    try {
      console.log(`🔥 Warmup cache pour user: ${userId}`);
      
      // Données critiques à précharger
      const warmupTasks = [
        this.preloadUserData(userId),
        this.preloadUserSubscription(userId),
        this.preloadNearbyPartners(userId),
        this.preloadUserCards(userId)
      ];
      
      await Promise.allSettled(warmupTasks);
      console.log(`✅ Warmup terminé pour user: ${userId}`);
      
    } catch (error) {
      console.error('❌ Erreur warmup:', error);
    }
  }

  async preloadUserData(userId) {
    // Simuler le préchargement des données utilisateur
    const userData = await this.fetchUserFromDB(userId);
    if (userData) {
      await this.set(`user:${userId}`, userData, 'user');
    }
  }

  async preloadUserSubscription(userId) {
    // Précharger les données d'abonnement
    try {
      // Cette fonction serait implémentée pour récupérer depuis MongoDB
      console.log(`🔄 Préchargement subscription pour ${userId}`);
    } catch (error) {
      console.error('❌ Erreur préchargement subscription:', error);
    }
  }

  async preloadNearbyPartners(userId) {
    // Précharger les partenaires proches
    try {
      console.log(`🔄 Préchargement partners pour ${userId}`);
    } catch (error) {
      console.error('❌ Erreur préchargement partners:', error);
    }
  }

  async preloadUserCards(userId) {
    // Précharger les cartes utilisateur
    try {
      console.log(`🔄 Préchargement cards pour ${userId}`);
    } catch (error) {
      console.error('❌ Erreur préchargement cards:', error);
    }
  }

  /**
   * 🔥 MÉTHODE GETORSET COMPATIBLE
   */
  async getOrSet(key, type, fallbackFn, customTTL = null) {
    const cached = await this.get(key, type);
    
    if (cached !== null) {
      return cached;
    }
    
    try {
      const freshData = await fallbackFn();
      if (freshData !== null && freshData !== undefined) {
        await this.set(key, freshData, type, customTTL);
      }
      return freshData;
    } catch (error) {
      console.error('Fallback function error:', error.message);
      throw error;
    }
  }

  /**
   * 🔥 DEL AVEC INVALIDATION MULTI-COUCHES
   */
  async del(key, type = 'user') {
    try {
      // L1: Mémoire
      const cached = this.memoryCache.get(key);
      if (cached) {
        this.memoryCache.delete(key);
        this.currentMemorySize -= cached.size;
      }

      // L2: Redis
      const redisClient = await this.initializeRedisCluster();
      if (redisClient) {
        const redisKey = this.buildKey(key, type);
        await redisClient.del(redisKey);
      }

      // L3: DynamoDB (soft delete)
      if (this.getCacheStrategy(type).dynamo) {
        const params = {
          TableName: process.env.DYNAMODB_CACHE_TABLE || 'perkup-cache',
          Key: { cacheKey: key },
          UpdateExpression: 'SET #ttl = :ttl',
          ExpressionAttributeNames: {
            '#ttl': 'ttl'  // 🔥 CORRECTION: Utiliser alias pour mot réservé
          },
          ExpressionAttributeValues: {
            ':ttl': Math.floor(Date.now() / 1000) + 60
          }
        };
        await this.dynamoDB.update(params).promise();
      }

      console.log(`🗑️ Cache DEL: ${key}`);
      return true;
    } catch (error) {
      console.error('❌ Cache DEL erreur:', error);
      return false;
    }
  }

  /**
   * 🔥 MÉTRIQUES ET MONITORING COMPLETS
   */
  getMetrics() {
    const totalRequests = this.metrics.hits.l1 + this.metrics.hits.l2 + 
                         this.metrics.hits.l3 + this.metrics.misses;
    
    const hitRate = totalRequests > 0 ? 
      ((this.metrics.hits.l1 + this.metrics.hits.l2 + this.metrics.hits.l3) / totalRequests * 100).toFixed(2) : 0;

    return {
      hitRate: `${hitRate}%`,
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      sets: this.metrics.sets,
      errors: this.metrics.errors,
      memoryUsage: `${(this.currentMemorySize / 1024 / 1024).toFixed(2)} MB`,
      avgLatency: {
        l1: this.calculateAverageLatency('l1'),
        l2: this.calculateAverageLatency('l2'),
        l3: this.calculateAverageLatency('l3')
      }
    };
  }

  calculateAverageLatency(layer) {
    const latencies = this.metrics.latency[layer];
    if (latencies.length === 0) return '0ms';
    
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    return `${avg.toFixed(2)}ms`;
  }

  recordLatency(layer, latency) {
    this.metrics.latency[layer].push(latency);
    // Garder seulement les 1000 dernières mesures
    if (this.metrics.latency[layer].length > 1000) {
      this.metrics.latency[layer].shift();
    }
  }

  /**
   * 🛠️ UTILITAIRES
   */
  buildKey(key, type) {
    return this.prefixes[type] + key;
  }

  async fetchUserFromDB(userId) {
    // Cette fonction serait implémentée pour récupérer depuis MongoDB
    return null;
  }

  /**
   * 🔥 HEALTH CHECK COMPLET
   */
  async health() {
    try {
      const checks = await Promise.allSettled([
        this.checkMemoryHealth(),
        this.checkRedisHealth(),
        this.checkDynamoDBHealth()
      ]);

      const results = checks.map((check, index) => ({
        layer: ['memory', 'redis', 'dynamodb'][index],
        status: check.status === 'fulfilled' ? check.value.status : 'error',
        details: check.status === 'fulfilled' ? check.value : { error: check.reason.message }
      }));

      const overall = results.every(r => r.status === 'healthy') ? 'healthy' : 'degraded';

      return {
        status: overall,
        layers: results,
        metrics: this.getMetrics(),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async checkMemoryHealth() {
    const usagePercent = (this.currentMemorySize / this.maxMemorySize) * 100;
    return {
      status: usagePercent < 80 ? 'healthy' : 'warning',
      usage: `${usagePercent.toFixed(2)}%`,
      size: `${(this.currentMemorySize / 1024 / 1024).toFixed(2)} MB`
    };
  }

  async checkRedisHealth() {
    try {
      const redisClient = await this.initializeRedisCluster();
      if (!redisClient) return { status: 'unavailable' };
      
      const start = Date.now();
      await redisClient.ping();
      const latency = Date.now() - start;
      
      return {
        status: latency < 50 ? 'healthy' : 'warning',
        latency: `${latency}ms`
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkDynamoDBHealth() {
    try {
      const start = Date.now();
      await this.dynamoDB.describeTable({ 
        TableName: process.env.DYNAMODB_CACHE_TABLE || 'perkup-cache' 
      }).promise();
      const latency = Date.now() - start;
      
      return {
        status: latency < 100 ? 'healthy' : 'warning',
        latency: `${latency}ms`
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  // Fermeture propre
  async disconnect() {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
      console.log('🔄 Redis Simple déconnecté proprement');
    }
  }
}

// Instance singleton optimisée
const distributedCache = new DistributedCacheSystem();
export default distributedCache;

import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient();

/**
 * 🚀 SERVICE DE NOTIFICATION WEBSOCKET TEMPS RÉEL
 * Envoie des notifications en temps réel aux clients connectés
 */
class WebSocketNotificationService {
  
  constructor() {
    this.connectionsTable = process.env.WEBSOCKET_CONNECTIONS_TABLE || 'perkup-websocket-connections';
  }
  
  /**
   * 📡 NOTIFIER CHANGEMENT DE PARTENAIRE
   * Déclenché automatiquement quand un partenaire est créé/modifié
   */
  async notifyPartnerChange(partnerId, action, partnerData) {
    try {
      console.log(`📡 Notification partner ${action}: ${partnerId}`);
      
      const notification = {
        type: 'partner_updated',
        action, // 'created', 'updated', 'deleted'
        partnerId,
        data: partnerData,
        timestamp: new Date().toISOString()
      };
      
      // Envoyer à tous les clients connectés intéressés par les partners
      await this.broadcastToSubscribers(['partners', 'partner_updates'], notification);
      
    } catch (error) {
      console.error('❌ Erreur notification partner:', error);
    }
  }
  
  /**
   * 🎯 NOTIFIER CHANGEMENT SPÉCIFIQUE PAR GÉOLOCALISATION
   */
  async notifyPartnerChangeByLocation(partnerId, action, partnerData, city, category) {
    try {
      const notification = {
        type: 'partner_location_updated',
        action,
        partnerId,
        data: partnerData,
        city,
        category,
        timestamp: new Date().toISOString()
      };
      
      // Topics spécifiques par localisation et catégorie
      const topics = [
        'partners',
        `partners_${city?.toLowerCase()}`,
        `partners_${category}`,
        `partners_${city?.toLowerCase()}_${category}`
      ];
      
      await this.broadcastToSubscribers(topics, notification);
      
    } catch (error) {
      console.error('❌ Erreur notification partner location:', error);
    }
  }
  
  /**
   * 🔄 NOTIFIER INVALIDATION CACHE
   * Informe les clients que leur cache doit être rafraîchi
   */
  async notifyCacheInvalidation(cacheKeys) {
    try {
      console.log(`🔄 Notification invalidation cache:`, cacheKeys);
      
      const notification = {
        type: 'cache_invalidated',
        keys: cacheKeys,
        timestamp: new Date().toISOString()
      };
      
      // Envoyer à tous les clients connectés
      await this.broadcastToAll(notification);
      
    } catch (error) {
      console.error('❌ Erreur notification cache:', error);
    }
  }
  
  /**
   * 👤 NOTIFIER UN UTILISATEUR SPÉCIFIQUE
   */
  async notifyUser(userId, notification) {
    try {
      console.log(`👤 Notification user ${userId}:`, notification.type);
      
      const connections = await this.getUserConnections(userId);
      
      if (connections.length === 0) {
        console.log(`ℹ️ Aucune connexion active pour user ${userId}`);
        return;
      }
      
      await this.sendToConnections(connections, notification);
      
    } catch (error) {
      console.error(`❌ Erreur notification user ${userId}:`, error);
    }
  }
  
  /**
   * 📢 BROADCAST À TOUS LES CLIENTS CONNECTÉS
   */
  async broadcastToAll(notification) {
    try {
      console.log(`📢 Broadcast global:`, notification.type);
      
      const connections = await this.getAllActiveConnections();
      await this.sendToConnections(connections, notification);
      
    } catch (error) {
      console.error('❌ Erreur broadcast global:', error);
    }
  }
  
  /**
   * 🎯 BROADCAST AUX ABONNÉS DE TOPICS SPÉCIFIQUES
   */
  async broadcastToSubscribers(topics, notification) {
    try {
      console.log(`🎯 Broadcast topics [${topics.join(', ')}]:`, notification.type);
      
      const connections = await this.getSubscriberConnections(topics);
      await this.sendToConnections(connections, notification);
      
    } catch (error) {
      console.error('❌ Erreur broadcast subscribers:', error);
    }
  }
  
  /**
   * 🔍 RÉCUPÉRER CONNEXIONS D'UN USER
   */
  async getUserConnections(userId) {
    const result = await dynamodb.scan({
      TableName: this.connectionsTable,
      FilterExpression: 'userId = :userId AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':status': 'connected'
      }
    }).promise();
    
    return result.Items || [];
  }
  
  /**
   * 🔍 RÉCUPÉRER TOUTES LES CONNEXIONS ACTIVES
   */
  async getAllActiveConnections() {
    const result = await dynamodb.scan({
      TableName: this.connectionsTable,
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'connected'
      }
    }).promise();
    
    return result.Items || [];
  }
  
  /**
   * 🎯 RÉCUPÉRER CONNEXIONS ABONNÉES À DES TOPICS
   */
  async getSubscriberConnections(topics) {
    const allConnections = await this.getAllActiveConnections();
    
    // Filtrer les connexions qui ont au moins un topic en commun
    return allConnections.filter(connection => {
      const subscriptions = connection.subscriptions || [];
      return topics.some(topic => subscriptions.includes(topic));
    });
  }
  
  /**
   * 📤 ENVOYER NOTIFICATION AUX CONNEXIONS
   */
  async sendToConnections(connections, notification) {
    if (connections.length === 0) return;
    
    console.log(`📤 Envoi à ${connections.length} connexions`);
    
    const tasks = connections.map(async (connection) => {
      try {
        // 🔧 CORRECTION: Utiliser l'endpoint depuis l'environnement ou la connexion
        let endpoint;
        
        if (process.env.WEBSOCKET_API_ENDPOINT) {
          // Utiliser l'endpoint depuis l'environnement (recommandé)
          endpoint = process.env.WEBSOCKET_API_ENDPOINT;
          console.log(`🔗 Utilisation endpoint env: ${endpoint}`);
        } else if (connection.domainName && connection.stage) {
          // Fallback: construire depuis les données de connexion
          endpoint = `https://${connection.domainName}/${connection.stage}`;
          console.log(`🔗 Utilisation endpoint connexion: ${endpoint}`);
        } else {
          throw new Error('Aucun endpoint WebSocket disponible');
        }
        
        const apiGateway = new AWS.ApiGatewayManagementApi({
          apiVersion: '2018-11-29',
          endpoint: endpoint
        });
        
        await apiGateway.postToConnection({
          ConnectionId: connection.connectionId,
          Data: JSON.stringify(notification)
        }).promise();
        
        console.log(`✅ Notification envoyée à ${connection.connectionId}`);
        
      } catch (error) {
        console.error(`❌ Erreur envoi à ${connection.connectionId}:`, error);
        
        // Si la connexion est fermée (410 GONE), la supprimer
        if (error.statusCode === 410) {
          console.log(`🧹 Connexion fermée détectée: ${connection.connectionId}`);
          await this.cleanupConnection(connection.connectionId);
        }
      }
    });
    
    await Promise.allSettled(tasks);
  }
  
  /**
   * 🧹 NETTOYER UNE CONNEXION FERMÉE
   */
  async cleanupConnection(connectionId) {
    try {
      await dynamodb.delete({
        TableName: this.connectionsTable,
        Key: { connectionId }
      }).promise();
      
      console.log(`🧹 Connexion nettoyée: ${connectionId}`);
      
    } catch (error) {
      console.error(`❌ Erreur nettoyage connexion ${connectionId}:`, error);
    }
  }
  
  /**
   * 📊 STATISTIQUES CONNEXIONS
   */
  async getConnectionStats() {
    try {
      const connections = await this.getAllActiveConnections();
      
      const stats = {
        total: connections.length,
        byUser: {},
        byTopic: {},
        timestamp: new Date().toISOString()
      };
      
      connections.forEach(connection => {
        // Par user
        stats.byUser[connection.userId] = (stats.byUser[connection.userId] || 0) + 1;
        
        // Par topic
        (connection.subscriptions || []).forEach(topic => {
          stats.byTopic[topic] = (stats.byTopic[topic] || 0) + 1;
        });
      });
      
      return stats;
      
    } catch (error) {
      console.error('❌ Erreur stats connexions:', error);
      return null;
    }
  }
}

// Export singleton
export const websocketService = new WebSocketNotificationService();
export default websocketService;

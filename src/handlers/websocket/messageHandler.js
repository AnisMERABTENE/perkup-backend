import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient();

/**
 * 📨 WEBSOCKET MESSAGE HANDLER
 * Gère les messages entrants des clients WebSocket
 */
export const handler = async (event) => {
  const { connectionId, body } = event;
  
  console.log(`📨 Message WebSocket reçu de ${connectionId}:`, body);
  
  try {
    // Parser le message
    const message = JSON.parse(body);
    const { type, data } = message;
    
    // Récupérer les infos de connexion
    const connection = await dynamodb.get({
      TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE || 'perkup-websocket-connections',
      Key: { connectionId }
    }).promise();
    
    if (!connection.Item) {
      console.log('❌ Connexion introuvable');
      return { statusCode: 404 };
    }
    
    const userId = connection.Item.userId;
    
    // Traiter selon le type de message
    switch (type) {
      case 'ping':
        await handlePing(connectionId, userId, event.requestContext);
        break;
        
      case 'subscribe':
        await handleSubscription(connectionId, userId, data);
        break;
        
      case 'unsubscribe':
        await handleUnsubscription(connectionId, userId, data);
        break;
        
      default:
        console.log(`⚠️ Type de message non supporté: ${type}`);
    }
    
    return {
      statusCode: 200,
      body: 'Message traité'
    };
    
  } catch (error) {
    console.error('❌ Erreur traitement message WebSocket:', error);
    
    return {
      statusCode: 500,
      body: 'Erreur interne'
    };
  }
};

/**
 * 🏓 PING/PONG pour maintenir la connexion
 */
async function handlePing(connectionId, userId, requestContext) {
  console.log(`🏓 Ping reçu de ${userId}`);
  
  // Mettre à jour l'activité
  await dynamodb.update({
    TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE || 'perkup-websocket-connections',
    Key: { connectionId },
    UpdateExpression: 'SET lastActivity = :timestamp',
    ExpressionAttributeValues: {
      ':timestamp': new Date().toISOString()
    }
  }).promise();
  
  // Répondre avec pong
  const apiGateway = new AWS.ApiGatewayManagementApi({
    endpoint: `https://${requestContext.domainName}/${requestContext.stage}`
  });
  
  await apiGateway.postToConnection({
    ConnectionId: connectionId,
    Data: JSON.stringify({
      type: 'pong',
      timestamp: new Date().toISOString()
    })
  }).promise();
}

/**
 * 📡 SUBSCRIPTION à des topics spécifiques
 */
async function handleSubscription(connectionId, userId, data) {
  const { topics } = data;
  
  console.log(`📡 Subscription de ${userId} aux topics:`, topics);
  
  // Stocker les subscriptions
  await dynamodb.update({
    TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE || 'perkup-websocket-connections',
    Key: { connectionId },
    UpdateExpression: 'SET subscriptions = :topics, lastActivity = :timestamp',
    ExpressionAttributeValues: {
      ':topics': topics || [],
      ':timestamp': new Date().toISOString()
    }
  }).promise();
}

/**
 * 📡 UNSUBSCRIPTION de topics
 */
async function handleUnsubscription(connectionId, userId, data) {
  const { topics } = data;
  
  console.log(`📡 Unsubscription de ${userId} des topics:`, topics);
  
  // Récupérer les subscriptions actuelles
  const connection = await dynamodb.get({
    TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE || 'perkup-websocket-connections',
    Key: { connectionId }
  }).promise();
  
  const currentTopics = connection.Item?.subscriptions || [];
  const updatedTopics = currentTopics.filter(topic => !topics.includes(topic));
  
  // Mettre à jour
  await dynamodb.update({
    TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE || 'perkup-websocket-connections',
    Key: { connectionId },
    UpdateExpression: 'SET subscriptions = :topics, lastActivity = :timestamp',
    ExpressionAttributeValues: {
      ':topics': updatedTopics,
      ':timestamp': new Date().toISOString()
    }
  }).promise();
}

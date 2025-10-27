import AWS from 'aws-sdk';
import jwt from 'jsonwebtoken';

const dynamodb = new AWS.DynamoDB.DocumentClient();

/**
 * 🔐 Vérification simple du token
 */
const verifyToken = (token) => {
  try {
    const cleanToken = token.replace('Bearer ', '');
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Token invalide');
  }
};

/**
 * 🔌 WEBSOCKET CONNECTION HANDLER
 */
export const handler = async (event) => {
  console.log('🔌 WebSocket $connect event:', JSON.stringify(event, null, 2));
  
  const { connectionId, requestContext } = event;
  const { domainName, stage } = requestContext;
  
  try {
    // Récupérer le token depuis les query parameters
    const token = event.queryStringParameters?.token;
    
    if (!token) {
      console.log('❌ Pas de token fourni');
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Token manquant' })
      };
    }
    
    console.log('🔐 Vérification du token...');
    
    // Vérifier le token JWT
    let decoded;
    try {
      decoded = verifyToken(token);
      console.log('✅ Token vérifié:', decoded.id);
    } catch (error) {
      console.error('❌ Token invalide:', error.message);
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Token invalide' })
      };
    }
    
    const userId = decoded.id;
    
    // Stocker la connexion dans DynamoDB
    const connectionData = {
      connectionId,
      userId,
      domainName,
      stage,
      connectedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // TTL 24h
      status: 'connected',
      lastActivity: new Date().toISOString()
    };
    
    console.log('💾 Enregistrement connexion dans DynamoDB...');
    
    await dynamodb.put({
      TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE || 'perkup-websocket-connections',
      Item: connectionData
    }).promise();
    
    console.log(`✅ Connexion stockée pour user ${userId}`);
    
    // Envoyer message de bienvenue
    console.log('📤 Envoi message de bienvenue...');
    
    const apiGateway = new AWS.ApiGatewayManagementApi({
      endpoint: `${domainName}/${stage}`
    });
    
    const welcomeMessage = {
      type: 'connection_success',
      message: 'Connexion WebSocket établie',
      userId,
      timestamp: new Date().toISOString()
    };
    
    try {
      await apiGateway.postToConnection({
        ConnectionId: connectionId,
        Data: JSON.stringify(welcomeMessage)
      }).promise();
      
      console.log('✅ Message de bienvenue envoyé');
    } catch (postError) {
      console.error('⚠️ Erreur envoi message (non-bloquant):', postError.message);
      // Ne pas bloquer la connexion si l'envoi du message échoue
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Connected' })
    };
    
  } catch (error) {
    console.error('❌ Erreur connexion WebSocket:', error);
    console.error('Stack:', error.stack);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Erreur interne',
        error: error.message 
      })
    };
  }
};

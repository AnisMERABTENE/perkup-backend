import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient();

/**
 * 🔌 WEBSOCKET DISCONNECT HANDLER
 * Nettoie les connexions WebSocket fermées
 */
export const handler = async (event) => {
  // ✅ CORRECTION : connectionId est dans requestContext
  const connectionId = event.requestContext.connectionId;
  
  console.log(`🔌 WebSocket déconnexion: ${connectionId}`);
  
  try {
    // Supprimer la connexion de DynamoDB
    await dynamodb.delete({
      TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE || 'perkup-websocket-connections',
      Key: {
        connectionId
      }
    }).promise();
    
    console.log(`🗑️ Connexion supprimée: ${connectionId}`);
    
    return {
      statusCode: 200,
      body: 'Disconnected'
    };
    
  } catch (error) {
    console.error('❌ Erreur déconnexion WebSocket:', error);
    
    return {
      statusCode: 500,
      body: 'Erreur interne'
    };
  }
};

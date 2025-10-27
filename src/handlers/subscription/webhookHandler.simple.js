export const handler = async (event) => {
  console.log('🚀 WEBHOOK TEST - Version simplifiée');
  console.log('Event reçu:', JSON.stringify(event, null, 2));
  
  return {
    statusCode: 200,
    body: JSON.stringify({ received: true, message: 'Webhook fonctionne!' })
  };
};

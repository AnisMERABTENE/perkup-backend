import AWS from 'aws-sdk';
import dotenv from "dotenv";

dotenv.config();

// Service email intelligent - détection automatique
export const sendVerificationEmail = async (email, code) => {
  
  // Mode développement ou local - utiliser mock
  if (process.env.NODE_ENV === 'development' || !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    console.log(`📧 [MOCK EMAIL] Envoi simulé à ${email}`);
    console.log(`🔑 [CODE VERIFICATION] ${code}`);
    console.log(`📝 [EMAIL CONTENT] Bienvenue sur PerkUP! Votre code: ${code}`);
    console.log(`📫 [INFO] En production, cet email sera envoyé via AWS SES à votre email configuré`);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    return { 
      messageId: `mock-${Date.now()}`, 
      status: 'delivered',
      provider: 'mock'
    };
  }

  // Mode production AWS Lambda - utiliser SES
  try {
    const ses = new AWS.SES({
      region: process.env.SES_REGION || 'eu-west-1'
    });

    const params = {
      Source: process.env.EMAIL_SOURCE,
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Subject: { Data: "Vérification de votre compte PerkUP" },
        Body: {
          Html: {
            Data: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4CAF50;">Bienvenue sur PerkUP 🎉</h2>
                <p>Merci de vous être inscrit ! Voici votre code de vérification :</p>
                <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
                  <h1 style="color: #333; font-size: 32px; margin: 0;">${code}</h1>
                </div>
                <p>Ce code expire dans 15 minutes.</p>
                <p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
                <hr>
                <p style="color: #666; font-size: 12px;">PerkUP - Votre plateforme de fidélité</p>
              </div>
            `
          }
        }
      }
    };

    const result = await ses.sendEmail(params).promise();
    console.log(`📩 Email SES envoyé à ${email} - MessageId: ${result.MessageId}`);
    return {
      messageId: result.MessageId,
      status: 'delivered',
      provider: 'aws-ses'
    };
    
  } catch (err) {
    console.error("❌ Erreur AWS SES:", err);
    
    // Fallback en mock si SES échoue
    console.log(`📧 [FALLBACK MOCK] Code pour ${email}: ${code}`);
    return { 
      messageId: `fallback-${Date.now()}`, 
      status: 'mock_fallback',
      provider: 'fallback'
    };
  }
};

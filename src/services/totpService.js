import crypto from 'crypto';

// Configuration TOTP
export const TOTP_WINDOW = 120; // Token valide pendant 120 secondes (2 minutes)
export const TOTP_DIGITS = 8; // 8 chiffres pour le token

// Fonction pour générer un token TOTP
export const generateTOTP = (secret, timeStep = TOTP_WINDOW) => {
  const time = Math.floor(Date.now() / 1000 / timeStep);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeUInt32BE(0, 0); // High 32 bits
  timeBuffer.writeUInt32BE(time, 4); // Low 32 bits
  
  // Convertir le secret hex en buffer
  const secretBuffer = Buffer.from(secret, 'hex');
  
  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(timeBuffer);
  const hash = hmac.digest();
  
  const offset = hash[hash.length - 1] & 0xf;
  const code = ((hash[offset] & 0x7f) << 24) |
               ((hash[offset + 1] & 0xff) << 16) |
               ((hash[offset + 2] & 0xff) << 8) |
               (hash[offset + 3] & 0xff);
  
  return (code % Math.pow(10, TOTP_DIGITS)).toString().padStart(TOTP_DIGITS, '0');
};

// Fonction pour valider un token TOTP (avec fenêtre de tolérance)
export const validateTOTP = (token, secret, window = 1) => {
  const currentTime = Math.floor(Date.now() / 1000 / TOTP_WINDOW);
  
  // Convertir le secret hex en buffer
  const secretBuffer = Buffer.from(secret, 'hex');
  
  for (let i = -window; i <= window; i++) {
    const testTime = currentTime + i;
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeUInt32BE(0, 0); // High 32 bits
    timeBuffer.writeUInt32BE(testTime, 4); // Low 32 bits
    
    const hmac = crypto.createHmac('sha1', secretBuffer);
    hmac.update(timeBuffer);
    const hash = hmac.digest();
    
    const offset = hash[hash.length - 1] & 0xf;
    const code = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);
    
    const expectedToken = (code % Math.pow(10, TOTP_DIGITS)).toString().padStart(TOTP_DIGITS, '0');
    
    if (token === expectedToken) {
      return { valid: true, timeWindow: i };
    }
  }
  
  return { valid: false };
};

// Générer un numéro de carte unique
export const generateCardNumber = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PERK${timestamp}${random}`;
};

// Générer un secret TOTP unique
export const generateTOTPSecret = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Calculer la réduction selon le plan utilisateur
export const calculateUserDiscount = (partnerDiscount, userPlan) => {
  if (userPlan === "premium") {
    return partnerDiscount; // Premium a accès à tout
  }
  
  const maxDiscounts = {
    basic: 5,
    super: 10,
    premium: 100 // Pas de limite
  };
  
  const maxDiscount = maxDiscounts[userPlan] || 0;
  return Math.min(partnerDiscount, maxDiscount);
};

// Calculer les montants avec précision
export const calculateAmounts = (originalAmount, discountPercent) => {
  const original = parseFloat(originalAmount);
  const discountAmount = Math.floor((original * discountPercent) / 100 * 100) / 100;
  const finalAmount = original - discountAmount;
  
  return {
    original,
    discountAmount,
    finalAmount
  };
};

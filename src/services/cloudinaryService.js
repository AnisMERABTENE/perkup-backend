/**
 * 🔐 SERVICE CLOUDINARY SÉCURISÉ AVEC SIGNATURES
 * Génère des signatures temporaires pour uploads frontend sécurisés
 */

import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'drch6mjsd',
  api_key: process.env.CLOUDINARY_API_KEY || '299119212298488',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'iFcP4yyrSgJ3LsOklclis5XYUMg',
});

/**
 * 🔑 Générer une signature d'upload temporaire
 * @param folder Dossier de destination
 * @param options Options d'upload (taille, format, etc.)
 * @returns Signature temporaire pour upload direct frontend
 */
export const generateUploadSignature = (folder = 'vendor-logos', options = {}) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // 🔑 IMPORTANT: Créer les paramètres dans l'ordre EXACT que Cloudinary attend
    const params = {
      allowed_formats: 'jpg,jpeg,png,webp',
      folder,
      invalidate: true,
      overwrite: true,
      resource_type: 'image',
      timestamp,
      transformation: 'w_800,h_800,c_limit,q_auto:good',
      ...options
    };

    // Créer manuellement la string à signer (SANS resource_type selon documentation)
    const stringToSign = [
      `allowed_formats=${params.allowed_formats}`,
      `folder=${params.folder}`,
      `invalidate=${params.invalidate}`,
      `overwrite=${params.overwrite}`,
      `timestamp=${params.timestamp}`,
      `transformation=${params.transformation}`
    ].join('&') + process.env.CLOUDINARY_API_SECRET;

    // Générer la signature SHA-1
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

    console.log('✅ Signature d\'upload générée pour folder:', folder);

    return {
      success: true,
      data: {
        signature,
        timestamp,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        uploadParams: {
          allowed_formats: params.allowed_formats,
          folder: params.folder,
          invalidate: params.invalidate,
          overwrite: params.overwrite,
          resource_type: params.resource_type,
          transformation: params.transformation
        }
      }
    };
  } catch (error) {
    console.error('❌ Erreur génération signature:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la génération de signature'
    };
  }
};

/**
 * ✅ Valider une URL Cloudinary
 * @param url URL à valider
 * @returns True si l'URL est valide et provient de notre Cloudinary
 */
export const validateCloudinaryUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Vérifier que l'URL provient bien de notre Cloudinary
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'drch6mjsd';
  const validPatterns = [
    `https://res.cloudinary.com/${cloudName}/`,
    `https://cloudinary.com/${cloudName}/`,
    `http://res.cloudinary.com/${cloudName}/` // Pour dev local
  ];

  const isValidUrl = validPatterns.some(pattern => url.startsWith(pattern));
  
  if (!isValidUrl) {
    console.warn('⚠️ URL Cloudinary invalide:', url);
    return false;
  }

  console.log('✅ URL Cloudinary validée:', url);
  return true;
};

/**
 * 📤 Upload d'une image depuis base64 (fonction legacy)
 * @param base64Data Données image en base64
 * @param folder Dossier de destination
 * @param publicId ID public personnalisé (optionnel)
 * @returns URL sécurisée de l'image
 */
export const uploadImageFromBase64 = async (
  base64Data,
  folder = 'vendor-logos',
  publicId
) => {
  try {
    console.log('📤 Upload image vers Cloudinary, dossier:', folder);

    // Vérifier que base64Data commence par data:image
    if (!base64Data.startsWith('data:image/')) {
      return {
        success: false,
        error: 'Format d\'image invalide. Base64 attendu.',
      };
    }

    const uploadOptions = {
      folder,
      quality: 'auto:good',
      fetch_format: 'auto',
      format: 'jpg',
      // Transformations automatiques pour optimiser
      transformation: [
        {
          width: 400,
          height: 400,
          crop: 'fill',
          gravity: 'face:center',
        },
        {
          quality: 'auto:good',
        },
      ],
      // Métadonnées
      tags: ['vendor', 'logo', 'perkup'],
    };

    // Ajouter publicId si fourni
    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    // Upload vers Cloudinary
    const result = await cloudinary.uploader.upload(base64Data, uploadOptions);

    console.log('✅ Image uploadée avec succès:', result.secure_url);

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    console.error('❌ Erreur upload Cloudinary:', error);
    
    return {
      success: false,
      error: error.message || 'Erreur inconnue lors de l\'upload',
    };
  }
};

/**
 * 🗑️ Supprimer une image de Cloudinary (si besoin)
 * @param publicId Public ID de l'image
 * @returns Résultat de la suppression
 */
export const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log('🗑️ Image supprimée:', publicId, result);
    return {
      success: result.result === 'ok',
      result
    };
  } catch (error) {
    console.error('❌ Erreur suppression image:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * 📊 Obtenir des infos sur une image Cloudinary
 * @param publicId Public ID de l'image
 * @returns Informations de l'image
 */
export const getImageInfo = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId);
    return {
      success: true,
      data: {
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        createdAt: result.created_at
      }
    };
  } catch (error) {
    console.error('❌ Erreur récupération info image:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  generateUploadSignature,
  validateCloudinaryUrl,
  uploadImageFromBase64,
  deleteImage,
  getImageInfo
};

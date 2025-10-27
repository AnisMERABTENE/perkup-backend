#!/bin/bash

# 🔒 SCRIPT DE SÉCURISATION AWS PARAMETER STORE
# Configure automatiquement tous les secrets dans AWS Parameter Store

set -e

# Configuration
REGION="eu-west-1"
STAGE=${1:-"dev"}

echo "🔒 Configuration des secrets AWS Parameter Store pour l'environnement: $STAGE"
echo "📍 Région: $REGION"

# Vérifier que AWS CLI est configuré
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI n'est pas configuré. Exécutez 'aws configure' d'abord."
    exit 1
fi

# Fonction pour créer un paramètre sécurisé
create_secure_parameter() {
    local name=$1
    local value=$2
    local description=$3
    local type=${4:-"SecureString"}
    
    echo "📝 Création du paramètre: $name"
    
    aws ssm put-parameter \
        --region "$REGION" \
        --name "/perkup/$STAGE/$name" \
        --value "$value" \
        --description "$description" \
        --type "$type" \
        --overwrite \
        --tier "Standard" > /dev/null
    
    echo "✅ Paramètre créé: /perkup/$STAGE/$name"
}

# Fonction pour demander une valeur de manière sécurisée
prompt_secure_value() {
    local prompt_text=$1
    local value
    
    echo -n "$prompt_text: "
    read -s value
    echo
    echo "$value"
}

echo ""
echo "🔑 CONFIGURATION DES SECRETS"
echo "================================"

# 1. Base de données MongoDB
echo ""
echo "📊 Configuration MongoDB"
MONGO_URI=$(prompt_secure_value "URL MongoDB (mongodb+srv://...)")
create_secure_parameter "database/mongoUri" "$MONGO_URI" "URI de connexion MongoDB Atlas"

# 2. JWT Secret
echo ""
echo "🔐 Configuration JWT"
echo "Génération automatique d'un secret JWT sécurisé..."
JWT_SECRET=$(openssl rand -hex 64)
create_secure_parameter "auth/jwtSecret" "$JWT_SECRET" "Clé secrète pour signer les tokens JWT"
echo "✅ Secret JWT généré automatiquement"

# 3. Configuration Email
echo ""
echo "📧 Configuration Email (AWS SES)"
EMAIL_SOURCE=$(prompt_secure_value "Email source vérifié dans AWS SES")
create_secure_parameter "email/source" "$EMAIL_SOURCE" "Adresse email source pour AWS SES" "String"
create_secure_parameter "email/region" "$REGION" "Région AWS SES" "String"

# 4. Configuration Stripe
echo ""
echo "💳 Configuration Stripe"
STRIPE_SECRET_KEY=$(prompt_secure_value "Clé secrète Stripe (sk_test_... ou sk_live_...)")
create_secure_parameter "stripe/secretKey" "$STRIPE_SECRET_KEY" "Clé secrète Stripe"

STRIPE_WEBHOOK_SECRET=$(prompt_secure_value "Secret webhook Stripe (whsec_...)")
create_secure_parameter "stripe/webhookSecret" "$STRIPE_WEBHOOK_SECRET" "Secret webhook Stripe"

echo ""
echo "Prix des plans Stripe:"
STRIPE_PRICE_BASIC=$(prompt_secure_value "ID prix plan Basic (price_...)")
create_secure_parameter "stripe/priceBasic" "$STRIPE_PRICE_BASIC" "ID prix Stripe plan Basic" "String"

STRIPE_PRICE_SUPER=$(prompt_secure_value "ID prix plan Super (price_...)")
create_secure_parameter "stripe/priceSuper" "$STRIPE_PRICE_SUPER" "ID prix Stripe plan Super" "String"

STRIPE_PRICE_PREMIUM=$(prompt_secure_value "ID prix plan Premium (price_...)")
create_secure_parameter "stripe/pricePremium" "$STRIPE_PRICE_PREMIUM" "ID prix Stripe plan Premium" "String"

# 5. Configuration Redis (optionnel)
echo ""
echo "🚀 Configuration Redis (optionnel)"
read -p "Avez-vous un cluster Redis? (y/N): " has_redis
if [[ $has_redis =~ ^[Yy]$ ]]; then
    REDIS_ENDPOINT=$(prompt_secure_value "Endpoint Redis")
    create_secure_parameter "cache/redisEndpoint" "$REDIS_ENDPOINT" "Endpoint du cluster Redis" "String"
else
    create_secure_parameter "cache/redisEndpoint" "none" "Pas de Redis configuré" "String"
fi

echo ""
echo "🔍 VÉRIFICATION DES PARAMÈTRES"
echo "==============================="

# Lister tous les paramètres créés
echo "Paramètres configurés dans /perkup/$STAGE/:"
aws ssm get-parameters-by-path \
    --region "$REGION" \
    --path "/perkup/$STAGE/" \
    --recursive \
    --query 'Parameters[].Name' \
    --output table

echo ""
echo "✅ CONFIGURATION TERMINÉE AVEC SUCCÈS!"
echo ""
echo "🚀 PROCHAINES ÉTAPES:"
echo "1. Déployez votre application avec: npm run deploy:$STAGE"
echo "2. Les variables d'environnement sont maintenant sécurisées dans AWS Parameter Store"
echo "3. Plus besoin du fichier .env en production!"
echo ""
echo "⚠️  IMPORTANT:"
echo "- Ne partagez jamais les valeurs affichées dans ce script"
echo "- Les secrets sont chiffrés dans AWS Parameter Store avec KMS"
echo "- Seules les fonctions Lambda autorisées peuvent y accéder"
echo ""
echo "📋 RÉSUMÉ DES COÛTS AWS:"
echo "- Parameter Store Standard: ~\$0.05 par 10,000 requêtes"
echo "- KMS pour chiffrement: ~\$1 par mois + \$0.03 per 10,000 requêtes"
echo "- Total estimé: <\$5/mois pour usage normal"

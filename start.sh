#!/bin/bash

# 🚀 Script de démarrage rapide PerkUP Backend
# Ce script configure l'environnement et démarre le serveur en mode développement

echo "🎯 PerkUP Backend - Configuration et démarrage automatique"
echo "================================================================="

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher des messages colorés
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérifier Node.js
log_info "Vérification des prérequis..."
if ! command -v node &> /dev/null; then
    log_error "Node.js n'est pas installé. Installer Node.js 18.x ou supérieur."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    log_error "Node.js version $NODE_VERSION détectée. Version 18 ou supérieure requise."
    exit 1
fi

log_success "Node.js $(node --version) ✓"

# Vérifier npm
if ! command -v npm &> /dev/null; then
    log_error "npm n'est pas installé."
    exit 1
fi

log_success "npm $(npm --version) ✓"

# Installation des dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    log_info "Installation des dépendances npm..."
    npm install
    if [ $? -eq 0 ]; then
        log_success "Dépendances installées"
    else
        log_error "Échec de l'installation des dépendances"
        exit 1
    fi
else
    log_success "Dépendances déjà installées"
fi

# Vérifier le fichier .env
if [ ! -f ".env" ]; then
    log_warning "Fichier .env non trouvé"
    log_info "Copie du template .env.example vers .env"
    
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_success "Fichier .env créé depuis .env.example"
        log_warning "⚠️  IMPORTANT: Éditer le fichier .env avec vos vraies valeurs avant de continuer!"
        echo ""
        echo "Variables obligatoires à configurer:"
        echo "- MONGO_URI (Base de données MongoDB)"
        echo "- JWT_SECRET (Clé secrète JWT)"
        echo "- EMAIL_SOURCE (Email AWS SES)"
        echo "- STRIPE_SECRET_KEY (Clé Stripe)"
        echo "- STRIPE_PRICE_* (IDs des plans Stripe)"
        echo ""
        read -p "Appuyez sur Entrée quand vous avez configuré le fichier .env..."
    else
        log_error "Fichier .env.example non trouvé. Créer manuellement le fichier .env"
        exit 1
    fi
else
    log_success "Fichier .env trouvé"
fi

# Vérifier les variables d'environnement critiques
log_info "Vérification de la configuration..."

# Charger les variables d'environnement
source .env 2>/dev/null || true

missing_vars=()

if [ -z "$MONGO_URI" ]; then
    missing_vars+=("MONGO_URI")
fi

if [ -z "$JWT_SECRET" ]; then
    missing_vars+=("JWT_SECRET")
fi

if [ ${#missing_vars[@]} -gt 0 ]; then
    log_error "Variables d'environnement manquantes:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    echo ""
    log_warning "Configurez ces variables dans le fichier .env et relancez le script"
    exit 1
fi

log_success "Configuration de base validée"

# Test de connexion MongoDB (optionnel)
if [ -n "$MONGO_URI" ]; then
    log_info "Test de connexion MongoDB..."
    # Simple test avec node
    node -e "
        const mongoose = require('mongoose');
        mongoose.connect('$MONGO_URI', { serverSelectionTimeoutMS: 5000 })
            .then(() => {
                console.log('✅ Connexion MongoDB réussie');
                process.exit(0);
            })
            .catch(err => {
                console.log('❌ Échec connexion MongoDB:', err.message);
                process.exit(1);
            });
    " 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_success "Connexion MongoDB OK"
    else
        log_warning "Impossible de se connecter à MongoDB. Vérifiez MONGO_URI"
        read -p "Continuer quand même ? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# Vérifier Serverless
log_info "Vérification de Serverless Framework..."
if ! command -v serverless &> /dev/null; then
    log_warning "Serverless Framework non installé globalement"
    log_info "Installation locale via npx..."
else
    log_success "Serverless Framework $(serverless --version | head -n1) ✓"
fi

# Générer un JWT secret si manquant ou trop court
if [ -z "$JWT_SECRET" ] || [ ${#JWT_SECRET} -lt 32 ]; then
    log_warning "JWT_SECRET manquant ou trop court"
    log_info "Génération d'un JWT_SECRET sécurisé..."
    
    # Générer une clé aléatoire
    if command -v openssl &> /dev/null; then
        NEW_JWT_SECRET=$(openssl rand -hex 64)
    else
        # Fallback si openssl n'est pas disponible
        NEW_JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    fi
    
    # Remplacer dans le fichier .env
    if grep -q "JWT_SECRET=" .env; then
        sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$NEW_JWT_SECRET/" .env
    else
        echo "JWT_SECRET=$NEW_JWT_SECRET" >> .env
    fi
    
    log_success "JWT_SECRET généré et ajouté au fichier .env"
fi

echo ""
echo "================================================================="
log_success "Configuration terminée! Démarrage du serveur..."
echo "================================================================="

# Afficher les informations de démarrage
echo ""
echo "🌐 Le serveur sera accessible sur:"
echo "   - GraphQL API: http://localhost:4000/graphql"
echo "   - Playground: http://localhost:4000/graphql (mode dev)"
echo ""
echo "📊 En mode développement:"
echo "   - Auto-reload activé"
echo "   - Logs détaillés"
echo "   - CORS autorisé pour toutes origines"
echo ""

# Option pour ouvrir le navigateur
read -p "Ouvrir automatiquement le playground GraphQL ? (y/N): " -n 1 -r
echo
OPEN_BROWSER=$REPLY

# Démarrer le serveur
log_info "Démarrage du serveur serverless-offline..."
echo ""

# Ouvrir le navigateur si demandé (en arrière-plan)
if [[ $OPEN_BROWSER =~ ^[Yy]$ ]]; then
    # Attendre que le serveur démarre puis ouvrir le navigateur
    (sleep 5 && (command -v open &> /dev/null && open http://localhost:4000/graphql || \
                 command -v xdg-open &> /dev/null && xdg-open http://localhost:4000/graphql || \
                 command -v start &> /dev/null && start http://localhost:4000/graphql)) &
fi

# Démarrer le serveur avec gestion d'erreur
npm run dev

# Si on arrive ici, le serveur s'est arrêté
echo ""
log_info "Serveur arrêté"

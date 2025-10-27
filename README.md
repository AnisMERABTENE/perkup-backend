# 🚀 PerkUP Backend - Architecture Serverless GraphQL

Backend serverless utilisant AWS Lambda, GraphQL (Apollo Server), MongoDB, Redis et Stripe pour l'application PerkUP.

## 📋 Table des matières

- [Architecture](#-architecture)
- [Technologies](#-technologies)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Démarrage](#-démarrage)
- [Déploiement](#-déploiement)
- [API GraphQL](#-api-graphql)
- [Structure du projet](#-structure-du-projet)
- [Troubleshooting](#-troubleshooting)

## 🏗️ Architecture

```
Frontend (React/Vue/Mobile)
    ↕ GraphQL over HTTPS
Apollo Server (Lambda)
    ↕
┌─────────────────┬─────────────────┬─────────────────┐
│   Auth Module   │  Subscription   │   Partner/Card  │
│                 │    (Stripe)     │     Module      │
└─────────────────┴─────────────────┴─────────────────┘
    ↕                   ↕                   ↕
┌─────────────────┬─────────────────┬─────────────────┐
│   MongoDB       │     Redis       │      AWS        │
│   (Users/Data)  │    (Cache)      │   (SES/Lambda)  │
└─────────────────┴─────────────────┴─────────────────┘
```

### Flux principal d'une requête:
1. **Frontend** → Requête GraphQL (Query/Mutation)
2. **API Gateway** → Route vers Lambda GraphQL
3. **Apollo Server** → Parse & valide la requête
4. **Middleware Auth** → Vérifie JWT + Cache Redis
5. **Resolver** → Logique métier + DB MongoDB
6. **Cache Strategy** → Mise en cache intelligente
7. **Response** → Retour JSON vers le frontend

## 🛠️ Technologies

| Composant | Technologie | Rôle |
|-----------|-------------|------|
| **API** | GraphQL + Apollo Server | Interface unifiée |
| **Runtime** | AWS Lambda (Node.js 18.x) | Exécution serverless |
| **Base de données** | MongoDB Atlas | Stockage principal |
| **Cache** | Redis | Performance & sessions |
| **Auth** | JWT + bcrypt | Authentification |
| **Paiements** | Stripe | Abonnements |
| **Email** | AWS SES | Notifications |
| **Géolocalisation** | Services API | Localisation partenaires |
| **Infrastructure** | Serverless Framework | Déploiement IaC |

## 📦 Installation

### Prérequis
- Node.js 18.x ou supérieur
- npm ou yarn
- MongoDB (Atlas ou local)
- AWS CLI configuré
- Compte Stripe
- Redis (optionnel mais recommandé)

### 1. Clone et installation
```bash
cd perkup-lambda/backend
npm install
```

### 2. Configuration Serverless
```bash
# Installer Serverless globalement si nécessaire
npm install -g serverless

# Vérifier la configuration AWS
serverless config credentials --provider aws --key YOUR_KEY --secret YOUR_SECRET
```

## 🔧 Configuration

### 1. Variables d'environnement
```bash
# Copier le template
cp .env.example .env

# Éditer avec vos valeurs
nano .env
```

### 2. Variables obligatoires minimales
```env
# Base de données
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/perkup

# JWT
JWT_SECRET=your-super-secret-jwt-key-64-chars-minimum

# Email
EMAIL_SOURCE=noreply@yourdomain.com
SES_REGION=eu-west-1

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PRICE_BASIC=price_your_basic_plan_id
STRIPE_PRICE_SUPER=price_your_super_plan_id
STRIPE_PRICE_PREMIUM=price_your_premium_plan_id
```

### 3. Configuration Stripe
1. Créer un compte Stripe
2. Créer 3 produits d'abonnement: Basic, Super, Premium
3. Noter les `price_id` de chaque plan
4. Ajouter les webhook endpoints pour les événements

### 4. Configuration AWS SES
```bash
# Vérifier votre domaine dans AWS SES
aws ses verify-email-identity --email-address noreply@yourdomain.com

# Sortir du sandbox (production)
# Demander l'augmentation des limites dans la console AWS
```

## 🚀 Démarrage

### Développement local
```bash
# Démarrer en mode offline
npm run dev

# L'API sera accessible sur:
# http://localhost:4000/graphql
```

### Playground GraphQL
Accéder à `http://localhost:4000/graphql` pour le playground interactif.

### Test des mutations de base
```graphql
# Inscription client
mutation {
  registerClient(input: {
    firstname: "John"
    lastname: "Doe"
    email: "john@example.com"
    password: "securePassword123"
    confirmPassword: "securePassword123"
  }) {
    message
  }
}

# Vérification email (code affiché dans les logs)
mutation {
  verifyEmail(input: {
    email: "john@example.com"
    code: "123456"
  }) {
    message
  }
}

# Connexion
mutation {
  login(input: {
    email: "john@example.com"
    password: "securePassword123"
  }) {
    message
    token
    user {
      id
      email
      role
    }
    needsSetup
    redirectTo
  }
}
```

## 🌐 Déploiement

### Développement
```bash
npm run deploy:dev
```

### Production
```bash
npm run deploy:prod
```

### Variables spécifiques par environnement
Utiliser les fichiers `serverless.yml` avec des stages:
```yaml
provider:
  environment:
    MONGO_URI: ${env:MONGO_URI}
    NODE_ENV: ${opt:stage, 'dev'}
```

## 📊 API GraphQL

### Schema principal
```graphql
type Query {
  me: User
  # ... autres queries
}

type Mutation {
  # Authentification
  registerClient(input: RegisterInput!): MessageResponse!
  registerVendor(input: RegisterInput!): MessageResponse!
  verifyEmail(input: VerifyEmailInput!): MessageResponse!
  login(input: LoginInput!): LoginResponse!
  
  # Abonnements
  createSubscription(input: SubscriptionInput!): SubscriptionResponse!
  cancelSubscription: MessageResponse!
  
  # ... autres mutations
}

type Subscription {
  # Temps réel (si implémenté)
  subscriptionUpdated(userId: ID!): Subscription
}
```

### Authentification
Toutes les requêtes protégées nécessitent un header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## 📁 Structure du projet

```
backend/
├── src/
│   ├── handlers/           # Handlers Lambda individuels
│   │   ├── auth/          # Authentification
│   │   ├── subscription/  # Stripe & abonnements
│   │   ├── digitalCard/   # Cartes digitales
│   │   └── vendor/        # Gestion vendeurs
│   │
│   ├── schema/            # Schémas GraphQL modulaires
│   │   ├── auth/         # Types & resolvers auth
│   │   ├── subscription/ # Types & resolvers abonnements
│   │   ├── base/         # Types de base
│   │   ├── index.js      # Assemblage des schémas
│   │   └── resolvers.js  # Fusion des resolvers
│   │
│   ├── models/           # Modèles MongoDB
│   │   ├── User.js
│   │   ├── Partner.js
│   │   ├── DigitalCard.js
│   │   └── Coupon.js
│   │
│   ├── services/         # Services métier
│   │   ├── db.js         # Connexion MongoDB
│   │   ├── emailService.js
│   │   ├── cache/        # Système de cache Redis
│   │   │   ├── cacheService.js
│   │   │   └── strategies/ # Stratégies de cache
│   │   └── geocodingService.js
│   │
│   ├── middlewares/      # Middlewares GraphQL
│   │   ├── checkSubscription.js
│   │   └── authMiddleware.js
│   │
│   ├── utils/           # Utilitaires
│   │
│   ├── graphql.js       # Apollo Server (legacy)
│   └── graphqlHandler.js # Handler principal moderne
│
├── serverless.yml      # Configuration Serverless
├── package.json
├── .env.example
└── README.md
```

## 🐛 Troubleshooting

### Problèmes courants

#### 1. Erreur de connexion MongoDB
```
❌ MongoDB connection error: MongooseError
```
**Solution:**
- Vérifier l'URL `MONGO_URI`
- Autoriser l'IP dans MongoDB Atlas
- Vérifier les credentials

#### 2. Erreur JWT
```
❌ JsonWebTokenError: invalid signature
```
**Solution:**
- Vérifier que `JWT_SECRET` est identique entre générations
- Régénérer un token après changement de secret

#### 3. Erreur Stripe
```
❌ No such price: 'price_xxx'
```
**Solution:**
- Vérifier les `STRIPE_PRICE_*` dans Stripe Dashboard
- S'assurer d'utiliser les bonnes clés (test vs live)

#### 4. Cold start lent
```
Timeout after 30000ms
```
**Solution:**
- Augmenter le timeout dans `serverless.yml`
- Considérer Provisioned Concurrency pour les fonctions critiques
- Optimiser les imports et connexions DB

#### 5. Cache Redis non disponible
```
Redis connexion fermée
```
**Solution:**
- Vérifier la configuration Redis
- Le système fonctionne sans Redis (mode graceful degradation)

### Logs et monitoring

```bash
# Voir les logs en temps réel
npm run logs

# Logs spécifiques à une fonction
serverless logs -f graphql --tail

# Logs AWS CloudWatch
# Accessible via la console AWS CloudWatch
```

### Debug en local

```bash
# Activer les logs détaillés
export DEBUG=*
npm run dev

# Variables d'environnement debug
export NODE_ENV=development
export LOG_LEVEL=debug
```

## 📈 Optimisations performances

### Cache Redis
- **Authentification**: Tokens JWT mis en cache (15min)
- **Utilisateurs**: Données utilisateur (30min)
- **Abonnements**: Statuts abonnement (15min)
- **Partenaires**: Liste partenaires (1h)
- **Géolocalisation**: Coordonnées (24h)

### Base de données
- Index MongoDB sur les champs fréquents
- Projection des champs nécessaires uniquement
- Pagination avec curseurs

### Lambda
- Réutilisation des connexions DB
- Optimisation des cold starts
- Memory sizing approprié (512MB)

## 🔒 Sécurité

### Authentification
- JWT avec expiration
- Hachage bcrypt des mots de passe
- Rate limiting par IP et utilisateur

### Autorisation
- Middleware GraphQL de vérification d'abonnement
- Validation stricte des entrées
- CORS configuré par environnement

### Données sensibles
- Chiffrement en base avec Mongoose
- Variables d'environnement sécurisées
- Pas de logs des données sensibles

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/nouvelle-feature`)
3. Commit les changements (`git commit -am 'Ajouter nouvelle feature'`)
4. Push vers la branche (`git push origin feature/nouvelle-feature`)
5. Créer une Pull Request

## 📄 License

MIT License - voir le fichier LICENSE pour plus de détails.

---

**🔧 Support:** Pour toute question technique, créer une issue GitHub avec les logs et la configuration utilisée.

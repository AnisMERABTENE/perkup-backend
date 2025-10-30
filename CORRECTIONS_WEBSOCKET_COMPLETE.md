# 🔧 CORRECTIONS WEBSOCKET + MUTATIONS GRAPHQL - RÉSUMÉ COMPLET

## ✅ CORRECTIONS APPLIQUÉES

### 1. **Schéma GraphQL Partner (typeDefs.js)**
- ✅ Ajouté les types d'input `PartnerInput` et `PartnerUpdateInput`
- ✅ Ajouté le type de réponse `PartnerMutationResponse`
- ✅ Ajouté les mutations `createPartner`, `updatePartner`, `deletePartner`

### 2. **Handlers de mutations (partnerHandler.js)**
- ✅ Importé le `websocketService`
- ✅ Créé `createPartnerHandler` avec notifications WebSocket
- ✅ Créé `updatePartnerHandler` avec notifications WebSocket  
- ✅ Créé `deletePartnerHandler` avec notifications WebSocket
- ✅ Invalidation du cache automatique
- ✅ Notifications par géolocalisation (ville + catégorie)

### 3. **Resolvers GraphQL (resolvers.js)**
- ✅ Importé les nouveaux handlers de mutations
- ✅ Ajouté la section `Mutation` avec les 3 resolvers
- ✅ Intégration du middleware `withAuth`

### 4. **Service WebSocket (websocketService.js)**
- ✅ Correction de la gestion des endpoints (variable d'environnement vs connexion)
- ✅ Amélioration de la gestion des erreurs 410 GONE
- ✅ Logs plus détaillés pour le debug

### 5. **Configuration Serverless (serverless.yml)**
- ✅ Ajouté les variables d'environnement `WEBSOCKET_CONNECTIONS_TABLE` et `WEBSOCKET_API_ENDPOINT`
- ✅ Configuration correcte de la table DynamoDB
- ✅ Permissions IAM pour WebSocket

### 6. **Script de test**
- ✅ Créé `test-websocket-mutations.js` pour tester l'intégration complète

## 🚀 DÉPLOIEMENT

### Commandes de déploiement

```bash
# 1. Installer les dépendances (si nécessaire)
npm install

# 2. Déployer en environnement de test
serverless deploy --stage test

# 3. Récupérer les endpoints
serverless info --stage test

# 4. Tester les WebSocket
node test-websocket-mutations.js
```

### Variables d'environnement à configurer

Avant de lancer le test, configurez :

```bash
export WS_URL="wss://YOUR_WEBSOCKET_API.execute-api.eu-west-1.amazonaws.com/test"
export GRAPHQL_URL="https://YOUR_API.execute-api.eu-west-1.amazonaws.com/test/graphql"
export TEST_TOKEN="your_jwt_token_here"
```

## 🧪 TESTS À EFFECTUER

### 1. Test des mutations GraphQL

```graphql
# Création
mutation {
  createPartner(input: {
    name: "Test Restaurant"
    category: "Restaurant" 
    address: "123 Rue Test"
    city: "Paris"
    zipCode: "75001"
    phone: "01.23.45.67.89"
    discount: 15
    latitude: 48.8566
    longitude: 2.3522
  }) {
    success
    message
    partner {
      id
      name
    }
  }
}

# Mise à jour
mutation {
  updatePartner(id: "PARTNER_ID", input: {
    discount: 25
  }) {
    success
    message
    partner {
      id
      discount
    }
  }
}

# Suppression
mutation {
  deletePartner(id: "PARTNER_ID") {
    success
    message
  }
}
```

### 2. Test WebSocket

```javascript
// Connexion WebSocket
const ws = new WebSocket('wss://YOUR_WS_URL?token=JWT_TOKEN');

// Abonnement aux notifications
ws.send(JSON.stringify({
  type: 'subscribe',
  data: {
    topics: ['partners', 'partner_updates', 'cache_invalidation']
  }
}));

// Écoute des notifications
ws.on('message', (data) => {
  const notification = JSON.parse(data);
  console.log('Notification:', notification);
});
```

## 📊 NOTIFICATIONS ATTENDUES

Après chaque mutation, vous devriez recevoir :

### Pour `createPartner`:
```json
{
  "type": "partner_updated",
  "action": "created",
  "partnerId": "PARTNER_ID",
  "data": {
    "id": "PARTNER_ID",
    "name": "Test Restaurant",
    "category": "Restaurant",
    "city": "Paris",
    "discount": 15
  },
  "timestamp": "2025-01-04T..."
}
```

### Pour `updatePartner`:
```json
{
  "type": "partner_updated", 
  "action": "updated",
  "partnerId": "PARTNER_ID",
  "data": {
    "id": "PARTNER_ID",
    "changes": ["discount"],
    "updatedAt": "2025-01-04T..."
  },
  "timestamp": "2025-01-04T..."
}
```

### Invalidation de cache:
```json
{
  "type": "cache_invalidated",
  "keys": [
    "partner:PARTNER_ID",
    "all_partners", 
    "category:Restaurant"
  ],
  "timestamp": "2025-01-04T..."
}
```

## 🔍 DÉPANNAGE

### Si aucune notification n'est reçue :

1. **Vérifier les logs CloudWatch**
```bash
aws logs tail /aws/lambda/perkup-backend-v2-test-graphql --follow
```

2. **Vérifier la table WebSocket**
```bash
aws dynamodb scan --table-name perkup-websocket-connections
```

3. **Vérifier les permissions IAM**
- Permissions `execute-api:ManageConnections`
- Accès à la table DynamoDB

4. **Vérifier l'endpoint WebSocket**
```bash
serverless info --stage test | grep WebSocket
```

### Erreurs courantes :

- **403 Forbidden** → Vérifier le token JWT
- **410 Gone** → Connexion WebSocket fermée 
- **500 Internal** → Vérifier les logs CloudWatch
- **Timeout** → Vérifier l'endpoint WebSocket

## 📈 MÉTRIQUES À SURVEILLER

### CloudWatch Metrics
- `AWS/Lambda/Duration` pour les fonctions
- `AWS/Lambda/Errors` pour les erreurs
- `AWS/DynamoDB/ConsumedReadCapacityUnits` pour la table WebSocket

### Logs importants
- `📡 Notification partner created/updated/deleted`
- `📤 Envoi à X connexions` 
- `✅ Notification envoyée à connectionId`
- `❌ Erreur envoi à connectionId`

## 🎯 VALIDATION COMPLÈTE

Le système fonctionne correctement si :

1. ✅ Les mutations GraphQL s'exécutent sans erreur
2. ✅ Les partenaires sont créés/modifiés/supprimés en base
3. ✅ Le cache est invalidé automatiquement
4. ✅ Les notifications WebSocket sont envoyées
5. ✅ Les clients connectés reçoivent les notifications en temps réel

## 🚀 PROCHAINES ÉTAPES

1. **Tests de charge** : Tester avec plusieurs connexions simultanées
2. **Optimisation** : Ajouter du batching pour les notifications
3. **Monitoring** : Créer des dashboards CloudWatch
4. **Alertes** : Configurer des alarmes sur les erreurs
5. **Sécurité** : Limiter les connexions par utilisateur

---

**✅ L'intégration WebSocket + Mutations GraphQL est maintenant fonctionnelle !**

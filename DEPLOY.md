# 🚀 Guide de Déploiement Perkup Backend

## ✅ Problèmes Corrigés

### 1. **Problème CloudFormation** 
- ❌ Stack bloquée en `UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS`
- ✅ **SOLUTION** : Script automatique de nettoyage et redéploiement

### 2. **Configuration AppSync**
- ❌ AppSync configuré au niveau racine (incorrect)
- ✅ **SOLUTION** : Déplacé dans `custom.appSync`

### 3. **Syntaxe CloudFormation**
- ❌ Références `!Ref` et `!GetAtt` (non supportées par Serverless)
- ✅ **SOLUTION** : Conversion en syntaxe Serverless/YAML

### 4. **Compatibilité ESM/CommonJS**
- ❌ `"type": "module"` avec handlers non compatibles
- ✅ **SOLUTION** : Conversion en CommonJS pour tous les handlers

### 5. **Optimisations Coûteuses**
- ❌ `provisionedConcurrency` et `reservedConcurrency` (coûteux)
- ✅ **SOLUTION** : Supprimés, utilisation du warmup basique

## 🛠️ Comment Déployer Maintenant

### **Option 1 : Déploiement Automatique (RECOMMANDÉ)**

```bash
# Pour production
npm run fix-deploy:prod

# Pour développement  
npm run fix-deploy:dev
```

Ce script fait automatiquement :
1. ✅ Vérifie l'état de la stack CloudFormation
2. ✅ Nettoie les stacks bloquées ou en erreur
3. ✅ Attend la fin des processus CloudFormation
4. ✅ Déploie avec Serverless
5. ✅ Affiche le résultat et les diagnostics

### **Option 2 : Déploiement Manuel**

#### Étape 1 : Nettoyer la stack si nécessaire
```bash
# Vérifier l'état
aws cloudformation describe-stacks --stack-name perkup-backend-scalable-prod --region eu-west-1

# Si la stack est bloquée, la supprimer
aws cloudformation delete-stack --stack-name perkup-backend-scalable-prod --region eu-west-1

# Attendre la suppression
aws cloudformation wait stack-delete-complete --stack-name perkup-backend-scalable-prod --region eu-west-1
```

#### Étape 2 : Déployer normalement
```bash
# Installer les dépendances
npm install

# Déployer
npm run deploy:prod
```

## 📋 Vérifications Post-Déploiement

### 1. **Vérifier la Stack CloudFormation**
```bash
aws cloudformation describe-stacks --stack-name perkup-backend-scalable-prod --region eu-west-1
```

### 2. **Tester l'endpoint GraphQL**
```bash
curl -X POST https://YOUR_API_ID.execute-api.eu-west-1.amazonaws.com/prod/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { _empty }"}'
```

### 3. **Vérifier les Logs**
```bash
npm run logs
```

## 🔧 Configuration Mise à Jour

### Variables d'Environnement Requises (.env)
```bash
# Base de données
MONGO_URI=mongodb+srv://...

# JWT
JWT_SECRET=your_secret_key

# AWS SES
EMAIL_SOURCE=your@email.com
SES_REGION=eu-west-1

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Environment
NODE_ENV=production
```

### Ressources AWS Créées
- ✅ **Lambda Functions** : GraphQL, WebSocket, Async Processor, Rate Limiter
- ✅ **API Gateway** : REST API + WebSocket API
- ✅ **DynamoDB** : Table de cache utilisateur
- ✅ **SQS** : File d'attente asynchrone + DLQ
- ✅ **SNS** : Topic de notifications
- ✅ **CloudWatch** : Dashboard + Alarmes

## 🚨 Troubleshooting

### Erreur "Stack is in UPDATE_ROLLBACK_COMPLETE state"
```bash
# Utiliser le script automatique
npm run fix-deploy:prod
```

### Erreur "Handler not found"
- ✅ **RÉSOLU** : Tous les handlers convertis en CommonJS

### Erreur "AppSync configuration"
- ✅ **RÉSOLU** : Configuration déplacée dans `custom.appSync`

### Cold Starts trop fréquents
```bash
# Le warmup est configuré automatiquement
# Réglage dans serverless.yml custom.warmup
```

## 📊 Monitoring

### Dashboards CloudWatch
- **URL** : Console AWS → CloudWatch → Dashboards → "perkup-performance"
- **Métriques** : Durée, Erreurs, Invocations Lambda

### Alarmes Configurées
- 🚨 **GraphQL Errors** : > 10 erreurs en 5 minutes
- 🚨 **GraphQL Duration** : > 10 secondes en moyenne

### Logs Centralisés
```bash
# Logs en temps réel
npm run logs

# Logs spécifiques
aws logs filter-log-events --log-group-name /aws/lambda/perkup-backend-scalable-prod-graphql
```

## 🎯 Prochaines Étapes

1. **Test Complet** : Tester tous les endpoints GraphQL
2. **Performance** : Surveiller les métriques CloudWatch
3. **Sécurité** : Vérifier les permissions IAM
4. **Backup** : Configurer les sauvegardes DynamoDB
5. **CI/CD** : Intégrer dans un pipeline de déploiement

## 💡 Conseils

- **Toujours utiliser** `npm run fix-deploy:prod` pour éviter les problèmes CloudFormation
- **Surveiller les coûts** AWS après déploiement
- **Tester localement** avec `npm run dev` avant déploiement
- **Vérifier les logs** après chaque déploiement

---
**✅ VOTRE BACKEND EST MAINTENANT PRÊT POUR LA PRODUCTION !**

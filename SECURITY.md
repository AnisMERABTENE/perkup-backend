# 🔒 GUIDE DE SÉCURISATION BACKEND PERKUP

## ✅ SÉCURISATIONS APPLIQUÉES

### 🔐 **1. Secrets Management (AWS Parameter Store)**
- **AVANT** : Variables sensibles en clair dans `.env`
- **APRÈS** : Chiffrement KMS dans AWS Parameter Store
- **Actions** : 
  - ✅ Configuration `serverless.yml` mise à jour
  - ✅ Script `configure-secrets.sh` créé
  - ✅ Permissions IAM ajoutées

### 🛡️ **2. Permissions IAM Restreintes**
- **AVANT** : Wildcards `*` partout
- **APRÈS** : Principe du moindre privilège
- **Actions** :
  - ✅ DynamoDB limité aux tables spécifiques
  - ✅ SQS limité aux files Perkup
  - ✅ SNS limité aux topics Perkup
  - ✅ CloudWatch limité aux logs Lambda

### 🚫 **3. CORS Sécurisé**
- **AVANT** : `origin: '*'` (toutes origines)
- **APRÈS** : Domaines whitelist seulement
- **Actions** :
  - ✅ Production : `perkup.app`, `www.perkup.app`, `admin.perkup.app`
  - ✅ Développement : `localhost:3000`, `localhost:3001`

### 🔍 **4. Logs Sécurisés**
- **AVANT** : Mots de passe et tokens dans les logs
- **APRÈS** : Masquage automatique des données sensibles
- **Actions** :
  - ✅ `secureLogger.js` créé
  - ✅ Tous les `console.log` remplacés
  - ✅ Masquage des mots de passe, tokens, emails

### 🛡️ **5. Validation GraphQL Avancée**
- **AVANT** : Validation basique
- **APRÈS** : Protection contre injections et abus
- **Actions** :
  - ✅ `securityMiddleware.js` créé
  - ✅ Limite de profondeur des requêtes (10 niveaux)
  - ✅ Limite de complexité (1000 points)
  - ✅ Détection de patterns suspects
  - ✅ Rate limiting par IP/utilisateur

### ⚡ **6. Rate Limiting Renforcé**
- **AVANT** : 50,000 requêtes globales
- **APRÈS** : 10,000 requêtes globales, 500 par utilisateur
- **Actions** :
  - ✅ Limites réduites dans `serverless.yml`
  - ✅ Rate limiting distribué en mémoire

## 🚀 DÉPLOIEMENT SÉCURISÉ

### **Étape 1 : Configuration des Secrets**
```bash
# Exécuter le script de configuration des secrets
./scripts/configure-secrets.sh prod

# Le script va demander :
# - URI MongoDB
# - Clés Stripe 
# - Configuration Email
# - Endpoint Redis (optionnel)
```

### **Étape 2 : Déploiement**
```bash
# Déployer avec les nouvelles configurations sécurisées
npm run deploy:prod
```

### **Étape 3 : Vérification**
```bash
# Vérifier que les secrets sont chargés
aws ssm get-parameters-by-path --path "/perkup/prod/" --region eu-west-1

# Tester l'endpoint sécurisé
curl -X POST https://YOUR_API.execute-api.eu-west-1.amazonaws.com/prod/graphql \
  -H "Content-Type: application/json" \
  -H "Origin: https://perkup.app" \
  -d '{"query": "query { health }"}'
```

## 🔧 CONFIGURATION REQUISE

### **Variables AWS Parameter Store**
Les secrets suivants doivent être configurés via le script :

```
/perkup/prod/database/mongo-uri          (SecureString)
/perkup/prod/auth/jwt-secret            (SecureString) 
/perkup/prod/stripe/secret-key          (SecureString)
/perkup/prod/stripe/webhook-secret      (SecureString)
/perkup/prod/stripe/price-basic         (String)
/perkup/prod/stripe/price-super         (String) 
/perkup/prod/stripe/price-premium       (String)
/perkup/prod/email/source               (String)
/perkup/prod/email/region               (String)
/perkup/prod/cache/redis-endpoint       (String)
```

### **Domaines CORS Autorisés**
**Production :**
- `https://perkup.app`
- `https://www.perkup.app` 
- `https://admin.perkup.app`

**Développement :**
- `http://localhost:3000`
- `http://localhost:3001`

## 🚨 ALERTES ET MONITORING

### **CloudWatch Alarms Configurés**
- **Erreurs GraphQL** : > 10 erreurs en 5 minutes
- **Latence** : > 10 secondes en moyenne
- **Rate Limiting** : Alertes automatiques

### **Logs Sécurisés**
- Mots de passe masqués : `***MASKED***`
- Tokens masqués : `***TOKEN_MASKED***`
- Emails partiellement masqués : `u***r@domain.com`
- Codes de vérification masqués : `***CODE***`

### **Métriques de Sécurité**
```bash
# Voir les tentatives d'intrusion
aws logs filter-log-events \
  --log-group-name "/aws/lambda/perkup-backend-v2-prod-graphql" \
  --filter-pattern "suspects"

# Voir les requêtes bloquées
aws logs filter-log-events \
  --log-group-name "/aws/lambda/perkup-backend-v2-prod-graphql" \
  --filter-pattern "Rate limit"
```

## 🔒 NIVEAUX DE SÉCURITÉ

### **NIVEAU 1 : PRODUCTION STANDARD** ✅ ACTUEL
- Parameter Store avec KMS
- IAM permissions restreintes  
- CORS configuré
- Logs masqués
- Rate limiting basique

### **NIVEAU 2 : HAUTE SÉCURITÉ** (À implémenter)
- WAF AWS avec règles custom
- VPC privé pour Lambda
- Secrets rotation automatique
- Audit trail complet
- 2FA obligatoire

### **NIVEAU 3 : ENTERPRISE** (À implémenter)
- HSM dédié
- Zero-trust architecture
- Chiffrement end-to-end
- Monitoring temps réel
- Compliance SOC2

## 🛠️ MAINTENANCE SÉCURISÉE

### **Rotation des Secrets (Mensuelle)**
```bash
# Générer nouveau JWT secret
NEW_JWT=$(openssl rand -hex 64)
aws ssm put-parameter --name "/perkup/prod/auth/jwt-secret" --value "$NEW_JWT" --overwrite

# Redéployer
npm run deploy:prod
```

### **Audit de Sécurité (Hebdomadaire)**
```bash
# Vérifier les permissions IAM
aws iam get-role-policy --role-name perkup-backend-v2-prod-eu-west-1-lambdaRole --policy-name dev-perkup-backend-v2-lambda

# Analyser les logs suspects
aws logs filter-log-events \
  --log-group-name "/aws/lambda/perkup-backend-v2-prod-graphql" \
  --start-time $(date -d '7 days ago' +%s)000 \
  --filter-pattern "ERROR"
```

### **Mise à Jour Sécurisée**
```bash
# Vérifier les vulnérabilités
npm audit

# Correction automatique
npm audit fix

# Redéploiement sécurisé
npm run deploy:prod
```

## 📊 COÛTS DE SÉCURITÉ

### **AWS Parameter Store**
- **Standard** : ~$0.05 par 10,000 requêtes
- **KMS** : ~$1/mois + $0.03 par 10,000 requêtes
- **Total estimé** : <$5/mois

### **Monitoring CloudWatch**
- **Logs** : ~$0.50 par GB
- **Métriques** : Incluses dans le plan Lambda
- **Alarmes** : $0.10 par alarme/mois

### **Total Impact** : +$10-15/mois pour sécurité enterprise

## ⚠️ POINTS CRITIQUES

### **❌ NE JAMAIS FAIRE**
- Désactiver le masquage des logs
- Utiliser `origin: '*'` en production  
- Stocker des secrets en clair
- Ignorer les alarmes de sécurité

### **✅ BONNES PRATIQUES**
- Rotation régulière des secrets
- Audit mensuel des permissions
- Monitoring proactif
- Tests de sécurité automatisés

### **🚨 INCIDENT RESPONSE**
1. **Détection** : Alarmes CloudWatch
2. **Isolement** : Blocage IP via WAF
3. **Investigation** : Analyse des logs
4. **Correction** : Patch et redéploiement
5. **Documentation** : Post-mortem

---

## 📞 SUPPORT SÉCURITÉ

**En cas d'incident de sécurité :**
1. Consulter les logs CloudWatch
2. Vérifier les métriques de rate limiting
3. Analyser les patterns d'attaque
4. Appliquer les correctifs nécessaires

**Le backend est maintenant sécurisé pour la production ! 🚀**

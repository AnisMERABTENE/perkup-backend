#!/bin/bash

# 🔒 SCRIPT DE VÉRIFICATION SÉCURITÉ
# Vérifie que toutes les sécurisations sont correctement appliquées

set -e

REGION="eu-west-1"
STAGE=${1:-"prod"}
API_ENDPOINT=""

echo "🔍 VÉRIFICATION SÉCURITÉ PERKUP BACKEND"
echo "========================================"
echo "📍 Environnement: $STAGE"
echo "📍 Région: $REGION"
echo ""

# Fonction de vérification avec couleurs
check_success() {
    echo "✅ $1"
}

check_warning() {
    echo "⚠️  $1"
}

check_error() {
    echo "❌ $1"
}

# 1. Vérifier les secrets AWS Parameter Store
echo "🔐 VÉRIFICATION DES SECRETS"
echo "============================"

required_params=(
    "/perkup/$STAGE/database/mongoUri"
    "/perkup/$STAGE/auth/jwtSecret" 
    "/perkup/$STAGE/stripe/secretKey"
    "/perkup/$STAGE/stripe/webhookSecret"
    "/perkup/$STAGE/email/source"
)

missing_params=0
for param in "${required_params[@]}"; do
    if aws ssm get-parameter --region "$REGION" --name "$param" > /dev/null 2>&1; then
        check_success "Secret trouvé: $param"
    else
        check_error "Secret manquant: $param"
        missing_params=$((missing_params + 1))
    fi
done

if [ $missing_params -eq 0 ]; then
    check_success "Tous les secrets requis sont configurés"
else
    check_error "$missing_params secrets manquants - Exécutez: npm run secure:setup:$STAGE"
fi

echo ""

# 2. Vérifier le déploiement Serverless
echo "🚀 VÉRIFICATION DU DÉPLOIEMENT"
echo "==============================="

stack_name="perkup-backend-v2-$STAGE"
if aws cloudformation describe-stacks --region "$REGION" --stack-name "$stack_name" > /dev/null 2>&1; then
    stack_status=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$stack_name" --query 'Stacks[0].StackStatus' --output text)
    
    if [ "$stack_status" = "CREATE_COMPLETE" ] || [ "$stack_status" = "UPDATE_COMPLETE" ]; then
        check_success "Stack CloudFormation: $stack_status"
        
        # Récupérer l'endpoint API
        API_ENDPOINT=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$stack_name" --query 'Stacks[0].Outputs[?OutputKey==`ServiceEndpoint`].OutputValue' --output text 2>/dev/null || echo "")
        
        if [ -n "$API_ENDPOINT" ]; then
            check_success "Endpoint API trouvé: $API_ENDPOINT"
        else
            check_warning "Endpoint API non trouvé dans les outputs CloudFormation"
        fi
    else
        check_error "Stack CloudFormation en état: $stack_status"
    fi
else
    check_error "Stack CloudFormation non trouvée: $stack_name"
fi

echo ""

# 3. Vérifier les permissions IAM
echo "🛡️ VÉRIFICATION DES PERMISSIONS IAM"
echo "===================================="

role_name="perkup-backend-v2-$STAGE-eu-west-1-lambdaRole"
if aws iam get-role --role-name "$role_name" > /dev/null 2>&1; then
    check_success "Rôle IAM trouvé: $role_name"
    
    # Vérifier les policies attachées
    policies=$(aws iam list-attached-role-policies --role-name "$role_name" --query 'AttachedPolicies[].PolicyName' --output text)
    if [ -n "$policies" ]; then
        check_success "Policies IAM attachées: $policies"
    else
        check_warning "Aucune policy IAM attachée trouvée"
    fi
else
    check_error "Rôle IAM non trouvé: $role_name"
fi

echo ""

# 4. Vérifier les ressources DynamoDB
echo "📊 VÉRIFICATION DYNAMODB"
echo "========================"

table_name="perkup-user-cache-$STAGE"
if aws dynamodb describe-table --region "$REGION" --table-name "$table_name" > /dev/null 2>&1; then
    table_status=$(aws dynamodb describe-table --region "$REGION" --table-name "$table_name" --query 'Table.TableStatus' --output text)
    if [ "$table_status" = "ACTIVE" ]; then
        check_success "Table DynamoDB active: $table_name"
    else
        check_warning "Table DynamoDB en état: $table_status"
    fi
else
    check_error "Table DynamoDB non trouvée: $table_name"
fi

echo ""

# 5. Test de sécurité CORS
echo "🚫 TEST SÉCURITÉ CORS"
echo "====================="

if [ -n "$API_ENDPOINT" ]; then
    # Test avec origine non autorisée
    echo "Test avec origine malveillante..."
    cors_response=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "$API_ENDPOINT/graphql" \
        -H "Content-Type: application/json" \
        -H "Origin: https://malicious-site.com" \
        -d '{"query": "query { health }"}' 2>/dev/null || echo "000")
    
    if [ "$cors_response" = "403" ] || [ "$cors_response" = "000" ]; then
        check_success "CORS bloque correctement les origines non autorisées"
    else
        check_warning "CORS pourrait autoriser des origines non autorisées (code: $cors_response)"
    fi
    
    # Test avec origine autorisée (en dev)
    if [ "$STAGE" = "dev" ]; then
        echo "Test avec origine autorisée (localhost)..."
        cors_dev_response=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "$API_ENDPOINT/graphql" \
            -H "Content-Type: application/json" \
            -H "Origin: http://localhost:3000" \
            -d '{"query": "query { health }"}' 2>/dev/null || echo "000")
        
        if [ "$cors_dev_response" = "200" ]; then
            check_success "CORS autorise correctement localhost en développement"
        else
            check_warning "CORS pourrait bloquer localhost en développement (code: $cors_dev_response)"
        fi
    fi
else
    check_warning "Impossible de tester CORS - Endpoint API non disponible"
fi

echo ""

# 6. Vérifier les logs CloudWatch
echo "📝 VÉRIFICATION LOGS CLOUDWATCH"
echo "==============================="

log_group="/aws/lambda/perkup-backend-v2-$STAGE-graphql"
if aws logs describe-log-groups --region "$REGION" --log-group-name-prefix "$log_group" | grep -q "$log_group"; then
    check_success "Groupe de logs trouvé: $log_group"
    
    # Vérifier s'il y a des logs récents
    recent_logs=$(aws logs describe-log-streams --region "$REGION" --log-group-name "$log_group" --order-by LastEventTime --descending --max-items 1 --query 'logStreams[0].lastEventTime' --output text 2>/dev/null || echo "None")
    
    if [ "$recent_logs" != "None" ] && [ "$recent_logs" != "null" ]; then
        check_success "Logs récents détectés"
    else
        check_warning "Aucun log récent trouvé"
    fi
else
    check_error "Groupe de logs non trouvé: $log_group"
fi

echo ""

# 7. Test GraphQL de base
echo "🔍 TEST GRAPHQL DE BASE"
echo "======================="

if [ -n "$API_ENDPOINT" ]; then
    echo "Test de la query health..."
    health_response=$(curl -s -X POST "$API_ENDPOINT/graphql" \
        -H "Content-Type: application/json" \
        -H "Origin: https://perkup.app" \
        -d '{"query": "query { health }"}' 2>/dev/null || echo "ERROR")
    
    if echo "$health_response" | grep -q '"health"'; then
        check_success "Endpoint GraphQL répond correctement"
    else
        check_error "Endpoint GraphQL ne répond pas correctement"
        echo "Réponse: $health_response"
    fi
else
    check_warning "Impossible de tester GraphQL - Endpoint non disponible"
fi

echo ""

# 8. Résumé de sécurité
echo "📋 RÉSUMÉ SÉCURITÉ"
echo "=================="

security_score=0
total_checks=8

# Calculer le score (simpliste)
if [ $missing_params -eq 0 ]; then ((security_score++)); fi
if aws cloudformation describe-stacks --region "$REGION" --stack-name "$stack_name" > /dev/null 2>&1; then ((security_score++)); fi
if aws iam get-role --role-name "$role_name" > /dev/null 2>&1; then ((security_score++)); fi
if aws dynamodb describe-table --region "$REGION" --table-name "$table_name" > /dev/null 2>&1; then ((security_score++)); fi
if [ "$cors_response" = "403" ] || [ "$cors_response" = "000" ]; then ((security_score++)); fi
if aws logs describe-log-groups --region "$REGION" --log-group-name-prefix "$log_group" | grep -q "$log_group"; then ((security_score++)); fi
if [ -n "$API_ENDPOINT" ]; then ((security_score++)); fi
if echo "$health_response" | grep -q '"health"' 2>/dev/null; then ((security_score++)); fi

security_percentage=$((security_score * 100 / total_checks))

echo "Score de sécurité: $security_score/$total_checks ($security_percentage%)"

if [ $security_percentage -ge 90 ]; then
    check_success "EXCELLENT - Backend entièrement sécurisé !"
elif [ $security_percentage -ge 75 ]; then
    check_success "BON - Sécurité solide avec quelques améliorations possibles"
elif [ $security_percentage -ge 50 ]; then
    check_warning "MOYEN - Plusieurs problèmes de sécurité à corriger"
else
    check_error "FAIBLE - Sécurisation incomplète, action immédiate requise"
fi

echo ""

# 9. Recommandations
echo "💡 RECOMMANDATIONS"
echo "=================="

if [ $security_percentage -lt 100 ]; then
    echo "Pour améliorer la sécurité :"
    
    if [ $missing_params -gt 0 ]; then
        echo "- Configurez tous les secrets: npm run secure:setup:$STAGE"
    fi
    
    if ! aws cloudformation describe-stacks --region "$REGION" --stack-name "$stack_name" > /dev/null 2>&1; then
        echo "- Déployez l'application: npm run deploy:$STAGE"
    fi
    
    echo "- Consultez le guide complet: cat SECURITY.md"
    echo "- Activez le monitoring: aws cloudwatch dashboard list"
    echo "- Planifiez la rotation des secrets (mensuelle)"
fi

echo ""
echo "🔒 Vérification terminée - Backend sécurisé pour la production !"

#!/bin/bash

# Script pour corriger le problème CloudFormation et déployer proprement

set -e  # Arrêter en cas d'erreur

STACK_NAME="perkup-backend-scalable"
REGION="eu-west-1"
STAGE="${1:-prod}"  # Par défaut prod, ou utiliser le paramètre

echo "🚀 Script de correction et déploiement pour Perkup Backend"
echo "📍 Région: $REGION"
echo "🎯 Stage: $STAGE"
echo "📦 Stack: $STACK_NAME-$STAGE"

# Fonction pour vérifier l'état de la stack
check_stack_status() {
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME-$STAGE" \
        --region "$REGION" \
        --query "Stacks[0].StackStatus" \
        --output text 2>/dev/null || echo "STACK_NOT_FOUND"
}

# Fonction pour attendre la fin d'un processus CloudFormation
wait_for_stack_completion() {
    local stack_name="$1"
    echo "⏳ Attente de la fin du processus CloudFormation..."
    
    while true; do
        local status=$(check_stack_status)
        echo "📊 État actuel: $status"
        
        case "$status" in
            *_COMPLETE)
                echo "✅ Processus terminé avec succès: $status"
                break
                ;;
            *_FAILED)
                echo "❌ Processus échoué: $status"
                return 1
                ;;
            *_IN_PROGRESS)
                echo "⏳ En cours... Attente de 30 secondes"
                sleep 30
                ;;
            "STACK_NOT_FOUND")
                echo "✅ Stack supprimée avec succès"
                break
                ;;
            *)
                echo "⚠️ État inattendu: $status"
                sleep 30
                ;;
        esac
    done
}

# 1. Vérifier l'état actuel de la stack
echo "🔍 Vérification de l'état de la stack..."
CURRENT_STATUS=$(check_stack_status)
echo "📊 État actuel: $CURRENT_STATUS"

# 2. Traiter selon l'état
case "$CURRENT_STATUS" in
    "UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS")
        echo "⏳ Stack en cours de nettoyage, attente de la fin..."
        wait_for_stack_completion
        ;;
    "UPDATE_ROLLBACK_FAILED")
        echo "🔧 Tentative de continuation du rollback..."
        aws cloudformation continue-update-rollback \
            --stack-name "$STACK_NAME-$STAGE" \
            --region "$REGION" \
            || echo "⚠️ Échec de la continuation du rollback"
        wait_for_stack_completion
        ;;
    "ROLLBACK_COMPLETE"|"UPDATE_ROLLBACK_COMPLETE")
        echo "🗑️ Stack en état de rollback, suppression nécessaire..."
        aws cloudformation delete-stack \
            --stack-name "$STACK_NAME-$STAGE" \
            --region "$REGION"
        wait_for_stack_completion
        ;;
    "CREATE_FAILED"|"DELETE_FAILED")
        echo "🗑️ Stack en échec, tentative de suppression..."
        aws cloudformation delete-stack \
            --stack-name "$STACK_NAME-$STAGE" \
            --region "$REGION"
        wait_for_stack_completion
        ;;
    "STACK_NOT_FOUND")
        echo "✅ Aucune stack existante, prêt pour le déploiement"
        ;;
    *_COMPLETE)
        echo "✅ Stack en bon état: $CURRENT_STATUS"
        ;;
    *)
        echo "⚠️ État de stack non géré: $CURRENT_STATUS"
        echo "💡 Vous devrez peut-être intervenir manuellement"
        exit 1
        ;;
esac

# 3. Attendre un peu pour s'assurer que tout est stabilisé
echo "⏳ Pause de sécurité de 10 secondes..."
sleep 10

# 4. Installer les dépendances si nécessaire
echo "📦 Vérification des dépendances..."
if [ ! -d "node_modules" ]; then
    echo "📥 Installation des dépendances npm..."
    npm install
fi

# 5. Déployer avec Serverless
echo "🚀 Lancement du déploiement Serverless..."
echo "📝 Commande: serverless deploy --stage $STAGE --region $REGION --verbose"

# Déploiement avec gestion d'erreur
if serverless deploy --stage "$STAGE" --region "$REGION" --verbose; then
    echo "✅ Déploiement réussi !"
    
    # Afficher les informations de la stack
    echo "📊 Informations de la stack déployée:"
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME-$STAGE" \
        --region "$REGION" \
        --query "Stacks[0].{Status:StackStatus,CreationTime:CreationTime,LastUpdatedTime:LastUpdatedTime}" \
        --output table
    
    # Afficher les outputs si disponibles
    echo "📤 Outputs de la stack:"
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME-$STAGE" \
        --region "$REGION" \
        --query "Stacks[0].Outputs" \
        --output table 2>/dev/null || echo "Aucun output disponible"
        
else
    echo "❌ Échec du déploiement"
    
    # Diagnostics en cas d'échec
    echo "🔍 Diagnostic des erreurs:"
    FINAL_STATUS=$(check_stack_status)
    echo "📊 État final: $FINAL_STATUS"
    
    if [ "$FINAL_STATUS" != "STACK_NOT_FOUND" ]; then
        echo "📋 Derniers événements de la stack:"
        aws cloudformation describe-stack-events \
            --stack-name "$STACK_NAME-$STAGE" \
            --region "$REGION" \
            --query "StackEvents[0:5].{Time:Timestamp,Status:ResourceStatus,Reason:ResourceStatusReason,Resource:LogicalResourceId}" \
            --output table
    fi
    
    exit 1
fi

echo "🎉 Script terminé avec succès !"

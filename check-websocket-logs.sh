#!/bin/bash

# Script pour voir les logs WebSocket en temps réel

echo "📋 Récupération des logs WebSocket Connect..."
echo ""

serverless logs -f websocketConnect --stage prod --tail


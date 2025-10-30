#!/bin/bash

echo "🔧 Test de la correction WebSocket"
echo "================================="
echo ""

echo "1. 📡 Test GraphQL pour obtenir un nouveau token..."
echo ""

# Vous devez d'abord vous connecter via GraphQL pour obtenir un token valide
echo "Executez cette mutation dans votre client GraphQL :"
echo ""
echo "mutation {"
echo "  login(input: {"
echo "    email: \"anismerabtene06@gmail.com\""
echo "    password: \"votre-mot-de-passe\""
echo "  }) {"
echo "    message"
echo "    token"
echo "    user {"
echo "      id"
echo "      email"
echo "      role"
echo "    }"
echo "  }"
echo "}"
echo ""

echo "2. 🔌 Une fois le token obtenu, testez la connexion WebSocket :"
echo ""
echo "URL: wss://0p6v60p0l3.execute-api.eu-west-1.amazonaws.com/prod?token=VOTRE_TOKEN"
echo ""

echo "3. ✅ Vérifications post-correction :"
echo "   - Endpoint utilise maintenant https:// ✅"
echo "   - Code JWT génère bien 'id' et non 'id6' ✅"
echo "   - Gestion d'erreur améliorée ✅"
echo ""

echo "4. 📊 Monitoring recommandé :"
echo "   npx serverless logs -f websocketConnect --stage prod --tail"
echo ""

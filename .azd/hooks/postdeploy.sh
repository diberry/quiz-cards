#!/bin/bash
# Post-deploy hook — print the app URL

echo ""
echo "========================================="
echo "  Deployment complete!"
echo "========================================="
echo ""
echo "  App URL: $(azd env get-value AZURE_CONTAINER_APP_URL)"
echo ""
echo "  To tear down: azd down"
echo "========================================="

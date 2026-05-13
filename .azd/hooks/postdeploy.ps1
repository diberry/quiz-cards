# Post-deploy hook — print the app URL

Write-Host ""
Write-Host "========================================="
Write-Host "  Deployment complete!"
Write-Host "========================================="
Write-Host ""
Write-Host "  App URL: $(azd env get-value AZURE_CONTAINER_APP_URL)"
Write-Host ""
Write-Host "  To tear down: azd down"
Write-Host "========================================="

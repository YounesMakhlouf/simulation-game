# PhiloAgents Azure Deployment

## 💰 Budget-Optimized Deployment (~$10-15/month)

This infrastructure is optimized to run on a **$100 budget** for 6-10 months.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Container Apps                      │
│  ┌─────────────────────┐    ┌─────────────────────┐         │
│  │   philoagents-api   │    │   philoagents-ui    │         │
│  │   (FastAPI + AI)    │◄───│   (Phaser.js Game)  │         │
│  │   Port: 8000        │    │   Port: 8080        │         │
│  │   Scale: 0-2        │    │   Scale: 0-2        │         │
│  └──────────┬──────────┘    └─────────────────────┘         │
│             │                                                │
└─────────────┼────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│                  External Services (FREE)                    │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  MongoDB Atlas  │  │    Groq API     │                   │
│  │  (Free Tier)    │  │  (Free Tier)    │                   │
│  │  512MB Storage  │  │  14.4k req/day  │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## Cost Breakdown

| Resource | Monthly Cost |
|----------|-------------|
| Container Apps (API) | ~$5 |
| Container Apps (UI) | ~$5 |
| MongoDB Atlas | $0 (free tier) |
| Application Insights | $0 (free tier) |
| Log Analytics | $0 (free tier) |
| Key Vault | ~$0.01 |
| **Total** | **~$10-15** |

## Prerequisites

1. **Azure CLI** - [Install](https://docs.microsoft.com/cli/azure/install-azure-cli)
2. **Azure Developer CLI (azd)** - [Install](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd)
3. **Docker** - For local testing
4. **MongoDB Atlas Account** - [Sign up free](https://www.mongodb.com/atlas)

## Quick Start

### 1. Login to Azure

```bash
az login
azd auth login
```

### 2. Initialize Environment

```bash
cd <project-root>
azd init
```

When prompted:
- Environment name: `dev` (or your preference)
- Location: Choose a region close to you (e.g., `eastus`)

### 3. Set Up MongoDB Atlas (Free)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a **FREE M0 cluster**
3. Create database user: `philoagents` / `<secure-password>`
4. Network Access:
    - For local development: allow access from **your current IP** only.
    - For Azure Container Apps / production: add your Container Apps **outbound IP addresses** to the Atlas IP access list, or configure a **MongoDB Atlas Private Endpoint** integrated with your Azure VNet.
5. Copy the connection string

### 4. Deploy to Azure

```bash
# Preview the deployment
azd provision --preview

# Deploy everything
azd up
```

### 5. Configure Secrets

After deployment, add your secrets to Key Vault:

```bash
# Get Key Vault name from deployment output
KEYVAULT_NAME=$(azd env get-values | grep AZURE_KEY_VAULT_NAME | cut -d'=' -f2)

# Add secrets
az keyvault secret set --vault-name $KEYVAULT_NAME --name "GROQ-API-KEY" --value "<your-groq-key>"
az keyvault secret set --vault-name $KEYVAULT_NAME --name "MONGO-URI" --value "<your-mongodb-atlas-uri>"
az keyvault secret set --vault-name $KEYVAULT_NAME --name "OPENAI-API-KEY" --value "<your-openai-key>"
az keyvault secret set --vault-name $KEYVAULT_NAME --name "COMET-API-KEY" --value "<your-comet-key>"
```

### 6. Restart Containers (to pick up secrets)

```bash
az containerapp revision restart --name philoagents-api --resource-group <rg-name>
az containerapp revision restart --name philoagents-ui --resource-group <rg-name>
```

### 7. Access Your App

```bash
azd show
```

This will display the URLs for your deployed services.

## File Structure

```
infra/
├── main.bicep                 # Main orchestration
├── main.parameters.json       # Parameters for deployment
├── abbreviations.json         # Azure resource naming
└── modules/
    ├── monitoring.bicep       # Log Analytics + App Insights
    ├── keyvault.bicep         # Key Vault for secrets
    ├── container-apps-env.bicep  # Container Apps Environment
    └── container-app.bicep    # Container App template
```

## Useful Commands

```bash
# View deployment outputs
azd env get-values

# View logs
azd monitor --logs

# Redeploy after code changes
azd deploy

# Destroy all resources
azd down
```

## Troubleshooting

### Cold Start Delays
With scale-to-zero, there's a ~30 second cold start. This is expected for budget optimization.

### Container Not Starting
Check logs:
```bash
az containerapp logs show --name philoagents-api --resource-group <rg-name>
```

### Secrets Not Working
Ensure the managed identity has Key Vault access:
```bash
az keyvault show --name <keyvault-name> --query "properties.enableRbacAuthorization"
```

## Cost Monitoring

Set up budget alerts:
```bash
az consumption budget create \
  --budget-name "PhiloAgents-Budget" \
  --amount 15 \
  --time-grain Monthly \
  --category Cost
```

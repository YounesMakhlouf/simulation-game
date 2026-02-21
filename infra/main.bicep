// ============================================================================
// PhiloAgents - Main Bicep Template
// Budget-optimized deployment (~$10-15/month)
// ============================================================================

targetScope = 'subscription'

// ============================================================================
// Parameters
// ============================================================================

@minLength(1)
@maxLength(64)
@description('Name of the environment (e.g., dev, staging, prod)')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('Name of the resource group')
param resourceGroupName string = ''

// Deployer identity (automatically populated by azd)
@description('Principal ID of the deploying user for Key Vault access')
param principalId string = ''

// Secrets (set via: azd env set <NAME> <value>)
@description('Groq API Key for LLM inference')
@secure()
param groqApiKey string = ''

@description('MongoDB connection URI')
@secure()
param mongoUri string = ''

@description('Comet/Opik API Key for tracing')
@secure()
param cometApiKey string = ''

@description('OpenAI API Key (evaluation only)')
@secure()
param openaiApiKey string = ''

// Container image settings (use GitHub Container Registry - FREE)
@description('API container image')
param apiContainerImage string

@description('UI container image')
param uiContainerImage string

// ============================================================================
// Variables
// ============================================================================

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = {
  azdEnvName: environmentName
  project: 'philoagents'
  budget: 'optimized'
}

// Resource group name
var rgName = !empty(resourceGroupName) ? resourceGroupName : '${abbrs.resourcesResourceGroups}${environmentName}'

// ============================================================================
// Resource Group
// ============================================================================

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: rgName
  location: location
  tags: tags
}

// ============================================================================
// Monitoring (Free Tier)
// ============================================================================

module monitoring './modules/monitoring.bicep' = {
  name: 'monitoring'
  scope: rg
  params: {
    location: location
    tags: tags
    logAnalyticsName: '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
    applicationInsightsName: '${abbrs.insightsComponents}${resourceToken}'
  }
}

// ============================================================================
// Key Vault (for secrets)
// ============================================================================

module keyVault './modules/keyvault.bicep' = {
  name: 'keyvault'
  scope: rg
  params: {
    location: location
    tags: tags
    keyVaultName: '${abbrs.keyVaultVaults}${resourceToken}'
    secretsOfficerPrincipalId: principalId
    // Seed Key Vault with secrets from azd env
    secrets: concat(
      !empty(groqApiKey) ? [{ name: 'GROQ-API-KEY', value: groqApiKey }] : [],
      !empty(mongoUri) ? [{ name: 'MONGO-URI', value: mongoUri }] : [],
      !empty(cometApiKey) ? [{ name: 'COMET-API-KEY', value: cometApiKey }] : [],
      !empty(openaiApiKey) ? [{ name: 'OPENAI-API-KEY', value: openaiApiKey }] : []
    )
  }
}

// ============================================================================
// Container Registry (for storing container images)
// ============================================================================

module containerRegistry './modules/container-registry.bicep' = {
  name: 'container-registry'
  scope: rg
  params: {
    location: location
    tags: tags
    name: '${abbrs.containerRegistryRegistries}${resourceToken}'
  }
}

// ============================================================================
// Container Apps Environment (Consumption - Budget Optimized)
// ============================================================================

module containerAppsEnv './modules/container-apps-env.bicep' = {
  name: 'container-apps-env'
  scope: rg
  params: {
    location: location
    tags: tags
    containerAppsEnvName: '${abbrs.appManagedEnvironments}${resourceToken}'
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

// ============================================================================
// API Container App (Python FastAPI Backend)
// ============================================================================

module apiContainerApp './modules/container-app.bicep' = {
  name: 'api-container-app'
  scope: rg
  params: {
    location: location
    tags: union(tags, { 'azd-service-name': 'api' })
    containerAppName: 'philoagents-api'
    containerAppsEnvId: containerAppsEnv.outputs.containerAppsEnvId
    containerImage: apiContainerImage
    targetPort: 8000
    // Budget optimization: Scale to zero!
    minReplicas: 0
    maxReplicas: 2
    // CORS - only allow requests from the UI
    allowedOrigins: [
      'https://philoagents-ui.${containerAppsEnv.outputs.defaultDomain}'
      'http://localhost:8080'  // Local development
    ]
    // Resource limits - increased for AI model loading
    cpu: '0.5'
    memory: '1Gi'
    // Container Registry (managed identity pull)
    registryServer: containerRegistry.outputs.loginServer
    registryName: containerRegistry.outputs.name
    // Secrets passed directly (no circular Key Vault dependency)
    groqApiKey: groqApiKey
    mongoUri: mongoUri
    cometApiKey: cometApiKey
    // Environment variables
    envVars: [
      {
        name: 'MONGO_DB_NAME'
        value: 'philoagents'
      }
      {
        name: 'GROQ_LLM_MODEL'
        value: 'llama-3.3-70b-versatile'
      }
    ]
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

// ============================================================================
// UI Container App (Phaser.js Frontend)
// ============================================================================

module uiContainerApp './modules/container-app.bicep' = {
  name: 'ui-container-app'
  scope: rg
  params: {
    location: location
    tags: union(tags, { 'azd-service-name': 'ui' })
    containerAppName: 'philoagents-ui'
    containerAppsEnvId: containerAppsEnv.outputs.containerAppsEnvId
    containerImage: uiContainerImage
    targetPort: 8080
    // Budget optimization: Scale to zero!
    minReplicas: 0
    maxReplicas: 2
    // Resource limits (minimum for budget)
    cpu: '0.25'
    memory: '0.5Gi'
    // Health probe path - webpack serves at root
    healthProbePath: '/'
    // Container Registry (managed identity pull)
    registryServer: containerRegistry.outputs.loginServer
    registryName: containerRegistry.outputs.name
    // Environment variables - API URL
    envVars: [
      {
        name: 'VITE_API_URL'
        value: 'https://${apiContainerApp.outputs.fqdn}'
      }
    ]
  }
}

// ============================================================================
// Outputs
// ============================================================================

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_KEY_VAULT_NAME string = keyVault.outputs.keyVaultName
output AZURE_KEY_VAULT_URI string = keyVault.outputs.keyVaultUri

// Container Registry
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.outputs.loginServer
output AZURE_CONTAINER_REGISTRY_NAME string = containerRegistry.outputs.name

// Service URLs
output SERVICE_API_URI string = 'https://${apiContainerApp.outputs.fqdn}'
output SERVICE_UI_URI string = 'https://${uiContainerApp.outputs.fqdn}'

// Container Apps
output API_CONTAINER_APP_NAME string = apiContainerApp.outputs.containerAppName
output UI_CONTAINER_APP_NAME string = uiContainerApp.outputs.containerAppName

// Monitoring
output APPLICATIONINSIGHTS_CONNECTION_STRING string = monitoring.outputs.applicationInsightsConnectionString

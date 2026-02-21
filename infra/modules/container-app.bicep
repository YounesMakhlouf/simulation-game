// ============================================================================
// Container App Module
// Budget optimized with scale-to-zero
// ============================================================================

@description('Location for resources')
param location string

@description('Tags for resources')
param tags object

@description('Container App name')
param containerAppName string

@description('Container Apps Environment ID')
param containerAppsEnvId string

@description('Container image to deploy')
param containerImage string

@description('Target port for ingress')
param targetPort int

@description('Minimum replicas (0 for scale-to-zero)')
param minReplicas int = 0

@description('Maximum replicas')
param maxReplicas int = 2

@description('CPU allocation')
param cpu string = '0.25'

@description('Memory allocation')
param memory string = '0.5Gi'

@description('Environment variables')
param envVars array = []

@description('Allowed CORS origins (empty array disables CORS)')
param allowedOrigins array = []

@description('Health probe path')
param healthProbePath string = '/health'

@description('Key Vault name for managed identity access')
param keyVaultName string = ''

@description('Container Registry login server (e.g., myregistry.azurecr.io)')
param registryServer string = ''

@description('Container Registry name (for AcrPull role assignment)')
param registryName string = ''

@description('Groq API Key for LLM inference')
@secure()
param groqApiKey string = ''

@description('MongoDB connection URI')
@secure()
param mongoUri string = ''

@description('Comet API Key for Opik tracing')
@secure()
param cometApiKey string = ''

// ============================================================================
// Container App
// ============================================================================

// Build secrets array dynamically
var allSecrets = !empty(groqApiKey) ? [
  {
    name: 'groq-api-key'
    value: groqApiKey
  }
  {
    name: 'mongo-uri'
    value: mongoUri
  }
  {
    name: 'comet-api-key'
    value: cometApiKey
  }
] : []

// Build env vars with secret references
var secretEnvVars = !empty(groqApiKey) ? [
  {
    name: 'GROQ_API_KEY'
    secretRef: 'groq-api-key'
  }
  {
    name: 'MONGO_URI'
    secretRef: 'mongo-uri'
  }
  {
    name: 'COMET_API_KEY'
    secretRef: 'comet-api-key'
  }
] : []

var allEnvVars = concat(envVars, secretEnvVars)

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppsEnvId
    workloadProfileName: 'Consumption'
    configuration: {
      // External ingress (publicly accessible)
      ingress: {
        external: true
        targetPort: targetPort
        transport: 'auto'
        allowInsecure: false
        // CORS - only enabled when specific origins are provided
        corsPolicy: !empty(allowedOrigins) ? {
          allowedOrigins: allowedOrigins
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
          allowCredentials: true
        } : null
      }
      // Container Registry configuration
      registries: !empty(registryServer) ? [
        {
          server: registryServer
          identity: 'system'
        }
      ] : []
      secrets: allSecrets
    }
    template: {
      containers: [
        {
          name: containerAppName
          image: containerImage
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: allEnvVars
          // Startup probe - allow longer initialization time for AI model download
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: healthProbePath
                port: targetPort
              }
              initialDelaySeconds: 30   // Start checking after 30s
              periodSeconds: 10         // Check every 10s
              failureThreshold: 30      // Max startup time: 30s initial delay + (10s × 30 failures) = 330s total (maximum allowed, not guaranteed wait)
              timeoutSeconds: 5
            }
          ]
        }
      ]
      // Scale configuration - BUDGET OPTIMIZED
      scale: {
        minReplicas: minReplicas  // 0 = scale to zero when idle!
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ]
      }
    }
  }
}

// ============================================================================
// Role Assignments
// ============================================================================

// ACR Pull - allows Container App to pull images via managed identity
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = if (!empty(registryName)) {
  name: registryName
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(registryName)) {
  name: guid(containerApp.id, registryName, 'AcrPull')
  scope: acr
  properties: {
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
    // AcrPull role
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  }
}

// Key Vault Secrets User - allows Container App to read secrets
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = if (!empty(keyVaultName)) {
  name: keyVaultName
}

resource keyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(keyVaultName)) {
  name: guid(containerApp.id, keyVaultName, 'KeyVaultSecretsUser')
  scope: keyVault
  properties: {
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
    // Key Vault Secrets User role
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
  }
}

// ============================================================================
// Outputs
// ============================================================================

output containerAppId string = containerApp.id
output containerAppName string = containerApp.name
output fqdn string = containerApp.properties.configuration.ingress.fqdn
output principalId string = containerApp.identity.principalId

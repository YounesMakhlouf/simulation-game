// ============================================================================
// Container Apps Environment Module
// Consumption tier (pay-per-use, budget optimized)
// ============================================================================

@description('Location for resources')
param location string

@description('Tags for resources')
param tags object

@description('Container Apps Environment name')
param containerAppsEnvName string

@description('Log Analytics Workspace ID for logging')
param logAnalyticsWorkspaceId string

// ============================================================================
// Container Apps Environment (Consumption - Budget Optimized)
// ============================================================================

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppsEnvName
  location: location
  tags: tags
  properties: {
    // Consumption plan - pay only for what you use
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
    // Connect to Log Analytics
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: reference(logAnalyticsWorkspaceId, '2023-09-01').customerId
        sharedKey: listKeys(logAnalyticsWorkspaceId, '2023-09-01').primarySharedKey
      }
    }
    // No zone redundancy (cost savings)
    zoneRedundant: false
  }
}

// ============================================================================
// Outputs
// ============================================================================

output containerAppsEnvId string = containerAppsEnv.id
output containerAppsEnvName string = containerAppsEnv.name
output defaultDomain string = containerAppsEnv.properties.defaultDomain

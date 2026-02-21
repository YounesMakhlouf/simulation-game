// ============================================================================
// Monitoring Module - Free Tier
// Log Analytics Workspace + Application Insights
// ============================================================================

@description('Location for resources')
param location string

@description('Tags for resources')
param tags object

@description('Log Analytics Workspace name')
param logAnalyticsName string

@description('Application Insights name')
param applicationInsightsName string

// ============================================================================
// Log Analytics Workspace (Free Tier - 5GB/month)
// ============================================================================

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'  // Pay-as-you-go, but first 5GB free
    }
    retentionInDays: 30  // Minimum retention for cost savings
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: json('0.16')  // Cap at ~0.16GB/day (~5GB/30 days) to stay within free tier
    }
  }
}

// ============================================================================
// Application Insights (Free Tier - 5GB/month)
// ============================================================================

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    // Sampling to reduce costs
    SamplingPercentage: 50
  }
}

// ============================================================================
// Outputs
// ============================================================================

output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.name
output applicationInsightsId string = applicationInsights.id
output applicationInsightsName string = applicationInsights.name
output applicationInsightsConnectionString string = applicationInsights.properties.ConnectionString
output applicationInsightsInstrumentationKey string = applicationInsights.properties.InstrumentationKey

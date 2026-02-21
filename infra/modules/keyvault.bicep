// ============================================================================
// Key Vault Module
// Stores secrets securely (API keys, connection strings)
// ============================================================================

@description('Location for resources')
param location string

@description('Tags for resources')
param tags object

@description('Key Vault name')
param keyVaultName string

@description('Secrets to store in Key Vault')
param secrets array = []

@secure()
@description('Principal ID to grant Secrets Officer role')
param secretsOfficerPrincipalId string = ''

// ============================================================================
// Key Vault
// ============================================================================

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    // Enable RBAC for access (more secure than access policies)
    enableRbacAuthorization: true
    // Enable ARM to read secrets for deployments
    enabledForTemplateDeployment: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7  // Minimum for cost savings
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
  }
}

// ============================================================================
// Secrets
// ============================================================================

resource keyVaultSecrets 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = [for secret in secrets: {
  parent: keyVault
  name: secret.name
  properties: {
    value: secret.value
  }
}]

// ============================================================================
// Role Assignment - Secrets Officer for deploying user
// ============================================================================

resource secretsOfficerRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(secretsOfficerPrincipalId)) {
  name: guid(keyVault.id, secretsOfficerPrincipalId, 'KeyVaultSecretsOfficer')
  scope: keyVault
  properties: {
    principalId: secretsOfficerPrincipalId
    principalType: 'User'
    // Key Vault Secrets Officer role
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7')
  }
}

// ============================================================================
// Outputs
// ============================================================================

output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri

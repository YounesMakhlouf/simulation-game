// Azure Container Registry
// Provides private container image registry for the Container Apps

@description('Name of the Container Registry')
param name string

@description('Location for the Container Registry')
param location string = resourceGroup().location

@description('Tags for the resource')
param tags object = {}

// Basic tier is cheapest ($0.167/day = ~$5/month)
@description('SKU for the Container Registry')
@allowed(['Basic', 'Standard', 'Premium'])
param sku string = 'Basic'

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: sku
  }
  properties: {
    adminUserEnabled: false  // Using managed identity for image pull
    publicNetworkAccess: 'Enabled'
  }
}

@description('The name of the Container Registry')
output name string = containerRegistry.name

@description('The login server of the Container Registry')
output loginServer string = containerRegistry.properties.loginServer

@description('The resource ID of the Container Registry')
output id string = containerRegistry.id

@minLength(5)
@maxLength(50)
@description('Globally unique name of the Azure Container Registry.')
param acrName string = 'acr${uniqueString(resourceGroup().id)}'

@description('Location of the Azure Container Registry.')
param location string = resourceGroup().location

@description('Tier of the Azure Container Registry. Basic is sufficient for dev/personal deployments.')
param acrSku string = 'Basic'

@minLength(1)
@description('Principal ID of the UAMI granted AcrPull on this registry. Retrieve from identity.bicep outputs. Required so the ACA worker can pull images using the UAMI at cold start.')
param principalId string

// Immutable AcrPull role ID. Verify: az role definition list --name AcrPull --query "[0].name"
var acrPullRoleDefinitionId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: acrSku
  }
  properties: {
    adminUserEnabled: false
  }
}

resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, principalId, acrPullRoleDefinitionId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleDefinitionId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

@description('Login server (e.g. acrxxx.azurecr.io) for tagging pushed images.')
output loginServer string = acr.properties.loginServer

@description('ACR resource ID.')
output acrId string = acr.id

@description('ACR name.')
output acrName string = acr.name

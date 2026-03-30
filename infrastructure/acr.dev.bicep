@minLength(5)
@maxLength(50)
@description('Globally unique name of the Azure Container Registry')
param acrName string = 'acr${uniqueString(resourceGroup().id)}'

@description('Location of the Azure Container Registry')
param location string = resourceGroup().location

@description('Tier of the Azure Container Registry')
param acrSku string = 'Basic'

resource acrResource 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: acrSku
  }
  properties: {
    adminUserEnabled: false
  }
}

@description('Login server property for later use')
output loginServer string = acrResource.properties.loginServer
@minLength(3)
@maxLength(128)
@description('Name of the user-assigned managed identity.')
param identityName string = 'id-${uniqueString(resourceGroup().id)}'

@description('Location for the identity. Defaults to the resource group location.')
param location string = resourceGroup().location

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

@description('Resource ID of the identity. Pass to compute resources that attach this identity.')
output identityId string = identity.id

@description('Name of the identity.')
output identityName string = identity.name

@description('AAD object ID. Use as the principalId for role assignments.')
output principalId string = identity.properties.principalId

@description('AAD application (client) ID. Set as AZURE_CLIENT_ID on compute resources that attach this identity.')
output clientId string = identity.properties.clientId

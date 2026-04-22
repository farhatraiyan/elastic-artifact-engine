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

module acr 'br/public:avm/res/container-registry/registry:0.12.1' = {
  name: 'acrDeployment'
  params: {
    name: acrName
    location: location
    acrSku: acrSku
    acrAdminUserEnabled: false
    roleAssignments: [
      {
        roleDefinitionIdOrName: '7f951dda-4ed3-4680-a7ca-43fe172d538d' // AcrPull
        principalId: principalId
        principalType: 'ServicePrincipal'
      }
    ]
  }
}

@description('Login server (e.g. acrxxx.azurecr.io) for tagging pushed images.')
output loginServer string = acr.outputs.loginServer

@description('ACR resource ID.')
output acrId string = acr.outputs.resourceId

@description('ACR name.')
output acrName string = acr.outputs.name

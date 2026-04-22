@minLength(3)
@maxLength(24)
@description('Globally unique storage account name (3-24 lowercase alphanumeric chars).')
param storageAccountName string = 'st${uniqueString(resourceGroup().id)}'

@description('Location. Defaults to the resource group location.')
param location string = resourceGroup().location

@description('Storage SKU. Standard_LRS is sufficient for personal deployments.')
param sku string = 'Standard_LRS'

@minLength(1)
@description('Principal ID (object ID) of the UAMI that will access this storage account. Retrieve from identity.bicep outputs.')
param principalId string

@description('Blob container name for rendered artifacts.')
param blobContainerName string = 'artifacts'

@description('Deployment storage container name. Flex Consumption stores the deployment zip here.')
param deploymentContainerName string = 'deployment'

@description('Queue name for render jobs.')
param queueName string = 'jobs'

@description('Table name for job metadata.')
param tableName string = 'metadata'

module storage 'br/public:avm/res/storage/storage-account:0.32.0' = {
  name: 'storageDeployment'
  params: {
    name: storageAccountName
    location: location
    skuName: sku
    // Hardened for identity-only access (UAMI). Disables connection string usage globally.
    allowSharedKeyAccess: false
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
    // Pass the child resources nativelY
    blobServices: {
      containers: [
        {
          name: blobContainerName
          publicAccess: 'None'
        }
        {
          name: deploymentContainerName
          publicAccess: 'None'
        }
      ]
    }
    queueServices: {
      queues: [
        {
          name: queueName
        }
      ]
    }
    tableServices: {
      tables: [
        {
          name: tableName
        }
      ]
    }
    // AVM handles generating the nested role assignment loops
    roleAssignments: [
      {
        roleDefinitionIdOrName: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b' // Storage Blob Data Owner
        principalId: principalId
        principalType: 'ServicePrincipal'
      }
      {
        roleDefinitionIdOrName: '974c5e8b-45b9-4653-ba55-5f855dd0fb88' // Storage Queue Data Contributor
        principalId: principalId
        principalType: 'ServicePrincipal'
      }
      {
        roleDefinitionIdOrName: '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3' // Storage Table Data Contributor
        principalId: principalId
        principalType: 'ServicePrincipal'
      }
    ]
  }
}

output storageAccountName string = storage.outputs.name
output storageAccountId string = storage.outputs.resourceId
output blobContainerName string = blobContainerName
output queueName string = queueName
output tableName string = tableName

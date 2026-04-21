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

@description('Queue name for render jobs.')
param queueName string = 'jobs'

@description('Table name for job metadata.')
param tableName string = 'metadata'

// Verify IDs via: az role definition list --name "<Role Name>" --query "[0].name" -o tsv
// Blob is Owner (not Contributor) for Flex Consumption deployment storage requirements.
var roleDefinitionIds = {
  blobDataOwner: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
  queueDataContributor: '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
  tableDataContributor: '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: sku
  }
  kind: 'StorageV2'
  properties: {
    // Hardened for identity-only access (UAMI). Disables connection string usage globally.
    allowSharedKeyAccess: false
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource artifactContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: blobContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource jobsQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: queueService
  name: queueName
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource metadataTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: tableName
}

// Deterministic GUIDs ensure idempotent role assignment re-deployments.
resource dataRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for role in items(roleDefinitionIds): {
  name: guid(storage.id, principalId, role.value)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', role.value)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}]

output storageAccountName string = storage.name
output storageAccountId string = storage.id
output blobContainerName string = artifactContainer.name
output queueName string = jobsQueue.name
output tableName string = metadataTable.name

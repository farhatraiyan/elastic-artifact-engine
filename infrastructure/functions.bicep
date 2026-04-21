@description('Function App name. Must be globally unique.')
param functionAppName string = 'func-${uniqueString(resourceGroup().id)}'

@description('Flex Consumption plan name.')
param planName string = 'plan-${uniqueString(resourceGroup().id)}'

@description('Location. Defaults to resource group location.')
param location string = resourceGroup().location

@minLength(1)
@description('Resource ID of the UAMI to attach to the Function App. Retrieve from identity.bicep outputs.')
param identityId string

@minLength(1)
@description('Client ID of the UAMI. Exposed to the app as AZURE_CLIENT_ID for DefaultAzureCredential disambiguation in the ingress-api adapters, and as AzureWebJobsStorage__clientId so the Functions runtime picks the same UAMI for its state-store access.')
param identityClientId string

@minLength(3)
@maxLength(24)
@description('Storage account name that backs the engine. Retrieve from storage.bicep outputs. 3-24 lowercase alphanumeric chars per Azure Storage rules.')
param storageAccountName string

@description('Deployment storage container name. Flex Consumption stores the deployment zip here.')
param deploymentContainerName string = 'deployment'

@description('Memory per instance in MB. Flex Consumption allowed values: 512, 2048, 4096. 512 is sufficient for existing ingress-api workload.')
@allowed([
  512
  2048
  4096
])
param instanceMemoryMB int = 512

@description('Maximum instance count for the Flex plan. Raise from 40 only if throughput metrics show saturation, and consider rate-limiting first.')
param maximumInstanceCount int = 40

@description('Blob container for rendered artifacts. Exposed to the app as AZURE_STORAGE_BLOB_CONTAINER_NAME.')
param blobContainerName string = 'artifacts'

@description('Queue name for render jobs. Exposed to the app as AZURE_STORAGE_QUEUE_NAME.')
param queueName string = 'jobs'

@description('Table name for job metadata. Exposed to the app as AZURE_STORAGE_TABLE_NAME.')
param tableName string = 'metadata'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' existing = {
  parent: storage
  name: 'default'
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: deploymentContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource flexPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    serverFarmId: flexPlan.id
    httpsOnly: true
    functionAppConfig: {
      // Flex Consumption cold-starts by pulling the zip via the attached UAMI.
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${deploymentContainerName}'
          authentication: {
            type: 'UserAssignedIdentity'
            userAssignedIdentityResourceId: identityId
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: maximumInstanceCount
        instanceMemoryMB: instanceMemoryMB
      }
      runtime: {
        name: 'node'
        version: '20'
      }
    }
    siteConfig: {
      appSettings: [
        // Replaces classic AzureWebJobsStorage connection string with UAMI auth.
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storageAccountName
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'AzureWebJobsStorage__clientId'
          value: identityClientId
        }
        {
          name: 'AZURE_CLIENT_ID'
          value: identityClientId
        }
        {
          name: 'AZURE_STORAGE_ACCOUNT_NAME'
          value: storageAccountName
        }
        {
          name: 'AZURE_STORAGE_BLOB_CONTAINER_NAME'
          value: blobContainerName
        }
        {
          name: 'AZURE_STORAGE_QUEUE_NAME'
          value: queueName
        }
        {
          name: 'AZURE_STORAGE_TABLE_NAME'
          value: tableName
        }
      ]
    }
  }
}

output functionAppName string = functionApp.name
output functionAppHostname string = functionApp.properties.defaultHostName
output functionAppId string = functionApp.id
output planName string = flexPlan.name
output deploymentContainerUrl string = '${storage.properties.primaryEndpoints.blob}${deploymentContainerName}'

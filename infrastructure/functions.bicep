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

module flexPlan 'br/public:avm/res/web/serverfarm:0.7.0' = {
  name: 'planDeployment'
  params: {
    name: planName
    location: location
    skuName: 'FC1'
    kind: 'functionapp'
    reserved: true
  }
}

// Ensure the storage dependency URI is fully constructed via standard environment string format
var storageBlobUri = 'https://${storageAccountName}.blob.${environment().suffixes.storage}'

module functionApp 'br/public:avm/res/web/site:0.22.0' = {
  name: 'functionAppDeployment'
  params: {
    name: functionAppName
    location: location
    kind: 'functionapp,linux'
    serverFarmResourceId: flexPlan.outputs.resourceId
    httpsOnly: true
    managedIdentities: {
      systemAssigned: false
      userAssignedResourceIds: [
        identityId
      ]
    }
    siteConfig: {
      appSettings: [
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
    functionAppConfig: {
        deployment: {
          storage: {
            type: 'blobContainer'
            value: '${storageBlobUri}/${deploymentContainerName}'
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
  }
}

output functionAppName string = functionApp.outputs.name
output functionAppHostname string = functionApp.outputs.defaultHostname
output functionAppId string = functionApp.outputs.resourceId
output planName string = flexPlan.outputs.name
output deploymentContainerUrl string = '${storageBlobUri}/${deploymentContainerName}'

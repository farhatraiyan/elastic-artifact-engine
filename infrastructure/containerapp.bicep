@description('Container App name.')
param containerAppName string = 'ca-${uniqueString(resourceGroup().id)}'

@description('Container Apps managed environment name.')
param environmentName string = 'env-${uniqueString(resourceGroup().id)}'

@description('Location. Defaults to resource group location.')
param location string = resourceGroup().location

@minLength(1)
@description('Resource ID of the UAMI. Attached to the Container App for both ACR pull and KEDA queue-scaler authentication.')
param identityId string

@minLength(1)
@description('Client ID of the UAMI. Exposed to the app as AZURE_CLIENT_ID so DefaultAzureCredential can disambiguate.')
param identityClientId string

@minLength(3)
@maxLength(24)
@description('Storage account name. Used by the app and by the KEDA queue scaler (identity-based queue-length lookup).')
param storageAccountName string

@minLength(1)
@description('ACR login server (e.g. acrxxx.azurecr.io). Retrieve from registry.bicep outputs.')
param acrLoginServer string

@description('Container image reference. Default assumes browser-orchestrator:latest has been pushed to the ACR.')
param containerImage string = '${acrLoginServer}/browser-orchestrator:latest'

@description('Blob container for rendered artifacts. Exposed as AZURE_STORAGE_BLOB_CONTAINER_NAME.')
param blobContainerName string = 'artifacts'

@description('Queue name. Used both as AZURE_STORAGE_QUEUE_NAME and as the KEDA scaler target.')
param queueName string = 'jobs'

@description('Table name. Exposed as AZURE_STORAGE_TABLE_NAME.')
param tableName string = 'metadata'

@description('Concurrent jobs per worker instance.')
param concurrency int = 2

@description('Max queue dequeues before a job is discarded.')
param maxRetries int = 5

@description('Minimum Container App replicas. 0 enables scale-to-zero.')
param minReplicas int = 0

@description('Maximum Container App replicas.')
param maxReplicas int = 5

@description('Messages per replica before KEDA scales out. Lower = more aggressive scaling.')
param queueLengthPerInstance int = 5

@description('vCPU per replica. Container Apps Consumption enforces a 1:2 vCPU:Gi ratio.')
param cpu string = '1.0'

@description('Memory per replica in Gi. Must be 2x the CPU value.')
param memory string = '2.0Gi'

module environment 'br/public:avm/res/app/managed-environment:0.13.2' = {
  name: 'environmentDeployment'
  params: {
    name: environmentName
    location: location
    // AVM defaults to zoneRedundant: true, which requires a custom VNet infrastructure subnet.
    // Setting it to false allows deploying into the standard managed network.
    zoneRedundant: false
  }
}

module containerApp 'br/public:avm/res/app/container-app:0.22.1' = {
  name: 'containerAppDeployment'
  params: {
    name: containerAppName
    location: location
    environmentResourceId: environment.outputs.resourceId
    managedIdentities: {
      systemAssigned: false
      userAssignedResourceIds: [
        identityId
      ]
    }
    registries: [
      {
        server: acrLoginServer
        identity: identityId
      }
    ]
    containers: [
      {
        name: 'browser-orchestrator'
        image: containerImage
        resources: {
          cpu: json(cpu)
          memory: memory
        }
        env: [
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
          {
            name: 'CONCURRENCY'
            value: string(concurrency)
          }
          {
            name: 'MAX_RETRIES'
            value: string(maxRetries)
          }
        ]
      }
    ]
    scaleSettings: {
      minReplicas: minReplicas
      maxReplicas: maxReplicas
      rules: [
        {
          name: 'queue-length-scaler'
          custom: {
            type: 'azure-queue'
            identity: identityId
            metadata: {
              accountName: storageAccountName
              queueName: queueName
              queueLength: string(queueLengthPerInstance)
            }
          }
        }
      ]
    }
  }
}

output containerAppName string = containerApp.outputs.name
output containerAppId string = containerApp.outputs.resourceId
output environmentName string = environment.outputs.name
output environmentId string = environment.outputs.resourceId

// Provenance: see ./README.md

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

@description('Blob container for capture artifacts. Exposed as AZURE_STORAGE_BLOB_CONTAINER_NAME.')
param blobContainerName string = 'captures'

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

// Managed Environment
resource environment 'Microsoft.App/managedEnvironments@2026-01-01' = {
  name: environmentName
  location: location
  properties: {}
}

// Container App with UAMI attached, image pulled from ACR via that UAMI, and
// KEDA queue-length scaler also authenticated via the same UAMI. No ingress
// as the worker has no HTTP surface.
resource containerApp 'Microsoft.App/containerApps@2026-01-01' = {
  name: containerAppName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: acrLoginServer
          identity: identityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'browser-orchestrator'
          image: containerImage
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: [
            // Worker adapters authenticate via DefaultAzureCredential against
            // the UAMI. AZURE_CLIENT_ID disambiguates which UAMI to use;
            // AZURE_STORAGE_ACCOUNT_NAME triggers the identity branch in
            // service wiring (which derives blob/queue/table URLs from it).
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
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            // KEDA azure-queue scaler with UAMI auth. We use `custom` (not the
            // built-in `azureQueue` rule type) because the built-in variant
            // accepts only connection strings. Deliberately keeping the scaler
            // identity-based so it stays correct when storage.bicep flips back
            // to allowSharedKeyAccess: false after the adapter migration.
            // `identity` is the UAMI resource ID, which needs Storage Queue Data
            // Reader/Contributor role on the account (granted by storage.bicep).
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
}

output containerAppName string = containerApp.name
output containerAppId string = containerApp.id
output environmentName string = environment.name
output environmentId string = environment.id

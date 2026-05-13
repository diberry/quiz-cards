@description('Name of the Container App')
param name string

@description('Location for the resource')
param location string

@description('Tags for the resource')
param tags object = {}

@description('Container Apps Environment resource ID')
param environmentId string

@description('Container Registry name')
param containerRegistryName string

@description('Container Registry login server')
param containerRegistryLoginServer string

@description('User-Assigned Managed Identity resource ID')
param managedIdentityId string

@description('User-Assigned Managed Identity client ID')
param managedIdentityClientId string

@description('Storage account name for Azure Files')
param storageAccountName string

@description('Storage account key for Azure Files')
@secure()
param storageAccountKey string

@description('File share name for SQLite data')
param fileShareName string

@description('Entra ID client ID')
param entraClientId string = ''

@description('Entra ID tenant ID')
param entraTenantId string = ''

@description('Redirect URI for auth')
param redirectUri string = ''

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
      }
      registries: [
        {
          server: containerRegistryLoginServer
          identity: managedIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: name
          image: '${containerRegistryLoginServer}/${name}:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'PORT', value: '3000' }
            { name: 'NODE_ENV', value: 'production' }
            { name: 'ENTRA_CLIENT_ID', value: entraClientId }
            { name: 'ENTRA_TENANT_ID', value: entraTenantId }
            { name: 'REDIRECT_URI', value: redirectUri }
            { name: 'AZURE_CLIENT_ID', value: managedIdentityClientId }
          ]
          volumeMounts: [
            {
              volumeName: 'sqlite-data'
              mountPath: '/app/data'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
      volumes: [
        {
          name: 'sqlite-data'
          storageType: 'AzureFile'
          storageName: 'sqlitedata'
        }
      ]
    }
  }
}

// Link storage to the managed environment
resource managedEnv 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: last(split(environmentId, '/'))
}

resource storageLink 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  parent: managedEnv
  name: 'sqlitedata'
  properties: {
    azureFile: {
      accountName: storageAccountName
      accountKey: storageAccountKey
      shareName: fileShareName
      accessMode: 'ReadWrite'
    }
  }
}

output fqdn string = containerApp.properties.configuration.ingress.fqdn
output name string = containerApp.name

// Infraestrutura como Código (Azure Bicep) — CodeMatrix Academy
// Provisiona: ACR, Container Apps Environment + App, PostgreSQL Flexible Server,
// Cosmos DB for NoSQL e Azure Key Vault.
// NÃO aplicar automaticamente sem aprovação e autenticação (az login) do Founder.

targetScope = 'resourceGroup'

@description('Localização Azure (ex.: brazilsouth)')
param location string = resourceGroup().location

@description('Prefixo único do ambiente')
param prefix string = 'cmacademy'

@description('Usuário administrador do PostgreSQL')
param pgAdminLogin string = 'cmacademyadmin'

@secure()
@description('Senha inicial do PostgreSQL (armazenar no Key Vault)')
param pgAdminPassword string

@description('Imagem inicial do container no ACR')
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

var uniqueSuffix = take(uniqueString(resourceGroup().id), 6)
var acrName = '${prefix}acr${uniqueSuffix}'
var kvName = '${prefix}-kv-${uniqueSuffix}'
var pgName = '${prefix}-pg-${uniqueSuffix}'
var cosmosName = '${prefix}-cosmos-${uniqueSuffix}'
var envName = '${prefix}-cae'
var appName = '${prefix}-web'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: pgName
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: pgAdminLogin
    administratorLoginPassword: pgAdminPassword
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 14, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
  }
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgres
  name: 'codematrix_academy'
}

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' = {
  name: cosmosName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [{ name: 'EnableServerless' }]
    locations: [{ locationName: location, failoverPriority: 0 }]
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-02-15-preview' = {
  parent: cosmos
  name: 'codematrix-academy'
  properties: { resource: { id: 'codematrix-academy' } }
}

resource cae 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {}
}

resource webApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: cae.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3100
        transport: 'http'
        allowInsecure: false
      }
    }
    template: {
      containers: [
        {
          name: 'academy-web'
          image: containerImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'ACADEMY_PUBLIC_URL', value: 'https://academy.codematrix.com.br' }
            { name: 'ACADEMY_DEV_MAILBOX', value: '0' }
            { name: 'ACADEMY_SQL_DRIVER', value: 'postgres' }
            { name: 'ACADEMY_NOSQL_DRIVER', value: 'cosmos' }
            { name: 'MERCADOPAGO_MODE', value: 'production' }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 5 }
    }
  }
}

output containerAppFqdn string = webApp.properties.configuration.ingress.fqdn
output acrLoginServer string = acr.properties.loginServer
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName
output cosmosEndpoint string = cosmos.properties.documentEndpoint
output keyVaultUri string = keyVault.properties.vaultUri

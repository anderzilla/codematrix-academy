import fs from 'node:fs';
import path from 'node:path';

/**
 * Contrato de persistência NoSQL (Azure Cosmos DB for NoSQL em produção;
 * store documental local isolado em desenvolvimento/testes).
 *
 * Uso recomendado na CodeMatrix Academy:
 * - Documentos ricos de aulas/slides e anotações do aluno ("Pare e Anote")
 * - Snapshots de tentativas de quiz e trilha de telemetria sem PII
 * - Cache de leitura de catálogo multi-curso
 */
export interface NoSqlDocument {
  id: string;
  partitionKey: string;
  kind: string;
  payload: Record<string, unknown>;
  updatedAt: string;
}

export interface NoSqlDocumentStore {
  readonly driver: 'local' | 'cosmos';
  upsert(container: string, doc: NoSqlDocument): Promise<void>;
  get(container: string, partitionKey: string, id: string): Promise<NoSqlDocument | null>;
  listByPartition(container: string, partitionKey: string): Promise<NoSqlDocument[]>;
}

export function getPersistenceTopology(env: NodeJS.ProcessEnv = process.env) {
  const sqlDriver = (env.ACADEMY_SQL_DRIVER || 'sqlite').toLowerCase() === 'postgres'
    ? 'postgres'
    : 'sqlite';
  const nosqlDriver = (env.ACADEMY_NOSQL_DRIVER || 'local').toLowerCase() === 'cosmos'
    ? 'cosmos'
    : 'local';

  return {
    sql: {
      driver: sqlDriver,
      azureTarget: 'Azure Database for PostgreSQL Flexible Server (TLS verify-full + RLS + PITR)',
      configured: sqlDriver === 'postgres' ? Boolean(env.DATABASE_URL?.trim()) : true,
    },
    nosql: {
      driver: nosqlDriver,
      azureTarget: 'Azure Cosmos DB for NoSQL (particionado por tenantId/partnerId + Key Vault)',
      configured:
        nosqlDriver === 'cosmos'
          ? Boolean(env.AZURE_COSMOS_ENDPOINT?.trim() && env.AZURE_COSMOS_DATABASE?.trim())
          : true,
    },
  };
}

class LocalNoSqlStore implements NoSqlDocumentStore {
  readonly driver = 'local' as const;
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  private filePath(container: string, partitionKey: string): string {
    const safeContainer = container.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safePk = partitionKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.baseDir, safeContainer, `${safePk}.json`);
  }

  async upsert(container: string, doc: NoSqlDocument): Promise<void> {
    const target = this.filePath(container, doc.partitionKey);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const existing = await this.listByPartition(container, doc.partitionKey);
    const filtered = existing.filter((item) => item.id !== doc.id);
    filtered.push({ ...doc, updatedAt: new Date().toISOString() });
    fs.writeFileSync(target, JSON.stringify(filtered, null, 2), 'utf8');
  }

  async get(container: string, partitionKey: string, id: string): Promise<NoSqlDocument | null> {
    const list = await this.listByPartition(container, partitionKey);
    return list.find((item) => item.id === id) ?? null;
  }

  async listByPartition(container: string, partitionKey: string): Promise<NoSqlDocument[]> {
    const target = this.filePath(container, partitionKey);
    if (!fs.existsSync(target)) return [];
    try {
      return JSON.parse(fs.readFileSync(target, 'utf8')) as NoSqlDocument[];
    } catch {
      return [];
    }
  }
}

class AzureCosmosFailClosedStore implements NoSqlDocumentStore {
  readonly driver = 'cosmos' as const;

  private ensureConfigured(): void {
    if (!process.env.AZURE_COSMOS_ENDPOINT?.trim() || !process.env.AZURE_COSMOS_DATABASE?.trim()) {
      throw new Error(
        'Azure Cosmos DB não configurado (fail-closed): defina AZURE_COSMOS_ENDPOINT, AZURE_COSMOS_DATABASE e autenticação (Managed Identity ou AZURE_COSMOS_KEY via Key Vault).',
      );
    }
  }

  async upsert(): Promise<void> {
    this.ensureConfigured();
    throw new Error(
      'Driver Azure Cosmos DB requer instalação de @azure/cosmos e credenciais gerenciadas no ambiente Azure.',
    );
  }

  async get(): Promise<NoSqlDocument | null> {
    this.ensureConfigured();
    throw new Error(
      'Driver Azure Cosmos DB requer instalação de @azure/cosmos e credenciais gerenciadas no ambiente Azure.',
    );
  }

  async listByPartition(): Promise<NoSqlDocument[]> {
    this.ensureConfigured();
    throw new Error(
      'Driver Azure Cosmos DB requer instalação de @azure/cosmos e credenciais gerenciadas no ambiente Azure.',
    );
  }
}

export function createNoSqlStore(env: NodeJS.ProcessEnv = process.env): NoSqlDocumentStore {
  if ((env.ACADEMY_NOSQL_DRIVER || 'local').toLowerCase() === 'cosmos') {
    return new AzureCosmosFailClosedStore();
  }
  const dir = env.ACADEMY_NOSQL_LOCAL_DIR?.trim() || path.resolve(process.cwd(), 'data', 'nosql');
  return new LocalNoSqlStore(dir);
}

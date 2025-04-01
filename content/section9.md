# Section 9: Deployment and Production Considerations

Deploying MCP applications to production environments requires careful planning and consideration of various factors. In this section, we'll explore best practices for deploying MCP servers, optimizing performance, and scaling your applications to handle production workloads.

## Deploying MCP Servers

Deploying an MCP server involves several steps to ensure reliability, security, and performance.

### Server Architecture for Production

When deploying to production, it's important to design a robust server architecture:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Load Balancer │────►│   MCP Servers   │────►│   Databases     │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Monitoring    │     │   Caching       │     │   Storage       │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

Let's implement a production-ready MCP server:

```typescript
// src/server/production-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { createClient } from "redis";
import { MongoClient } from "mongodb";
import { createLogger, format, transports } from "winston";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Create logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  defaultMeta: { service: 'mcp-server' },
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' })
  ]
});

// Database connection
async function connectToDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mcp';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    logger.info('Connected to MongoDB');
    return client.db();
  } catch (error) {
    logger.error('MongoDB connection error', { error });
    throw error;
  }
}

// Redis connection
async function connectToRedis() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const client = createClient({ url });
  
  client.on('error', (error) => {
    logger.error('Redis error', { error });
  });
  
  await client.connect();
  logger.info('Connected to Redis');
  
  return client;
}

// Create and start the server
export async function startProductionServer() {
  try {
    // Connect to databases
    const db = await connectToDatabase();
    const redis = await connectToRedis();
    
    // Create the MCP server
    const server = new McpServer({
      name: "Production MCP Server",
      version: "1.0.0",
      
      // Error handling
      onError: (error, context) => {
        logger.error('MCP server error', {
          error: error.message,
          code: error.code,
          details: error.details,
          connectionId: context?.connectionId
        });
      }
    });
    
    // Register resources and actions
    registerResources(server, db, redis);
    registerActions(server, db, redis);
    
    // Configure transport
    const port = parseInt(process.env.PORT || '3000', 10);
    const transport = new HttpServerTransport({
      port,
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST']
      }
    });
    
    // Start the server
    logger.info(`Starting MCP server on port ${port}`);
    await server.connect(transport);
    logger.info(`MCP server running on port ${port}`);
    
    // Handle graceful shutdown
    setupGracefulShutdown(server, db, redis);
    
    return server;
  } catch (error) {
    logger.error('Failed to start server', { error });
    throw error;
  }
}

// Register resources
function registerResources(server: McpServer, db: any, redis: any) {
  // Example resource with caching
  server.resource(
    "cached-resource",
    "cached://{id}",
    async (uri, { id }) => {
      const cacheKey = `resource:${id}`;
      
      // Try to get from cache
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        logger.debug('Cache hit', { id });
        return JSON.parse(cached);
      }
      
      logger.debug('Cache miss', { id });
      
      // Fetch from database
      const collection = db.collection('resources');
      const resource = await collection.findOne({ id });
      
      if (!resource) {
        throw new Error(`Resource not found: ${id}`);
      }
      
      // Format response
      const result = {
        contents: [{
          uri: uri.href,
          text: resource.content,
          metadata: {
            title: resource.title,
            lastUpdated: resource.updatedAt
          }
        }]
      };
      
      // Cache the result
      await redis.set(cacheKey, JSON.stringify(result), {
        EX: 300 // 5 minutes
      });
      
      return result;
    }
  );
}

// Register actions
function registerActions(server: McpServer, db: any, redis: any) {
  // Example action with rate limiting
  server.tool(
    "rate-limited-action",
    {
      input: z.string()
    },
    async ({ input }, context) => {
      const userId = context.connectionId;
      const rateKey = `rate:${userId}`;
      
      // Check rate limit
      const count = await redis.incr(rateKey);
      
      // First request sets expiry
      if (count === 1) {
        await redis.expire(rateKey, 60); // 1 minute window
      }
      
      // Rate limit: 10 requests per minute
      if (count > 10) {
        throw new Error('Rate limit exceeded. Try again later.');
      }
      
      // Process the action
      logger.debug('Processing action', { userId, input });
      
      // Record the action
      await db.collection('actions').insertOne({
        userId,
        input,
        timestamp: new Date()
      });
      
      return {
        content: [{ 
          type: "text", 
          text: `Processed: ${input}` 
        }]
      };
    }
  );
}

// Graceful shutdown
function setupGracefulShutdown(server: McpServer, db: any, redis: any) {
  async function shutdown(signal: string) {
    logger.info(`Received ${signal}. Shutting down...`);
    
    try {
      // Disconnect MCP server
      await server.disconnect();
      logger.info('MCP server disconnected');
      
      // Close Redis connection
      await redis.quit();
      logger.info('Redis connection closed');
      
      // Close MongoDB connection
      await db.client.close();
      logger.info('MongoDB connection closed');
      
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  }
  
  // Listen for termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start the server if this file is executed directly
if (require.main === module) {
  startProductionServer().catch(error => {
    console.error('Server startup failed:', error);
    process.exit(1);
  });
}
```

### Containerization with Docker

Containerizing your MCP server with Docker provides consistency across environments:

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy application code
COPY . .

# Build the application
RUN pnpm build

# Expose the port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the server
CMD ["node", "dist/server/production-server.js"]
```

Create a Docker Compose file for local development and testing:

```yaml
# docker-compose.yml
version: '3'

services:
  mcp-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - MONGODB_URI=mongodb://mongo:27017/mcp
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=info
      - CORS_ORIGIN=*
    depends_on:
      - mongo
      - redis
    restart: unless-stopped

  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  mongo-data:
  redis-data:
```

### Deployment to Cloud Platforms

Let's explore deployment to different cloud platforms:

#### AWS Deployment

For AWS, you can use Elastic Container Service (ECS) or Elastic Kubernetes Service (EKS):

```typescript
// infrastructure/aws-ecs.ts
import * as aws from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';

export class McpServerStack extends aws.Stack {
  constructor(scope: Construct, id: string, props?: aws.StackProps) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new ec2.Vpc(this, 'McpVpc', {
      maxAzs: 2
    });

    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, 'McpCluster', {
      vpc
    });

    // Create a task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'McpTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512
    });

    // Add container to task definition
    const container = taskDefinition.addContainer('McpContainer', {
      image: ecs.ContainerImage.fromEcrRepository(
        ecr.Repository.fromRepositoryName(this, 'McpRepo', 'mcp-server')
      ),
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'mcp-server',
        logRetention: logs.RetentionDays.ONE_WEEK
      }),
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
        MONGODB_URI: process.env.MONGODB_URI || '',
        REDIS_URL: process.env.REDIS_URL || '',
        LOG_LEVEL: 'info',
        CORS_ORIGIN: '*'
      }
    });

    // Add port mapping
    container.addPortMappings({
      containerPort: 3000
    });

    // Create a service
    const service = new ecs.FargateService(this, 'McpService', {
      cluster,
      taskDefinition,
      desiredCount: 2,
      assignPublicIp: true
    });

    // Create a load balancer
    const lb = new elbv2.ApplicationLoadBalancer(this, 'McpLB', {
      vpc,
      internetFacing: true
    });

    // Add a listener
    const listener = lb.addListener('McpListener', {
      port: 80
    });

    // Add target group
    listener.addTargets('McpTargets', {
      port: 3000,
      targets: [service],
      healthCheck: {
        path: '/health',
        interval: aws.Duration.seconds(60),
        timeout: aws.Duration.seconds(5)
      }
    });

    // Output the load balancer URL
    new aws.CfnOutput(this, 'LoadBalancerDNS', {
      value: lb.loadBalancerDnsName
    });
  }
}
```

#### Google Cloud Platform Deployment

For GCP, you can use Google Kubernetes Engine (GKE):

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-server
  template:
    metadata:
      labels:
        app: mcp-server
    spec:
      containers:
      - name: mcp-server
        image: gcr.io/your-project/mcp-server:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: mcp-secrets
              key: mongodb-uri
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: mcp-secrets
              key: redis-url
        - name: LOG_LEVEL
          value: "info"
        - name: CORS_ORIGIN
          value: "*"
        resources:
          limits:
            cpu: "1"
            memory: "1Gi"
          requests:
            cpu: "500m"
            memory: "512Mi"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 60
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-server
spec:
  selector:
    app: mcp-server
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

#### Azure Deployment

For Azure, you can use Azure Container Instances or Azure Kubernetes Service:

```typescript
// infrastructure/azure-deploy.ts
import { DefaultAzureCredential } from "@azure/identity";
import { ContainerInstanceManagementClient } from "@azure/arm-containerinstance";
import { ContainerGroup } from "@azure/arm-containerinstance/esm/models";

async function deployToAzure() {
  // Set up Azure credentials
  const credential = new DefaultAzureCredential();
  
  // Create a client
  const client = new ContainerInstanceManagementClient(
    credential,
    process.env.AZURE_SUBSCRIPTION_ID || ""
  );
  
  // Container group configuration
  const containerGroup: ContainerGroup = {
    location: "eastus",
    osType: "Linux",
    containers: [
      {
        name: "mcp-server",
        image: "your-registry.azurecr.io/mcp-server:latest",
        resources: {
          requests: {
            memoryInGB: 1.5,
            cpu: 1.0
          }
        },
        ports: [
          {
            port: 3000
          }
        ],
        environmentVariables: [
          {
            name: "NODE_ENV",
            value: "production"
          },
          {
            name: "PORT",
            value: "3000"
          },
          {
            name: "LOG_LEVEL",
            value: "info"
          },
          {
            name: "CORS_ORIGIN",
            value: "*"
          }
        ],
        volumeMounts: [
          {
            name: "secrets",
            mountPath: "/app/secrets"
          }
        ]
      }
    ],
    ipAddress: {
      type: "Public",
      ports: [
        {
          port: 3000,
          protocol: "TCP"
        }
      ],
      dnsNameLabel: "mcp-server"
    },
    volumes: [
      {
        name: "secrets",
        secret: {
          MONGODB_URI: Buffer.from(
            process.env.MONGODB_URI || ""
          ).toString("base64"),
          REDIS_URL: Buffer.from(
            process.env.REDIS_URL || ""
          ).toString("base64")
        }
      }
    ]
  };
  
  // Deploy the container group
  const result = await client.containerGroups.beginCreateOrUpdate(
    process.env.AZURE_RESOURCE_GROUP || "",
    "mcp-server",
    containerGroup
  );
  
  console.log("Deployment completed:", result);
}

deployToAzure().catch(console.error);
```

### Continuous Integration and Deployment

Setting up CI/CD pipelines ensures reliable and consistent deployments:

```yaml
# .github/workflows/deploy.yml
name: Deploy MCP Server

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'pnpm'
    
    - name: Install pnpm
      run: npm install -g pnpm
    
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
    
    - name: Run tests
      run: pnpm test
    
    - name: Build
      run: pnpm build
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Login to Docker Hub
      uses: docker/login-action@v2
      with:
        username: ${{ secrets.DOCKER_HUB_USERNAME }}
        password: ${{ secrets.DOCKER_HUB_TOKEN }}
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: yourusername/mcp-server:latest,yourusername/mcp-server:${{ github.sha }}
    
    - name: Deploy to production
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.SSH_HOST }}
        username: ${{ secrets.SSH_USERNAME }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script: |
          cd /opt/mcp-server
          docker-compose pull
          docker-compose up -d
```

## Performance Optimization

Optimizing the performance of your MCP applications is crucial for production environments.

### Caching Strategies

Implementing effective caching can significantly improve performance:

```typescript
// src/server/cache-manager.ts
import { createClient, RedisClientType } from "redis";

export class CacheManager {
  private client: RedisClientType;
  private connected: boolean = false;
  
  constructor(redisUrl: string) {
    this.client = createClient({ url: redisUrl });
    
    this.client.on('error', (error) => {
      console.error('Redis error:', error);
    });
  }
  
  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }
  
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }
  
  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    
    if (!data) {
      return null;
    }
    
    try {
      return JSON.parse(data) as T;
    } catch (error) {
      console.error('Error parsing cached data:', error);
      return null;
    }
  }
  
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    await this.client.set(key, JSON.stringify(value), {
      EX: ttlSeconds
    });
  }
  
  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
  
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }
}
```

Now, let's use this cache manager with our MCP server:

```typescript
// src/server/cached-resources.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CacheManager } from "./cache-manager";

export function registerCachedResources(
  server: McpServer,
  cacheManager: CacheManager,
  db: any
) {
  // Resource with caching
  server.resource(
    "document",
    "docs://{documentId}",
    async (uri, { documentId }) => {
      // Generate cache key
      const cacheKey = `resource:document:${documentId}`;
      
      // Try to get from cache
      const cached = await cacheManager.get(cacheKey);
      
      if (cached) {
        console.log(`Cache hit for document ${documentId}`);
        return cached;
      }
      
      console.log(`Cache miss for document ${documentId}`);
      
      // Fetch from database
      const document = await db.collection('documents').findOne({ id: documentId });
      
      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }
      
      // Format response
      const result = {
        contents: [{
          uri: uri.href,
          text: document.content,
          metadata: {
            title: document.title,
            author: document.author,
            lastUpdated: document.updatedAt
          }
        }]
      };
      
      // Cache the result
      await cacheManager.set(cacheKey, result);
      
      return result;
    }
  );
  
  // Action that invalidates cache
  server.tool(
    "document.update",
    {
      documentId: z.string(),
      content: z.string(),
      title: z.string().optional()
    },
    async ({ documentId, content, title }) => {
      // Update in database
      await db.collection('documents').updateOne(
        { id: documentId },
        { 
          $set: { 
            content,
            ...(title && { title }),
            updatedAt: new Date()
          }
        }
      );
      
      // Invalidate cache
      await cacheManager.delete(`resource:document:${documentId}`);
      
      return {
        content: [{ 
          type: "text", 
          text: `Document ${documentId} updated successfully` 
        }]
      };
    }
  );
}
```

### Database Optimization

Optimizing database interactions is crucial for performance:

```typescript
// src/server/database-manager.ts
import { MongoClient, Db, Collection } from "mongodb";

export class DatabaseManager {
  private client: MongoClient;
  private db: Db | null = null;
  
  constructor(uri: string) {
    this.client = new MongoClient(uri);
  }
  
  async connect(): Promise<Db> {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db();
      
      // Create indexes
      await this.createIndexes();
    }
    
    return this.db;
  }
  
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.db = null;
    }
  }
  
  private async createIndexes(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    
    // Create indexes for documents collection
    await this.db.collection('documents').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { title: 1 } },
      { key: { author: 1 } },
      { key: { updatedAt: -1 } }
    ]);
    
    // Create indexes for users collection
    await this.db.collection('users').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { email: 1 }, unique: true }
    ]);
    
    // Create indexes for actions collection
    await this.db.collection('actions').createIndexes([
      { key: { userId: 1 } },
      { key: { timestamp: -1 } }
    ]);
  }
  
  getCollection<T>(name: string): Collection<T> {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    
    return this.db.collection<T>(name);
  }
  
  // Helper methods for common operations
  
  async findById<T>(collection: string, id: string): Promise<T | null> {
    return this.getCollection<T>(collection).findOne({ id } as any);
  }
  
  async findMany<T>(
    collection: string,
    query: object,
    options: { 
      limit?: number;
      skip?: number;
      sort?: object;
    } = {}
  ): Promise<T[]> {
    const { limit = 100, skip = 0, sort = { _id: -1 } } = options;
    
    return this.getCollection<T>(collection)
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
  }
  
  async insertOne<T>(collection: string, document: T): Promise<string> {
    const result = await this.getCollection<T>(collection).insertOne(document as any);
    return result.insertedId.toString();
  }
  
  async updateOne<T>(
    collection: string,
    id: string,
    update: Partial<T>
  ): Promise<boolean> {
    const result = await this.getCollection<T>(collection).updateOne(
      { id } as any,
      { $set: update as any }
    );
    
    return result.modifiedCount > 0;
  }
  
  async deleteOne(collection: string, id: string): Promise<boolean> {
    const result = await this.getCollection(collection).deleteOne({ id } as any);
    return result.deletedCount > 0;
  }
}
```

### Load Testing and Benchmarking

Before deploying to production, it's important to load test your MCP server:

```typescript
// src/tools/load-tester.ts
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";

interface LoadTestOptions {
  serverUrl: string;
  concurrentUsers: number;
  requestsPerUser: number;
  rampUpTime: number; // in milliseconds
}

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  totalDuration: number;
}

export async function runLoadTest(
  options: LoadTestOptions
): Promise<LoadTestResult> {
  const {
    serverUrl,
    concurrentUsers,
    requestsPerUser,
    rampUpTime
  } = options;
  
  console.log(`Starting load test with ${concurrentUsers} users, ${requestsPerUser} requests per user`);
  
  const startTime = Date.now();
  const responseTimes: number[] = [];
  let successfulRequests = 0;
  let failedRequests = 0;
  
  // Create users
  const users = Array.from({ length: concurrentUsers }, (_, i) => i);
  
  // Run user simulations
  await Promise.all(users.map(async (userId, index) => {
    // Stagger user start times for ramp-up
    const delay = (rampUpTime / concurrentUsers) * index;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Create client for this user
    const transport = new HttpClientTransport(serverUrl);
    const client = new McpClient(transport);
    
    try {
      await client.connect();
      
      // Run requests for this user
      for (let i = 0; i < requestsPerUser; i++) {
        try {
          const requestStart = Date.now();
          
          // Alternate between resource requests and action executions
          if (i % 2 === 0) {
            await client.fetchResource(`docs://test-${i}`);
          } else {
            await client.executeAction('test.echo', { 
              message: `Test message from user ${userId}, request ${i}` 
            });
          }
          
          const requestDuration = Date.now() - requestStart;
          responseTimes.push(requestDuration);
          successfulRequests++;
        } catch (error) {
          console.error(`Request failed for user ${userId}, request ${i}:`, error);
          failedRequests++;
        }
      }
      
      await client.disconnect();
    } catch (error) {
      console.error(`User ${userId} simulation failed:`, error);
      failedRequests += requestsPerUser;
    }
  }));
  
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  // Calculate statistics
  const totalRequests = successfulRequests + failedRequests;
  const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  const minResponseTime = Math.min(...responseTimes);
  const maxResponseTime = Math.max(...responseTimes);
  const requestsPerSecond = (successfulRequests / totalDuration) * 1000;
  
  const result: LoadTestResult = {
    totalRequests,
    successfulRequests,
    failedRequests,
    averageResponseTime,
    minResponseTime,
    maxResponseTime,
    requestsPerSecond,
    totalDuration
  };
  
  console.log('Load test completed:');
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Successful requests: ${successfulRequests}`);
  console.log(`Failed requests: ${failedRequests}`);
  console.log(`Average response time: ${averageResponseTime.toFixed(2)}ms`);
  console.log(`Min response time: ${minResponseTime}ms`);
  console.log(`Max response time: ${maxResponseTime}ms`);
  console.log(`Requests per second: ${requestsPerSecond.toFixed(2)}`);
  console.log(`Total duration: ${totalDuration}ms`);
  
  return result;
}

// Run the load test if this file is executed directly
if (require.main === module) {
  runLoadTest({
    serverUrl: 'http://localhost:3000',
    concurrentUsers: 50,
    requestsPerUser: 20,
    rampUpTime: 5000 // 5 seconds
  }).catch(console.error);
}
```

## Scaling Considerations

As your MCP application grows, you'll need to consider scaling strategies.

### Horizontal Scaling

Horizontal scaling involves adding more server instances:

```typescript
// src/server/cluster.ts
import cluster from 'cluster';
import os from 'os';
import { createServer } from './production-server';

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    // Replace the dead worker
    cluster.fork();
  });
} else {
  // Workers can share any TCP connection
  createServer().then(() => {
    console.log(`Worker ${process.pid} started`);
  }).catch(error => {
    console.error(`Worker ${process.pid} failed to start:`, error);
    process.exit(1);
  });
}
```

### Load Balancing

Load balancing distributes traffic across multiple server instances:

```typescript
// src/server/load-balancer.ts
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { request } from 'http';

interface Backend {
  host: string;
  port: number;
  weight: number;
  active: boolean;
  failCount: number;
}

export class LoadBalancer {
  private backends: Backend[] = [];
  private currentBackendIndex = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  
  constructor(
    private port: number = 8080,
    private healthCheckPath: string = '/health',
    private healthCheckIntervalMs: number = 10000,
    private maxFailCount: number = 3
  ) {}
  
  addBackend(host: string, port: number, weight: number = 1): void {
    this.backends.push({
      host,
      port,
      weight,
      active: true,
      failCount: 0
    });
  }
  
  start(): void {
    if (this.backends.length === 0) {
      throw new Error('No backends configured');
    }
    
    const server = createServer((req, res) => {
      this.handleRequest(req, res);
    });
    
    server.listen(this.port, () => {
      console.log(`Load balancer running on port ${this.port}`);
    });
    
    // Start health checks
    this.startHealthChecks();
  }
  
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.backends.forEach(this.checkBackendHealth.bind(this));
    }, this.healthCheckIntervalMs);
  }
  
  private checkBackendHealth(backend: Backend): void {
    const options = {
      host: backend.host,
      port: backend.port,
      path: this.healthCheckPath,
      method: 'GET',
      timeout: 5000
    };
    
    const req = request(options, (res) => {
      if (res.statusCode === 200) {
        // Backend is healthy
        if (!backend.active && backend.failCount < this.maxFailCount) {
          console.log(`Backend ${backend.host}:${backend.port} is back online`);
          backend.active = true;
        }
        backend.failCount = 0;
      } else {
        this.handleBackendFailure(backend, `Unhealthy status code: ${res.statusCode}`);
      }
    });
    
    req.on('error', (error) => {
      this.handleBackendFailure(backend, error.message);
    });
    
    req.on('timeout', () => {
      req.destroy();
      this.handleBackendFailure(backend, 'Health check timeout');
    });
    
    req.end();
  }
  
  private handleBackendFailure(backend: Backend, reason: string): void {
    backend.failCount++;
    
    console.warn(`Backend ${backend.host}:${backend.port} health check failed: ${reason}, fail count: ${backend.failCount}`);
    
    if (backend.failCount >= this.maxFailCount && backend.active) {
      console.error(`Backend ${backend.host}:${backend.port} marked as inactive`);
      backend.active = false;
    }
  }
  
  private getNextBackend(): Backend | null {
    const activeBackends = this.backends.filter(b => b.active);
    
    if (activeBackends.length === 0) {
      return null;
    }
    
    // Simple round-robin with weighting
    let totalWeight = 0;
    for (const backend of activeBackends) {
      totalWeight += backend.weight;
    }
    
    let random = Math.random() * totalWeight;
    let cumulativeWeight = 0;
    
    for (const backend of activeBackends) {
      cumulativeWeight += backend.weight;
      if (random <= cumulativeWeight) {
        return backend;
      }
    }
    
    // Fallback to first active backend
    return activeBackends[0];
  }
  
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const backend = this.getNextBackend();
    
    if (!backend) {
      res.statusCode = 503;
      res.end('Service Unavailable: No active backends');
      return;
    }
    
    const options = {
      host: backend.host,
      port: backend.port,
      path: req.url,
      method: req.method,
      headers: req.headers
    };
    
    const proxyReq = request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    
    req.pipe(proxyReq, { end: true });
    
    proxyReq.on('error', (error) => {
      console.error(`Proxy request to ${backend.host}:${backend.port} failed:`, error);
      
      if (!res.headersSent) {
        res.statusCode = 502;
        res.end('Bad Gateway');
      } else {
        res.end();
      }
      
      // Mark backend as potentially unhealthy
      backend.failCount++;
      if (backend.failCount >= this.maxFailCount) {
        console.error(`Backend ${backend.host}:${backend.port} marked as inactive due to request failure`);
        backend.active = false;
      }
    });
  }
  
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// Example usage
if (require.main === module) {
  const loadBalancer = new LoadBalancer(8080);
  
  // Add backends (in a real scenario, these would be your MCP server instances)
  loadBalancer.addBackend('localhost', 3001, 1);
  loadBalancer.addBackend('localhost', 3002, 1);
  loadBalancer.addBackend('localhost', 3003, 1);
  
  loadBalancer.start();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down load balancer');
    loadBalancer.stop();
    process.exit(0);
  });
}
```

### Microservices Architecture

For large-scale applications, consider a microservices architecture:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  API Gateway    │────►│  Auth Service   │     │  User Service   │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                                               ▲
         │                                               │
         ▼                                               │
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  MCP Service    │────►│  Resource       │────►│  Database       │
│                 │     │  Service        │     │  Service        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

Here's an example of an MCP service in a microservices architecture:

```typescript
// src/microservices/mcp-service.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import axios from "axios";

// Service URLs (would come from service discovery in a real system)
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const RESOURCE_SERVICE_URL = process.env.RESOURCE_SERVICE_URL || 'http://localhost:3002';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3003';

export async function createMcpMicroservice() {
  // Create the MCP server
  const server = new McpServer({
    name: "MCP Microservice",
    version: "1.0.0"
  });
  
  // Register resources that proxy to the resource service
  server.resource(
    "document",
    "docs://{documentId}",
    async (uri, { documentId }, context) => {
      // Get auth token from context
      const authToken = context.metadata?.authToken;
      
      if (!authToken) {
        throw new Error('Authentication required');
      }
      
      try {
        // Verify token with auth service
        await axios.post(`${AUTH_SERVICE_URL}/verify`, { token: authToken });
        
        // Fetch document from resource service
        const response = await axios.get(
          `${RESOURCE_SERVICE_URL}/documents/${documentId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
        
        const document = response.data;
        
        return {
          contents: [{
            uri: uri.href,
            text: document.content,
            metadata: {
              title: document.title,
              author: document.author,
              lastUpdated: document.updatedAt
            }
          }]
        };
      } catch (error) {
        if (error.response?.status === 401) {
          throw new Error('Unauthorized');
        } else if (error.response?.status === 404) {
          throw new Error(`Document not found: ${documentId}`);
        } else {
          console.error('Service error:', error);
          throw new Error('Service unavailable');
        }
      }
    }
  );
  
  // Register actions that proxy to other services
  server.tool(
    "user.profile",
    {
      userId: z.string()
    },
    async ({ userId }, context) => {
      // Get auth token from context
      const authToken = context.metadata?.authToken;
      
      if (!authToken) {
        throw new Error('Authentication required');
      }
      
      try {
        // Verify token with auth service
        await axios.post(`${AUTH_SERVICE_URL}/verify`, { token: authToken });
        
        // Fetch user profile from user service
        const response = await axios.get(
          `${USER_SERVICE_URL}/users/${userId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
        
        const user = response.data;
        
        return {
          content: [{ 
            type: "text", 
            text: `User: ${user.name}\nEmail: ${user.email}\nRole: ${user.role}` 
          }]
        };
      } catch (error) {
        if (error.response?.status === 401) {
          throw new Error('Unauthorized');
        } else if (error.response?.status === 404) {
          throw new Error(`User not found: ${userId}`);
        } else {
          console.error('Service error:', error);
          throw new Error('Service unavailable');
        }
      }
    }
  );
  
  // Start the server
  const port = parseInt(process.env.PORT || '3000', 10);
  const transport = new HttpServerTransport({ port });
  
  await server.connect(transport);
  console.log(`MCP microservice running on port ${port}`);
  
  return server;
}

// Start the service if this file is executed directly
if (require.main === module) {
  createMcpMicroservice().catch(error => {
    console.error('Failed to start MCP microservice:', error);
    process.exit(1);
  });
}
```

## Monitoring and Observability

Monitoring your MCP applications is essential for maintaining reliability.

### Logging and Metrics

Implement comprehensive logging and metrics collection:

```typescript
// src/server/monitoring.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger, format, transports } from "winston";
import * as prometheus from "prom-client";

// Set up Prometheus metrics
const registry = new prometheus.Registry();
prometheus.collectDefaultMetrics({ register: registry });

// Custom metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const mcpResourceRequests = new prometheus.Counter({
  name: 'mcp_resource_requests_total',
  help: 'Total number of MCP resource requests',
  labelNames: ['resource', 'status']
});

const mcpActionRequests = new prometheus.Counter({
  name: 'mcp_action_requests_total',
  help: 'Total number of MCP action requests',
  labelNames: ['action', 'status']
});

const mcpConnectionsActive = new prometheus.Gauge({
  name: 'mcp_connections_active',
  help: 'Number of active MCP connections'
});

// Register metrics
registry.registerMetric(httpRequestDuration);
registry.registerMetric(mcpResourceRequests);
registry.registerMetric(mcpActionRequests);
registry.registerMetric(mcpConnectionsActive);

// Create logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  defaultMeta: { service: 'mcp-server' },
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' })
  ]
});

export function setupMonitoring(server: McpServer, app: any): void {
  // Track connections
  server.on('connection', (context) => {
    mcpConnectionsActive.inc();
    logger.info('Client connected', {
      connectionId: context.connectionId
    });
    
    context.onClose(() => {
      mcpConnectionsActive.dec();
      logger.info('Client disconnected', {
        connectionId: context.connectionId
      });
    });
  });
  
  // Wrap resource handlers with metrics
  const originalResource = server.resource.bind(server);
  server.resource = function(name, template, handler) {
    return originalResource(name, template, async (uri, params, context) => {
      const start = Date.now();
      
      try {
        const result = await handler(uri, params, context);
        
        // Record metrics
        const duration = (Date.now() - start) / 1000;
        mcpResourceRequests.inc({ resource: name, status: 'success' });
        
        logger.info('Resource request successful', {
          resource: name,
          uri: uri.href,
          duration,
          connectionId: context.connectionId
        });
        
        return result;
      } catch (error) {
        // Record metrics
        const duration = (Date.now() - start) / 1000;
        mcpResourceRequests.inc({ resource: name, status: 'error' });
        
        logger.error('Resource request failed', {
          resource: name,
          uri: uri.href,
          error: error.message,
          duration,
          connectionId: context.connectionId
        });
        
        throw error;
      }
    });
  };
  
  // Wrap action handlers with metrics
  const originalTool = server.tool.bind(server);
  server.tool = function(name, schema, handler) {
    return originalTool(name, schema, async (params, context) => {
      const start = Date.now();
      
      try {
        const result = await handler(params, context);
        
        // Record metrics
        const duration = (Date.now() - start) / 1000;
        mcpActionRequests.inc({ action: name, status: 'success' });
        
        logger.info('Action request successful', {
          action: name,
          params,
          duration,
          connectionId: context.connectionId
        });
        
        return result;
      } catch (error) {
        // Record metrics
        const duration = (Date.now() - start) / 1000;
        mcpActionRequests.inc({ action: name, status: 'error' });
        
        logger.error('Action request failed', {
          action: name,
          params,
          error: error.message,
          duration,
          connectionId: context.connectionId
        });
        
        throw error;
      }
    });
  };
  
  // Add Prometheus metrics endpoint
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });
  
  // Add health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  
  // Add readiness check endpoint
  app.get('/ready', (req, res) => {
    // Check if server is ready to serve requests
    if (server.isConnected()) {
      res.json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready' });
    }
  });
}
```

### Alerting and Incident Response

Set up alerting for critical issues:

```typescript
// src/server/alerting.ts
import { createTransport } from "nodemailer";
import { Webhook } from "discord-webhook-node";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface AlertConfig {
  email?: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    from: string;
    to: string[];
  };
  discord?: {
    enabled: boolean;
    webhookUrl: string;
  };
  slack?: {
    enabled: boolean;
    webhookUrl: string;
  };
}

export class AlertManager {
  private emailTransport: any;
  private discordHook: Webhook | null = null;
  private config: AlertConfig;
  
  constructor(config: AlertConfig) {
    this.config = config;
    
    // Set up email transport
    if (config.email?.enabled) {
      this.emailTransport = createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: config.email.auth
      });
    }
    
    // Set up Discord webhook
    if (config.discord?.enabled) {
      this.discordHook = new Webhook(config.discord.webhookUrl);
    }
  }
  
  async sendAlert(
    level: 'info' | 'warning' | 'error' | 'critical',
    title: string,
    message: string,
    details?: any
  ): Promise<void> {
    console.log(`[ALERT] ${level.toUpperCase()}: ${title} - ${message}`);
    
    // Only send alerts for warning, error, and critical levels
    if (level === 'info') {
      return;
    }
    
    const promises: Promise<any>[] = [];
    
    // Send email alert
    if (this.config.email?.enabled) {
      const emailPromise = this.emailTransport.sendMail({
        from: this.config.email.from,
        to: this.config.email.to.join(', '),
        subject: `[${level.toUpperCase()}] ${title}`,
        text: `${message}\n\nDetails: ${JSON.stringify(details, null, 2)}`,
        html: `
          <h1 style="color: ${this.getLevelColor(level)};">${level.toUpperCase()}: ${title}</h1>
          <p>${message}</p>
          <h2>Details:</h2>
          <pre>${JSON.stringify(details, null, 2)}</pre>
        `
      });
      
      promises.push(emailPromise);
    }
    
    // Send Discord alert
    if (this.config.discord?.enabled && this.discordHook) {
      const discordPromise = this.discordHook.send({
        embeds: [{
          title: `[${level.toUpperCase()}] ${title}`,
          description: message,
          color: this.getLevelColorCode(level),
          fields: details ? [
            {
              name: 'Details',
              value: '```json\n' + JSON.stringify(details, null, 2) + '\n```'
            }
          ] : [],
          timestamp: new Date().toISOString()
        }]
      });
      
      promises.push(discordPromise);
    }
    
    // Send Slack alert
    if (this.config.slack?.enabled) {
      const slackPromise = fetch(this.config.slack.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: `*[${level.toUpperCase()}] ${title}*\n${message}`,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `[${level.toUpperCase()}] ${title}`
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: message
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '```' + JSON.stringify(details, null, 2) + '```'
              }
            }
          ]
        })
      });
      
      promises.push(slackPromise);
    }
    
    await Promise.all(promises);
  }
  
  private getLevelColor(level: string): string {
    switch (level) {
      case 'info': return '#3498db';
      case 'warning': return '#f39c12';
      case 'error': return '#e74c3c';
      case 'critical': return '#c0392b';
      default: return '#2c3e50';
    }
  }
  
  private getLevelColorCode(level: string): number {
    switch (level) {
      case 'info': return 3447003; // Blue
      case 'warning': return 16763904; // Orange
      case 'error': return 15158332; // Red
      case 'critical': return 10038562; // Dark Red
      default: return 9807270; // Gray
    }
  }
}

export function setupAlerts(server: McpServer, alertManager: AlertManager): void {
  // Monitor server errors
  server.on('error', (error, context) => {
    alertManager.sendAlert(
      'error',
      'MCP Server Error',
      error.message,
      {
        code: error.code,
        details: error.details,
        connectionId: context?.connectionId
      }
    );
  });
  
  // Monitor resource errors
  const originalResource = server.resource.bind(server);
  server.resource = function(name, template, handler) {
    return originalResource(name, template, async (uri, params, context) => {
      try {
        return await handler(uri, params, context);
      } catch (error) {
        // Only alert for unexpected errors
        if (error.message.includes('not found')) {
          // This is an expected error, don't alert
        } else {
          alertManager.sendAlert(
            'error',
            `Resource Error: ${name}`,
            `Error in resource handler for ${name}: ${error.message}`,
            {
              uri: uri.href,
              params,
              connectionId: context.connectionId,
              stack: error.stack
            }
          );
        }
        
        throw error;
      }
    });
  };
  
  // Monitor action errors
  const originalTool = server.tool.bind(server);
  server.tool = function(name, schema, handler) {
    return originalTool(name, schema, async (params, context) => {
      try {
        return await handler(params, context);
      } catch (error) {
        // Only alert for unexpected errors
        if (error.message.includes('validation')) {
          // This is an expected error, don't alert
        } else {
          alertManager.sendAlert(
            'error',
            `Action Error: ${name}`,
            `Error in action handler for ${name}: ${error.message}`,
            {
              params,
              connectionId: context.connectionId,
              stack: error.stack
            }
          );
        }
        
        throw error;
      }
    });
  };
  
  // Set up process monitoring
  process.on('uncaughtException', (error) => {
    alertManager.sendAlert(
      'critical',
      'Uncaught Exception',
      `An uncaught exception occurred: ${error.message}`,
      {
        stack: error.stack
      }
    );
    
    // Give time for the alert to be sent before exiting
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    alertManager.sendAlert(
      'critical',
      'Unhandled Rejection',
      `An unhandled promise rejection occurred: ${reason}`,
      {
        reason,
        promise
      }
    );
  });
  
  // Monitor memory usage
  const memoryThreshold = 0.9; // 90% of available memory
  
  setInterval(() => {
    const memoryUsage = process.memoryUsage();
    const heapUsed = memoryUsage.heapUsed;
    const heapTotal = memoryUsage.heapTotal;
    const memoryPercentage = heapUsed / heapTotal;
    
    if (memoryPercentage > memoryThreshold) {
      alertManager.sendAlert(
        'warning',
        'High Memory Usage',
        `Memory usage is at ${(memoryPercentage * 100).toFixed(2)}% of heap total`,
        memoryUsage
      );
    }
  }, 60000); // Check every minute
}
```

### Health Checks and Status Pages

Implement health checks and status pages for your MCP applications:

```typescript
// src/server/health.ts
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface HealthCheckConfig {
  path?: string;
  readyPath?: string;
  statusPath?: string;
  dependencies?: {
    [name: string]: () => Promise<boolean>;
  };
}

export function setupHealthChecks(
  app: express.Application,
  server: McpServer,
  config: HealthCheckConfig = {}
): void {
  const {
    path = '/health',
    readyPath = '/ready',
    statusPath = '/status',
    dependencies = {}
  } = config;
  
  // Simple health check
  app.get(path, (req, res) => {
    res.json({ status: 'ok' });
  });
  
  // Readiness check
  app.get(readyPath, async (req, res) => {
    // Check if server is connected
    const isServerConnected = server.isConnected();
    
    if (!isServerConnected) {
      res.status(503).json({
        status: 'not ready',
        reason: 'MCP server not connected'
      });
      return;
    }
    
    // Check dependencies
    const dependencyResults: Record<string, boolean> = {};
    let allDependenciesReady = true;
    
    for (const [name, check] of Object.entries(dependencies)) {
      try {
        dependencyResults[name] = await check();
        if (!dependencyResults[name]) {
          allDependenciesReady = false;
        }
      } catch (error) {
        dependencyResults[name] = false;
        allDependenciesReady = false;
      }
    }
    
    if (!allDependenciesReady) {
      res.status(503).json({
        status: 'not ready',
        dependencies: dependencyResults
      });
      return;
    }
    
    res.json({
      status: 'ready',
      dependencies: dependencyResults
    });
  });
  
  // Detailed status page
  app.get(statusPath, async (req, res) => {
    const startTime = Date.now();
    
    // Check server status
    const isServerConnected = server.isConnected();
    
    // Check dependencies
    const dependencyResults: Record<string, { status: boolean; responseTime?: number }> = {};
    
    for (const [name, check] of Object.entries(dependencies)) {
      const checkStartTime = Date.now();
      
      try {
        const result = await check();
        const checkDuration = Date.now() - checkStartTime;
        
        dependencyResults[name] = {
          status: result,
          responseTime: checkDuration
        };
      } catch (error) {
        const checkDuration = Date.now() - checkStartTime;
        
        dependencyResults[name] = {
          status: false,
          responseTime: checkDuration
        };
      }
    }
    
    // Get system info
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Calculate overall status
    const allDependenciesHealthy = Object.values(dependencyResults)
      .every(result => result.status);
    
    const overallStatus = isServerConnected && allDependenciesHealthy
      ? 'healthy'
      : 'degraded';
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      status: overallStatus,
      server: {
        connected: isServerConnected,
        uptime
      },
      dependencies: dependencyResults,
      system: {
        memory: {
          rss: formatBytes(memoryUsage.rss),
          heapTotal: formatBytes(memoryUsage.heapTotal),
          heapUsed: formatBytes(memoryUsage.heapUsed),
          external: formatBytes(memoryUsage.external)
        },
        uptime: formatDuration(uptime)
      },
      responseTime
    });
  });
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to format duration
function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  
  const minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);
  
  const parts = [];
  
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}
```

## Security Considerations

Security is a critical aspect of deploying MCP applications to production.

### Authentication and Authorization

Implement robust authentication and authorization:

```typescript
// src/server/auth.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { verify, sign } from "jsonwebtoken";
import { compare } from "bcrypt";

interface User {
  id: string;
  username: string;
  password: string; // Hashed password
  role: string;
}

interface TokenPayload {
  userId: string;
  username: string;
  role: string;
}

export class AuthManager {
  private users: Map<string, User> = new Map();
  private jwtSecret: string;
  
  constructor(jwtSecret: string) {
    this.jwtSecret = jwtSecret;
  }
  
  // Add a user (in a real app, this would use a database)
  addUser(user: User): void {
    this.users.set(user.id, user);
  }
  
  // Authenticate a user and generate a token
  async authenticate(username: string, password: string): Promise<string> {
    // Find the user
    const user = Array.from(this.users.values())
      .find(u => u.username === username);
    
    if (!user) {
      throw new Error('Invalid username or password');
    }
    
    // Verify password
    const passwordMatch = await compare(password, user.password);
    
    if (!passwordMatch) {
      throw new Error('Invalid username or password');
    }
    
    // Generate token
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };
    
    return sign(payload, this.jwtSecret, { expiresIn: '1h' });
  }
  
  // Verify a token
  verifyToken(token: string): TokenPayload {
    try {
      return verify(token, this.jwtSecret) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }
  
  // Check if a user has a specific role
  hasRole(token: string, requiredRole: string): boolean {
    try {
      const payload = this.verifyToken(token);
      return payload.role === requiredRole;
    } catch (error) {
      return false;
    }
  }
}

// Apply authentication and authorization to an MCP server
export function setupAuth(server: McpServer, authManager: AuthManager): void {
  // Middleware to extract token from request
  server.use(async (context, next) => {
    const authHeader = context.request.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        // Verify token
        const payload = authManager.verifyToken(token);
        
        // Add user info to context
        context.metadata = {
          ...context.metadata,
          userId: payload.userId,
          username: payload.username,
          role: payload.role
        };
      } catch (error) {
        // Token verification failed, but we'll continue
        // Resources/actions can check for auth as needed
      }
    }
    
    return next();
  });
  
  // Add authentication action
  server.tool(
    "auth.login",
    {
      username: z.string(),
      password: z.string()
    },
    async ({ username, password }) => {
      try {
        const token = await authManager.authenticate(username, password);
        
        return {
          content: [{ 
            type: "text", 
            text: `Login successful. Token: ${token}` 
          }]
        };
      } catch (error) {
        throw new Error('Authentication failed');
      }
    }
  );
  
  // Add role-based action
  server.tool(
    "admin.action",
    {
      param: z.string()
    },
    async ({ param }, context) => {
      // Check if user has admin role
      if (!context.metadata?.role || context.metadata.role !== 'admin') {
        throw new Error('Unauthorized: Admin role required');
      }
      
      // Perform admin action
      return {
        content: [{ 
          type: "text", 
          text: `Admin action performed with param: ${param}` 
        }]
      };
    }
  );
}
```

### Data Protection

Implement data protection measures:

```typescript
// src/server/data-protection.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export class DataProtection {
  private encryptionKey: Buffer;
  
  constructor(encryptionKey?: string) {
    if (encryptionKey) {
      // Use provided key
      this.encryptionKey = Buffer.from(encryptionKey, 'hex');
    } else {
      // Generate a new key
      this.encryptionKey = randomBytes(32);
      console.log('Generated encryption key:', this.encryptionKey.toString('hex'));
    }
  }
  
  // Encrypt data
  encrypt(data: string): { encrypted: string; iv: string } {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex')
    };
  }
  
  // Decrypt data
  decrypt(encrypted: string, iv: string): string {
    const decipher = createDecipheriv(
      'aes-256-cbc',
      this.encryptionKey,
      Buffer.from(iv, 'hex')
    );
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  // Hash sensitive data for storage
  hash(data: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  // Sanitize data for logging
  sanitizeForLogging(data: any): any {
    if (!data) return data;
    
    if (typeof data === 'string') {
      // Mask email addresses
      return data.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeForLogging(item));
    }
    
    if (typeof data === 'object') {
      const result: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        // Mask sensitive fields
        if (
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('key')
        ) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = this.sanitizeForLogging(value);
        }
      }
      
      return result;
    }
    
    return data;
  }
}
```

### Rate Limiting and DDoS Protection

Implement rate limiting to protect against abuse:

```typescript
// src/server/rate-limiter.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient } from "redis";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (context: any) => string;
  message?: string;
}

export class RateLimiter {
  private redis: ReturnType<typeof createClient>;
  private connected: boolean = false;
  
  constructor(redisUrl: string) {
    this.redis = createClient({ url: redisUrl });
    
    this.redis.on('error', (error) => {
      console.error('Redis error:', error);
    });
  }
  
  async connect(): Promise<void> {
    if (!this.connected) {
      await this.redis.connect();
      this.connected = true;
    }
  }
  
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.redis.quit();
      this.connected = false;
    }
  }
  
  // Create a rate limiter middleware
  createMiddleware(config: RateLimitConfig) {
    const {
      windowMs,
      maxRequests,
      keyGenerator = (context) => context.connectionId || 'anonymous',
      message = 'Too many requests, please try again later.'
    } = config;
    
    return async (context: any, next: () => Promise<any>) => {
      const key = `rate-limit:${keyGenerator(context)}`;
      
      // Get current count
      const count = await this.redis.incr(key);
      
      // Set expiry on first request
      if (count === 1) {
        await this.redis.expire(key, Math.ceil(windowMs / 1000));
      }
      
      // Check if rate limit exceeded
      if (count > maxRequests) {
        throw new Error(message);
      }
      
      // Continue to next middleware
      return next();
    };
  }
}

// Apply rate limiting to an MCP server
export function setupRateLimiting(
  server: McpServer,
  rateLimiter: RateLimiter
): void {
  // Global rate limiting
  server.use(rateLimiter.createMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    message: 'Rate limit exceeded. Please try again later.'
  }));
  
  // Resource-specific rate limiting
  const originalResource = server.resource.bind(server);
  server.resource = function(name, template, handler) {
    // Apply resource-specific rate limiting
    const resourceLimiter = rateLimiter.createMiddleware({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 20, // 20 requests per minute per resource
      keyGenerator: (context) => `${context.connectionId}:resource:${name}`,
      message: `Rate limit exceeded for resource ${name}. Please try again later.`
    });
    
    return originalResource(name, template, async (uri, params, context) => {
      // Apply rate limiting
      await resourceLimiter(context, async () => {
        // Continue with original handler
        return handler(uri, params, context);
      });
    });
  };
  
  // Action-specific rate limiting
  const originalTool = server.tool.bind(server);
  server.tool = function(name, schema, handler) {
    // Apply action-specific rate limiting
    const actionLimiter = rateLimiter.createMiddleware({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 requests per minute per action
      keyGenerator: (context) => `${context.connectionId}:action:${name}`,
      message: `Rate limit exceeded for action ${name}. Please try again later.`
    });
    
    return originalTool(name, schema, async (params, context) => {
      // Apply rate limiting
      await actionLimiter(context, async () => {
        // Continue with original handler
        return handler(params, context);
      });
    });
  };
}
```

## Summary

In this section, we've explored various aspects of deploying MCP applications to production environments:

1. **Deploying MCP Servers**: We learned how to containerize MCP servers with Docker and deploy them to various cloud platforms, including AWS, GCP, and Azure.

2. **Performance Optimization**: We explored caching strategies, database optimization, and load testing techniques to ensure optimal performance.

3. **Scaling Considerations**: We discussed horizontal scaling, load balancing, and microservices architecture for handling increased load.

4. **Monitoring and Observability**: We implemented logging, metrics collection, alerting, and health checks to maintain visibility into our applications.

5. **Security Considerations**: We covered authentication, authorization, data protection, and rate limiting to secure our MCP applications.

By applying these techniques, you can deploy robust, scalable, and secure MCP applications to production environments. In the next section, we'll build a comprehensive final project that brings together all the concepts we've learned throughout this course.

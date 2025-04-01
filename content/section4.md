# Section 4: Building an MCP Server in TypeScript

## Server Architecture

An MCP server is the backbone of any MCP implementation, providing resources, tools, and prompts to clients. Understanding the architecture of an MCP server is essential for building robust and scalable applications.

### Components of an MCP Server

An MCP server consists of several key components:

1. **Server Core**: The central component that manages the protocol implementation
2. **Transport Layer**: Handles communication with clients
3. **Resource Handlers**: Provide access to data sources
4. **Action Handlers**: Implement tools that clients can use
5. **Prompt Templates**: Define reusable interaction patterns

Let's examine how these components are structured in the TypeScript SDK:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// 1. Create the server core
const server = new McpServer({
  name: "Example Server",
  version: "1.0.0"
});

// 2. Define resource handlers
server.resource(
  "greeting",                                    // Resource name
  new ResourceTemplate("greeting://{name}"),     // URI template
  async (uri, { name }) => ({                    // Handler function
    contents: [{
      uri: uri.href,
      text: `Hello, ${name}!`
    }]
  })
);

// 3. Define action handlers
server.tool(
  "add",                                         // Action name
  { a: z.number(), b: z.number() },              // Parameter schema
  async ({ a, b }) => ({                         // Handler function
    content: [{ type: "text", text: String(a + b) }]
  })
);

// 4. Define prompt templates
server.prompt(
  "introduction",                                // Prompt name
  {
    name: z.string(),
    topic: z.string()
  },
  async ({ name, topic }) => ({
    content: `Hello ${name}, let me tell you about ${topic}...`
  })
);

// 5. Connect with a transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

This architecture provides a clean separation of concerns, making it easy to extend and maintain your MCP server.

### Server Lifecycle

An MCP server follows a defined lifecycle:

1. **Initialization**: The server is created and configured
2. **Connection**: The server connects to a transport
3. **Operation**: The server processes client requests
4. **Shutdown**: The server gracefully terminates

Here's how this lifecycle is implemented:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";

async function runServer() {
  // 1. Initialization
  const server = new McpServer({
    name: "Example Server",
    version: "1.0.0"
  });
  
  // Configure resources, actions, and prompts
  configureServer(server);
  
  // 2. Connection
  const transport = new HttpServerTransport({
    port: 3000
  });
  
  console.log("Starting server...");
  await server.connect(transport);
  console.log("Server running on port 3000");
  
  // 3. Operation
  // The server processes requests automatically
  
  // Set up graceful shutdown
  process.on("SIGINT", async () => {
    // 4. Shutdown
    console.log("Shutting down server...");
    await server.disconnect();
    console.log("Server shutdown complete");
    process.exit(0);
  });
}

function configureServer(server: McpServer) {
  // Add resources, actions, and prompts
  // ...
}

runServer().catch(error => {
  console.error("Server error:", error);
  process.exit(1);
});
```

Understanding this lifecycle is important for proper resource management and graceful error handling.

### Configuration Options

The MCP server can be configured with various options to customize its behavior:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({
  // Basic information
  name: "Example Server",
  version: "1.0.0",
  
  // Optional configuration
  description: "An example MCP server for demonstration purposes",
  
  // Capabilities
  capabilities: {
    resources: true,
    actions: true,
    prompts: true,
    streaming: true
  },
  
  // Logging
  logger: customLogger,
  
  // Error handling
  onError: (error) => {
    console.error("Server error:", error);
    // Custom error reporting
    errorReportingService.report(error);
  }
});
```

These configuration options allow you to tailor the server to your specific needs, enabling or disabling features as required.

## Implementing Protocol Handlers

Protocol handlers are the core of an MCP server, processing incoming messages and generating appropriate responses.

### Message Parsing and Validation

The MCP server needs to parse and validate incoming messages to ensure they conform to the protocol:

```typescript
import { 
  deserializeMessage, 
  isValidMessage,
  McpMessageType
} from "@modelcontextprotocol/sdk/shared";

// Example of manual message handling (the SDK does this automatically)
function handleRawMessage(rawMessage: string): void {
  try {
    // Parse the message
    const message = deserializeMessage(rawMessage);
    
    // Validate the message
    if (!isValidMessage(message)) {
      throw new Error("Invalid message format");
    }
    
    // Process based on message type
    switch (message.type as McpMessageType) {
      case "hello":
        handleHelloMessage(message);
        break;
      case "resource_request":
        handleResourceRequest(message);
        break;
      case "action_request":
        handleActionRequest(message);
        break;
      // Handle other message types...
      default:
        throw new Error(`Unsupported message type: ${message.type}`);
    }
  } catch (error) {
    // Handle parsing or validation errors
    sendErrorResponse(error);
  }
}
```

The TypeScript SDK handles most of this automatically, but understanding the process is important for debugging and extending the server.

### Request Routing

Once a message is parsed and validated, it needs to be routed to the appropriate handler:

```typescript
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "Example Server",
  version: "1.0.0"
});

// Resource routing based on URI templates
server.resource(
  "user",
  new ResourceTemplate("users://{userId}"),
  async (uri, { userId }) => {
    // Route to the user handler
    return await getUserResource(userId);
  }
);

server.resource(
  "document",
  new ResourceTemplate("docs://{documentId}"),
  async (uri, { documentId }) => {
    // Route to the document handler
    return await getDocumentResource(documentId);
  }
);

// Action routing based on action names
server.tool(
  "user.create",
  {
    name: z.string(),
    email: z.string().email()
  },
  async (params) => {
    // Route to the user creation handler
    return await createUser(params);
  }
);

server.tool(
  "user.update",
  {
    userId: z.string(),
    updates: z.object({
      name: z.string().optional(),
      email: z.string().email().optional()
    })
  },
  async (params) => {
    // Route to the user update handler
    return await updateUser(params.userId, params.updates);
  }
);
```

This declarative approach to routing makes it easy to organize your server's functionality.

### Response Formatting

Responses need to be properly formatted according to the MCP specification:

```typescript
import { 
  createMessage,
  serializeMessage
} from "@modelcontextprotocol/sdk/shared";

// Example of manual response formatting (the SDK does this automatically)
function createResourceResponse(
  requestId: string,
  contents: ResourceContent[]
): string {
  const response = createMessage("resource_response", {
    contents,
    // Optional pagination
    nextPage: contents.length >= 10 ? "next-page-uri" : undefined
  }, {
    // Link this response to the original request
    inReplyTo: requestId
  });
  
  return serializeMessage(response);
}

function createActionResponse(
  requestId: string,
  content: ContentBlock[]
): string {
  const response = createMessage("action_response", {
    content
  }, {
    // Link this response to the original request
    inReplyTo: requestId
  });
  
  return serializeMessage(response);
}

function createErrorResponse(
  requestId: string,
  error: Error
): string {
  const response = createMessage("error", {
    code: error.name,
    message: error.message,
    details: error instanceof McpError ? error.details : undefined
  }, {
    // Link this response to the original request
    inReplyTo: requestId
  });
  
  return serializeMessage(response);
}
```

Again, the SDK handles most of this automatically, but understanding the response format is important for debugging and customization.

## Managing Multiple Client Connections

In many scenarios, an MCP server needs to handle multiple client connections simultaneously.

### Connection Pooling

Connection pooling helps manage multiple client connections efficiently:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";

class ConnectionManager {
  private connections: Map<string, ClientConnection> = new Map();
  
  addConnection(id: string, connection: ClientConnection): void {
    this.connections.set(id, connection);
    console.log(`Client connected: ${id}`);
  }
  
  removeConnection(id: string): void {
    this.connections.delete(id);
    console.log(`Client disconnected: ${id}`);
  }
  
  getConnection(id: string): ClientConnection | undefined {
    return this.connections.get(id);
  }
  
  getConnectionCount(): number {
    return this.connections.size;
  }
  
  broadcastMessage(message: string): void {
    for (const connection of this.connections.values()) {
      connection.send(message);
    }
  }
}

// Using the connection manager with an MCP server
const connectionManager = new ConnectionManager();

const server = new McpServer({
  name: "Multi-Client Server",
  version: "1.0.0"
});

const transport = new HttpServerTransport({
  port: 3000,
  onConnection: (connection) => {
    const id = generateUniqueId();
    connectionManager.addConnection(id, connection);
    
    connection.on("close", () => {
      connectionManager.removeConnection(id);
    });
  }
});

await server.connect(transport);
console.log("Server running on port 3000");
```

### Session Management

Session management allows the server to maintain state for each client:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

class SessionManager {
  private sessions: Map<string, SessionData> = new Map();
  
  createSession(sessionId: string): void {
    this.sessions.set(sessionId, {
      createdAt: Date.now(),
      lastActivity: Date.now(),
      resources: new Set<string>(),
      context: {}
    });
  }
  
  getSession(sessionId: string): SessionData | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
    return session;
  }
  
  updateSession(sessionId: string, updates: Partial<SessionData>): void {
    const session = this.getSession(sessionId);
    if (session) {
      Object.assign(session, updates);
      session.lastActivity = Date.now();
    }
  }
  
  recordResourceAccess(sessionId: string, uri: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.resources.add(uri);
    }
  }
  
  cleanupInactiveSessions(maxInactiveTime: number = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > maxInactiveTime) {
        this.sessions.delete(sessionId);
        console.log(`Session expired: ${sessionId}`);
      }
    }
  }
}

interface SessionData {
  createdAt: number;
  lastActivity: number;
  resources: Set<string>;
  context: Record<string, unknown>;
}

// Using the session manager with an MCP server
const sessionManager = new SessionManager();

const server = new McpServer({
  name: "Session-Aware Server",
  version: "1.0.0",
  
  // Set up session handling
  onConnection: (context) => {
    const sessionId = context.connectionId;
    sessionManager.createSession(sessionId);
    
    context.onClose(() => {
      // Clean up session when connection closes
      // Or keep it for future reconnections
    });
  }
});

// Resource handler with session awareness
server.resource(
  "user-data",
  "user-data://current",
  async (uri, params, context) => {
    const sessionId = context.connectionId;
    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
      throw new Error("Session not found");
    }
    
    // Use session data to customize the response
    const userData = await getUserData(session.context.userId);
    
    // Record this resource access
    sessionManager.recordResourceAccess(sessionId, uri.href);
    
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(userData),
        metadata: {
          lastAccessed: new Date().toISOString()
        }
      }]
    };
  }
);

// Set up periodic session cleanup
setInterval(() => {
  sessionManager.cleanupInactiveSessions();
}, 5 * 60 * 1000); // Every 5 minutes
```

### Scaling Considerations

When building MCP servers that need to scale, consider these approaches:

#### Stateless Design

```typescript
// Design your server to be stateless where possible
const server = new McpServer({
  name: "Stateless Server",
  version: "1.0.0"
});

// Use external storage for state
const redis = new Redis();

server.tool(
  "counter.increment",
  { key: z.string() },
  async ({ key }) => {
    // Store state in Redis instead of in-memory
    const count = await redis.incr(`counter:${key}`);
    
    return {
      content: [{ type: "text", text: String(count) }]
    };
  }
);
```

#### Horizontal Scaling

```typescript
// Use a load balancer to distribute connections
// Each server instance is independent
import cluster from "cluster";
import os from "os";

if (cluster.isPrimary) {
  // Fork workers for each CPU
  const numCPUs = os.cpus().length;
  
  console.log(`Starting ${numCPUs} workers`);
  
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    // Restart the worker
    cluster.fork();
  });
} else {
  // Workers share the TCP connection
  const server = new McpServer({
    name: "Scalable Server",
    version: "1.0.0"
  });
  
  const transport = new HttpServerTransport({
    port: 3000
  });
  
  await server.connect(transport);
  console.log(`Worker ${process.pid} started`);
}
```

#### Shared State

```typescript
// Use a shared cache for state that needs to be consistent
import { createClient } from "redis";

const redisClient = createClient();
await redisClient.connect();

const server = new McpServer({
  name: "Shared-State Server",
  version: "1.0.0"
});

// Session management with Redis
class RedisSessionManager {
  constructor(private redis: ReturnType<typeof createClient>) {}
  
  async createSession(sessionId: string): Promise<void> {
    await this.redis.hSet(`session:${sessionId}`, {
      createdAt: Date.now().toString(),
      lastActivity: Date.now().toString()
    });
    await this.redis.expire(`session:${sessionId}`, 30 * 60); // 30 minutes
  }
  
  async getSession(sessionId: string): Promise<SessionData | null> {
    const data = await this.redis.hGetAll(`session:${sessionId}`);
    
    if (!Object.keys(data).length) {
      return null;
    }
    
    // Update last activity
    await this.redis.hSet(`session:${sessionId}`, "lastActivity", Date.now().toString());
    await this.redis.expire(`session:${sessionId}`, 30 * 60); // Refresh expiration
    
    return {
      createdAt: parseInt(data.createdAt, 10),
      lastActivity: parseInt(data.lastActivity, 10),
      resources: new Set(JSON.parse(data.resources || "[]")),
      context: JSON.parse(data.context || "{}")
    };
  }
  
  async recordResourceAccess(sessionId: string, uri: string): Promise<void> {
    const session = await this.getSession(sessionId);
    
    if (session) {
      session.resources.add(uri);
      await this.redis.hSet(
        `session:${sessionId}`,
        "resources",
        JSON.stringify([...session.resources])
      );
    }
  }
}

const sessionManager = new RedisSessionManager(redisClient);

// Use the Redis session manager with your server
server.resource(
  "user-data",
  "user-data://current",
  async (uri, params, context) => {
    const sessionId = context.connectionId;
    const session = await sessionManager.getSession(sessionId);
    
    if (!session) {
      throw new Error("Session not found");
    }
    
    // Use session data
    // ...
    
    await sessionManager.recordResourceAccess(sessionId, uri.href);
    
    // Return response
    // ...
  }
);
```

## Practical Exercise: Basic MCP Server

Let's build a basic MCP server that provides weather information and a calculator tool.

### Step-by-step Implementation

#### 1. Project Setup

```bash
# Create project directory
mkdir weather-calculator-server
cd weather-calculator-server

# Initialize project
pnpm init
pnpm add @modelcontextprotocol/sdk zod
pnpm add -D typescript tsx @types/node

# Create tsconfig.json
echo '{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}' > tsconfig.json

# Create source directory
mkdir -p src
```

#### 2. Create the Server

```typescript
// src/server.ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Sample weather data
const weatherData = {
  "new-york": {
    temperature: 22,
    condition: "Partly Cloudy",
    humidity: 65,
    windSpeed: 10
  },
  "london": {
    temperature: 15,
    condition: "Rainy",
    humidity: 80,
    windSpeed: 15
  },
  "tokyo": {
    temperature: 28,
    condition: "Sunny",
    humidity: 70,
    windSpeed: 8
  },
  "sydney": {
    temperature: 25,
    condition: "Clear",
    humidity: 60,
    windSpeed: 12
  }
};

async function main() {
  // Create the MCP server
  const server = new McpServer({
    name: "Weather & Calculator Server",
    version: "1.0.0",
    description: "A simple MCP server providing weather data and calculator tools"
  });
  
  // Add a weather resource
  server.resource(
    "weather",
    new ResourceTemplate("weather://{city}"),
    async (uri, { city }) => {
      const cityLower = city.toLowerCase();
      const data = weatherData[cityLower];
      
      if (!data) {
        throw new Error(`Weather data not available for ${city}`);
      }
      
      return {
        contents: [{
          uri: uri.href,
          text: `Weather for ${city}:\n` +
                `Temperature: ${data.temperature}°C\n` +
                `Condition: ${data.condition}\n` +
                `Humidity: ${data.humidity}%\n` +
                `Wind Speed: ${data.windSpeed} km/h`,
          metadata: {
            city,
            ...data
          }
        }]
      };
    }
  );
  
  // Add a cities list resource
  server.resource(
    "cities",
    "weather://cities",
    async (uri) => {
      const cities = Object.keys(weatherData);
      
      return {
        contents: [{
          uri: uri.href,
          text: `Available cities:\n${cities.map(city => `- ${city}`).join('\n')}`,
          metadata: {
            count: cities.length
          }
        }]
      };
    }
  );
  
  // Add calculator tools
  server.tool(
    "calculator.add",
    { a: z.number(), b: z.number() },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }]
    })
  );
  
  server.tool(
    "calculator.subtract",
    { a: z.number(), b: z.number() },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a - b) }]
    })
  );
  
  server.tool(
    "calculator.multiply",
    { a: z.number(), b: z.number() },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a * b) }]
    })
  );
  
  server.tool(
    "calculator.divide",
    { a: z.number(), b: z.number() },
    async ({ a, b }) => {
      if (b === 0) {
        throw new Error("Division by zero");
      }
      return {
        content: [{ type: "text", text: String(a / b) }]
      };
    }
  );
  
  // Connect with stdio transport
  console.log("Starting Weather & Calculator Server...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("Server running. Press Ctrl+C to stop.");
}

main().catch(error => {
  console.error("Server error:", error);
  process.exit(1);
});
```

#### 3. Add a Package Script

Update `package.json` to add a start script:

```json
{
  "name": "weather-calculator-server",
  "version": "1.0.0",
  "description": "A simple MCP server providing weather data and calculator tools",
  "main": "dist/server.js",
  "type": "module",
  "scripts": {
    "start": "tsx src/server.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "tsx": "^4.6.0",
    "typescript": "^5.3.2"
  }
}
```

#### 4. Run the Server

```bash
pnpm start
```

### Testing the Server

To test the server, you can use the MCP CLI tool or create a simple test client:

```typescript
// src/test-client.ts
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";

async function main() {
  // Start the server process
  const serverProcess = spawn("pnpm", ["start"], {
    stdio: ["pipe", "pipe", process.stderr]
  });
  
  // Create a client that connects to the server
  const transport = new StdioClientTransport({
    input: serverProcess.stdout,
    output: serverProcess.stdin
  });
  
  const client = new McpClient(transport);
  
  try {
    // Connect to the server
    console.log("Connecting to server...");
    await client.connect();
    console.log("Connected!");
    
    // Test weather resource
    console.log("\nFetching weather for London:");
    const londonWeather = await client.fetchResource("weather://london");
    console.log(londonWeather[0].text);
    
    // Test cities list
    console.log("\nFetching available cities:");
    const cities = await client.fetchResource("weather://cities");
    console.log(cities[0].text);
    
    // Test calculator tools
    console.log("\nTesting calculator tools:");
    
    const addResult = await client.executeAction("calculator.add", { a: 5, b: 3 });
    console.log("5 + 3 =", addResult.content[0].text);
    
    const subtractResult = await client.executeAction("calculator.subtract", { a: 10, b: 4 });
    console.log("10 - 4 =", subtractResult.content[0].text);
    
    const multiplyResult = await client.executeAction("calculator.multiply", { a: 6, b: 7 });
    console.log("6 * 7 =", multiplyResult.content[0].text);
    
    const divideResult = await client.executeAction("calculator.divide", { a: 20, b: 5 });
    console.log("20 / 5 =", divideResult.content[0].text);
    
    // Test error handling
    try {
      console.log("\nTesting error handling (division by zero):");
      await client.executeAction("calculator.divide", { a: 10, b: 0 });
    } catch (error) {
      console.log("Error caught successfully:", error.message);
    }
  } finally {
    // Disconnect and clean up
    await client.disconnect();
    serverProcess.kill();
  }
}

main().catch(error => {
  console.error("Test error:", error);
  process.exit(1);
});
```

Run the test client:

```bash
tsx src/test-client.ts
```

### Common Pitfalls and Solutions

When building MCP servers, there are several common pitfalls to watch out for:

#### 1. Forgetting to Handle Errors

```typescript
// Incorrect: No error handling
server.tool(
  "risky-operation",
  { input: z.string() },
  async ({ input }) => {
    // This might throw an error
    const result = processInput(input);
    return {
      content: [{ type: "text", text: result }]
    };
  }
);

// Correct: Proper error handling
server.tool(
  "risky-operation",
  { input: z.string() },
  async ({ input }) => {
    try {
      const result = processInput(input);
      return {
        content: [{ type: "text", text: result }]
      };
    } catch (error) {
      // Log the error
      console.error("Error processing input:", error);
      
      // Return a user-friendly error message
      throw new Error(`Failed to process input: ${error.message}`);
    }
  }
);
```

#### 2. Not Validating Resource URIs

```typescript
// Incorrect: No URI validation
server.resource(
  "document",
  new ResourceTemplate("docs://{documentId}"),
  async (uri, { documentId }) => {
    // This might fail if documentId is invalid
    const document = await documentStore.get(documentId);
    
    return {
      contents: [{
        uri: uri.href,
        text: document.content
      }]
    };
  }
);

// Correct: Proper URI validation
server.resource(
  "document",
  new ResourceTemplate("docs://{documentId}"),
  async (uri, { documentId }) => {
    // Validate the documentId
    if (!isValidDocumentId(documentId)) {
      throw new Error(`Invalid document ID: ${documentId}`);
    }
    
    // Check if the document exists
    const document = await documentStore.get(documentId);
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }
    
    return {
      contents: [{
        uri: uri.href,
        text: document.content
      }]
    };
  }
);
```

#### 3. Blocking the Event Loop

```typescript
// Incorrect: Blocking operation
server.tool(
  "heavy-computation",
  { input: z.number() },
  async ({ input }) => {
    // This will block the event loop
    const result = computeFactorial(input);
    
    return {
      content: [{ type: "text", text: String(result) }]
    };
  }
);

// Correct: Non-blocking operation
server.tool(
  "heavy-computation",
  { input: z.number() },
  async ({ input }) => {
    // Use a worker thread for CPU-intensive tasks
    const result = await computeInWorker(input);
    
    return {
      content: [{ type: "text", text: String(result) }]
    };
  }
);

// Helper function to run computation in a worker thread
function computeInWorker(input: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./compute-worker.js');
    
    worker.on('message', (result) => {
      resolve(result);
      worker.terminate();
    });
    
    worker.on('error', (error) => {
      reject(error);
      worker.terminate();
    });
    
    worker.postMessage({ type: 'factorial', input });
  });
}
```

#### 4. Not Handling Disconnections

```typescript
// Incorrect: No disconnection handling
const server = new McpServer({
  name: "Example Server",
  version: "1.0.0"
});

// Correct: Proper disconnection handling
const server = new McpServer({
  name: "Example Server",
  version: "1.0.0",
  
  onConnection: (context) => {
    console.log(`Client connected: ${context.connectionId}`);
    
    // Set up resources for this connection
    const resources = allocateResources();
    
    context.onClose(() => {
      console.log(`Client disconnected: ${context.connectionId}`);
      
      // Clean up resources
      releaseResources(resources);
    });
  }
});
```

By understanding these common pitfalls and their solutions, you can build more robust and reliable MCP servers.

This section has covered the key aspects of building an MCP server in TypeScript, including server architecture, protocol handlers, client connection management, and a practical exercise. In the next section, we'll explore how to build MCP clients that can connect to these servers.

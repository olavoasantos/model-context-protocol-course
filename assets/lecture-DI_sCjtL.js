const e=`# Section 8: Testing and Debugging MCP Applications

Testing and debugging are critical aspects of developing robust MCP applications. In this section, we'll explore various techniques and tools for testing and debugging both client and server components of MCP systems.

## Unit Testing MCP Components

Unit testing ensures that individual components of your MCP application work as expected in isolation. Let's explore how to effectively test different parts of an MCP system.

### Setting Up a Testing Environment

Before writing tests, we need to set up a proper testing environment:

\`\`\`typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/']
    },
    globals: true
  }
});
\`\`\`

Add the necessary dependencies to your project:

\`\`\`bash
pnpm add -D vitest @vitest/coverage-c8 @vitest/ui
\`\`\`

Update your \`package.json\` with test scripts:

\`\`\`json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
\`\`\`

### Testing MCP Server Components

Let's start by testing server-side components:

#### Testing Resource Handlers

Resource handlers are a key part of MCP servers. Here's how to test them:

\`\`\`typescript
// src/server/resources/document-resource.ts
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface Document {
  id: string;
  title: string;
  content: string;
  author: string;
  lastUpdated: Date;
}

export class DocumentStore {
  private documents: Map<string, Document> = new Map();
  
  addDocument(doc: Document): void {
    this.documents.set(doc.id, doc);
  }
  
  getDocument(id: string): Document | undefined {
    return this.documents.get(id);
  }
  
  getAllDocuments(): Document[] {
    return Array.from(this.documents.values());
  }
}

export const documentResourceHandler = (store: DocumentStore) => {
  return async (uri: URL, params: { documentId: string }) => {
    const { documentId } = params;
    const document = store.getDocument(documentId);
    
    if (!document) {
      throw new Error(\`Document not found: \${documentId}\`);
    }
    
    return {
      contents: [{
        uri: uri.href,
        text: document.content,
        metadata: {
          title: document.title,
          author: document.author,
          lastUpdated: document.lastUpdated
        }
      }]
    };
  };
};

export const documentResourceTemplate = new ResourceTemplate("docs://{documentId}");
\`\`\`

Now, let's write tests for this resource handler:

\`\`\`typescript
// src/server/resources/document-resource.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { documentResourceHandler, documentResourceTemplate, DocumentStore } from './document-resource';

describe('Document Resource Handler', () => {
  let store: DocumentStore;
  
  beforeEach(() => {
    store = new DocumentStore();
    
    // Add test documents
    store.addDocument({
      id: 'doc1',
      title: 'Test Document 1',
      content: 'This is test document 1',
      author: 'Test Author',
      lastUpdated: new Date('2023-01-01')
    });
    
    store.addDocument({
      id: 'doc2',
      title: 'Test Document 2',
      content: 'This is test document 2',
      author: 'Another Author',
      lastUpdated: new Date('2023-02-01')
    });
  });
  
  it('should return the correct document content', async () => {
    const handler = documentResourceHandler(store);
    const uri = new URL('docs://doc1');
    
    const result = await handler(uri, { documentId: 'doc1' });
    
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].text).toBe('This is test document 1');
    expect(result.contents[0].metadata).toEqual({
      title: 'Test Document 1',
      author: 'Test Author',
      lastUpdated: new Date('2023-01-01')
    });
  });
  
  it('should throw an error for non-existent documents', async () => {
    const handler = documentResourceHandler(store);
    const uri = new URL('docs://nonexistent');
    
    await expect(handler(uri, { documentId: 'nonexistent' }))
      .rejects
      .toThrow('Document not found: nonexistent');
  });
  
  it('should correctly parse URI parameters', () => {
    const uri = new URL('docs://doc123');
    const match = documentResourceTemplate.match(uri);
    
    expect(match).not.toBeNull();
    expect(match?.documentId).toBe('doc123');
  });
});
\`\`\`

#### Testing Action Handlers

Action handlers are another important component to test:

\`\`\`typescript
// src/server/actions/calculator-action.ts
import { z } from "zod";

export const calculatorSchema = {
  a: z.number(),
  b: z.number()
};

export const calculatorActionHandler = async (params: { a: number; b: number }) => {
  const { a, b } = params;
  
  return {
    content: [{ 
      type: "text", 
      text: String(a + b) 
    }]
  };
};
\`\`\`

Let's test this action handler:

\`\`\`typescript
// src/server/actions/calculator-action.test.ts
import { describe, it, expect } from 'vitest';
import { calculatorActionHandler, calculatorSchema } from './calculator-action';
import { z } from 'zod';

describe('Calculator Action Handler', () => {
  it('should correctly add two numbers', async () => {
    const result = await calculatorActionHandler({ a: 5, b: 3 });
    
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('8');
  });
  
  it('should handle negative numbers', async () => {
    const result = await calculatorActionHandler({ a: -5, b: 3 });
    
    expect(result.content[0].text).toBe('-2');
  });
  
  it('should validate input parameters', () => {
    const schema = z.object(calculatorSchema);
    
    // Valid input
    expect(() => schema.parse({ a: 5, b: 3 })).not.toThrow();
    
    // Invalid input: missing parameter
    expect(() => schema.parse({ a: 5 })).toThrow();
    
    // Invalid input: wrong type
    expect(() => schema.parse({ a: '5', b: 3 })).toThrow();
  });
});
\`\`\`

#### Testing the MCP Server

Testing the entire MCP server requires a bit more setup:

\`\`\`typescript
// src/server/mcp-server.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";
import { documentResourceHandler, documentResourceTemplate, DocumentStore } from './resources/document-resource';
import { calculatorActionHandler, calculatorSchema } from './actions/calculator-action';

describe('MCP Server Integration', () => {
  let server: McpServer;
  let client: McpClient;
  let transport: HttpServerTransport;
  let documentStore: DocumentStore;
  
  const PORT = 3456; // Use a different port for tests
  
  beforeAll(async () => {
    // Set up the server
    server = new McpServer({
      name: "Test Server",
      version: "1.0.0"
    });
    
    // Set up document store with test data
    documentStore = new DocumentStore();
    documentStore.addDocument({
      id: 'test-doc',
      title: 'Test Document',
      content: 'This is a test document for integration testing',
      author: 'Test Author',
      lastUpdated: new Date('2023-01-01')
    });
    
    // Register resources and actions
    server.resource(
      "document",
      documentResourceTemplate,
      documentResourceHandler(documentStore)
    );
    
    server.tool(
      "calculator.add",
      calculatorSchema,
      calculatorActionHandler
    );
    
    // Start the server
    transport = new HttpServerTransport({ port: PORT });
    await server.connect(transport);
    
    // Create a client
    const clientTransport = new HttpClientTransport(\`http://localhost:\${PORT}\`);
    client = new McpClient(clientTransport);
    await client.connect();
  });
  
  afterAll(async () => {
    // Clean up
    await client.disconnect();
    await server.disconnect();
  });
  
  it('should fetch a document resource', async () => {
    const resources = await client.fetchResource('docs://test-doc');
    
    expect(resources).toHaveLength(1);
    expect(resources[0].text).toBe('This is a test document for integration testing');
    expect(resources[0].metadata).toEqual({
      title: 'Test Document',
      author: 'Test Author',
      lastUpdated: new Date('2023-01-01').toISOString() // Note: dates are serialized
    });
  });
  
  it('should execute a calculator action', async () => {
    const result = await client.executeAction('calculator.add', { a: 10, b: 5 });
    
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('15');
  });
  
  it('should handle resource not found errors', async () => {
    await expect(client.fetchResource('docs://nonexistent'))
      .rejects
      .toThrow();
  });
  
  it('should handle invalid action parameters', async () => {
    await expect(client.executeAction('calculator.add', { a: 10 } as any))
      .rejects
      .toThrow();
  });
});
\`\`\`

### Testing MCP Client Components

Now, let's look at testing client-side components:

#### Testing Context Management

Context management is a critical part of MCP clients:

\`\`\`typescript
// src/client/context-manager.ts
export interface ContextItem {
  uri: string;
  text: string;
  tokenCount: number;
  timestamp: number;
  priority: number;
}

export class ContextManager {
  private items: Map<string, ContextItem> = new Map();
  private totalTokens: number = 0;
  private maxTokens: number;
  
  constructor(maxTokens: number = 8000) {
    this.maxTokens = maxTokens;
  }
  
  // Add an item to the context
  addItem(uri: string, text: string, priority: number = 1): boolean {
    const tokenCount = this.estimateTokens(text);
    
    // Check if we need to make room
    if (this.totalTokens + tokenCount > this.maxTokens) {
      if (!this.makeRoom(tokenCount)) {
        return false; // Couldn't make enough room
      }
    }
    
    // Add or update the item
    this.items.set(uri, {
      uri,
      text,
      tokenCount,
      timestamp: Date.now(),
      priority
    });
    
    this.totalTokens += tokenCount;
    return true;
  }
  
  // Remove an item from the context
  removeItem(uri: string): boolean {
    const item = this.items.get(uri);
    if (item) {
      this.items.delete(uri);
      this.totalTokens -= item.tokenCount;
      return true;
    }
    return false;
  }
  
  // Get all items in the context
  getItems(): ContextItem[] {
    return Array.from(this.items.values());
  }
  
  // Check if an item is in the context
  hasItem(uri: string): boolean {
    return this.items.has(uri);
  }
  
  // Get the current token usage
  getTokenUsage(): { used: number; total: number; percentage: number } {
    return {
      used: this.totalTokens,
      total: this.maxTokens,
      percentage: (this.totalTokens / this.maxTokens) * 100
    };
  }
  
  // Clear the context
  clear(): void {
    this.items.clear();
    this.totalTokens = 0;
  }
  
  // Make room for new content by removing low-priority items
  private makeRoom(requiredTokens: number): boolean {
    // If the required tokens exceed the max, it's impossible
    if (requiredTokens > this.maxTokens) {
      return false;
    }
    
    // If we already have enough room, no action needed
    if (this.totalTokens + requiredTokens <= this.maxTokens) {
      return true;
    }
    
    // Sort items by priority (ascending) and then by timestamp (ascending)
    const sortedItems = Array.from(this.items.values()).sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.timestamp - b.timestamp;
    });
    
    // Remove items until we have enough room
    const targetTokens = this.maxTokens - requiredTokens;
    for (const item of sortedItems) {
      if (this.totalTokens <= targetTokens) {
        break;
      }
      
      this.items.delete(item.uri);
      this.totalTokens -= item.tokenCount;
    }
    
    return this.totalTokens <= targetTokens;
  }
  
  // Estimate the number of tokens in a text
  private estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }
}
\`\`\`

Let's test this context manager:

\`\`\`typescript
// src/client/context-manager.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextManager } from './context-manager';

describe('Context Manager', () => {
  let contextManager: ContextManager;
  
  beforeEach(() => {
    contextManager = new ContextManager(100); // Small max tokens for testing
    vi.useFakeTimers(); // Use fake timers for timestamp testing
  });
  
  it('should add items to the context', () => {
    const added = contextManager.addItem('test://1', 'This is a test item', 1);
    
    expect(added).toBe(true);
    expect(contextManager.hasItem('test://1')).toBe(true);
    expect(contextManager.getItems()).toHaveLength(1);
    expect(contextManager.getItems()[0].text).toBe('This is a test item');
  });
  
  it('should track token usage correctly', () => {
    // Each item is about 5 tokens (20 chars / 4)
    contextManager.addItem('test://1', 'This is item one.', 1);
    contextManager.addItem('test://2', 'This is item two.', 1);
    
    const usage = contextManager.getTokenUsage();
    expect(usage.used).toBe(10); // ~5 tokens per item
    expect(usage.total).toBe(100);
    expect(usage.percentage).toBe(10);
  });
  
  it('should remove items to make room when needed', () => {
    // Add items that will fill up the context
    contextManager.addItem('test://1', 'A'.repeat(80), 1); // ~20 tokens
    
    // This should cause the first item to be removed
    const added = contextManager.addItem('test://2', 'B'.repeat(400), 2); // ~100 tokens
    
    expect(added).toBe(true);
    expect(contextManager.hasItem('test://1')).toBe(false);
    expect(contextManager.hasItem('test://2')).toBe(true);
  });
  
  it('should prioritize items based on priority and timestamp', () => {
    // Set up timestamps
    vi.setSystemTime(new Date('2023-01-01'));
    contextManager.addItem('test://1', 'Low priority, old', 1);
    
    vi.setSystemTime(new Date('2023-01-02'));
    contextManager.addItem('test://2', 'Low priority, new', 1);
    
    vi.setSystemTime(new Date('2023-01-03'));
    contextManager.addItem('test://3', 'High priority, newest', 3);
    
    // Add an item that requires removing others
    vi.setSystemTime(new Date('2023-01-04'));
    contextManager.addItem('test://4', 'A'.repeat(280), 2); // ~70 tokens
    
    // Low priority, old should be removed first
    expect(contextManager.hasItem('test://1')).toBe(false);
    
    // Then low priority, new
    expect(contextManager.hasItem('test://2')).toBe(false);
    
    // High priority should remain
    expect(contextManager.hasItem('test://3')).toBe(true);
    expect(contextManager.hasItem('test://4')).toBe(true);
  });
  
  it('should reject items larger than max tokens', () => {
    const added = contextManager.addItem('test://large', 'A'.repeat(500), 1); // ~125 tokens
    
    expect(added).toBe(false);
    expect(contextManager.hasItem('test://large')).toBe(false);
  });
  
  it('should clear all items', () => {
    contextManager.addItem('test://1', 'Item 1', 1);
    contextManager.addItem('test://2', 'Item 2', 1);
    
    contextManager.clear();
    
    expect(contextManager.getItems()).toHaveLength(0);
    expect(contextManager.getTokenUsage().used).toBe(0);
  });
});
\`\`\`

#### Testing Client API Wrappers

Let's test a client API wrapper:

\`\`\`typescript
// src/client/mcp-client-wrapper.ts
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";

export class McpClientWrapper {
  private client: McpClient;
  private connected: boolean = false;
  
  constructor(serverUrl: string) {
    const transport = new HttpClientTransport(serverUrl);
    this.client = new McpClient(transport);
  }
  
  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }
  
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
      this.connected = false;
    }
  }
  
  async fetchDocument(documentId: string): Promise<string> {
    if (!this.connected) {
      throw new Error('Client not connected');
    }
    
    const resources = await this.client.fetchResource(\`docs://\${documentId}\`);
    
    if (resources.length === 0) {
      throw new Error(\`Document not found: \${documentId}\`);
    }
    
    return resources[0].text;
  }
  
  async calculateSum(a: number, b: number): Promise<number> {
    if (!this.connected) {
      throw new Error('Client not connected');
    }
    
    const result = await this.client.executeAction('calculator.add', { a, b });
    
    if (result.content.length === 0 || result.content[0].type !== 'text') {
      throw new Error('Invalid response format');
    }
    
    return parseInt(result.content[0].text, 10);
  }
  
  isConnected(): boolean {
    return this.connected;
  }
}
\`\`\`

Now, let's test this wrapper with mocks:

\`\`\`typescript
// src/client/mcp-client-wrapper.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpClientWrapper } from './mcp-client-wrapper';
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";

// Mock the MCP SDK
vi.mock("@modelcontextprotocol/sdk/client/mcp.js", () => {
  return {
    McpClient: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      fetchResource: vi.fn(),
      executeAction: vi.fn()
    }))
  };
});

vi.mock("@modelcontextprotocol/sdk/client/http.js", () => {
  return {
    HttpClientTransport: vi.fn().mockImplementation(() => ({}))
  };
});

describe('MCP Client Wrapper', () => {
  let wrapper: McpClientWrapper;
  let mockClient: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    wrapper = new McpClientWrapper('http://localhost:3000');
    mockClient = (McpClient as any).mock.results[0].value;
  });
  
  it('should connect to the server', async () => {
    await wrapper.connect();
    
    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect(wrapper.isConnected()).toBe(true);
  });
  
  it('should disconnect from the server', async () => {
    await wrapper.connect();
    await wrapper.disconnect();
    
    expect(mockClient.disconnect).toHaveBeenCalledTimes(1);
    expect(wrapper.isConnected()).toBe(false);
  });
  
  it('should fetch a document', async () => {
    mockClient.fetchResource.mockResolvedValue([{
      uri: 'docs://test-doc',
      text: 'Test document content'
    }]);
    
    await wrapper.connect();
    const content = await wrapper.fetchDocument('test-doc');
    
    expect(mockClient.fetchResource).toHaveBeenCalledWith('docs://test-doc');
    expect(content).toBe('Test document content');
  });
  
  it('should handle empty resource results', async () => {
    mockClient.fetchResource.mockResolvedValue([]);
    
    await wrapper.connect();
    
    await expect(wrapper.fetchDocument('nonexistent'))
      .rejects
      .toThrow('Document not found: nonexistent');
  });
  
  it('should calculate a sum', async () => {
    mockClient.executeAction.mockResolvedValue({
      content: [{ type: 'text', text: '15' }]
    });
    
    await wrapper.connect();
    const sum = await wrapper.calculateSum(10, 5);
    
    expect(mockClient.executeAction).toHaveBeenCalledWith('calculator.add', { a: 10, b: 5 });
    expect(sum).toBe(15);
  });
  
  it('should throw an error if not connected', async () => {
    await expect(wrapper.fetchDocument('test-doc'))
      .rejects
      .toThrow('Client not connected');
      
    await expect(wrapper.calculateSum(10, 5))
      .rejects
      .toThrow('Client not connected');
  });
});
\`\`\`

## Integration Testing for MCP Systems

Integration testing ensures that different components of your MCP system work together correctly.

### Setting Up Integration Tests

For integration tests, we need to set up a test environment that includes both client and server components:

\`\`\`typescript
// src/integration/setup.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { z } from "zod";

export async function setupTestServer(port: number = 3456): Promise<McpServer> {
  const server = new McpServer({
    name: "Integration Test Server",
    version: "1.0.0"
  });
  
  // Add test resources
  server.resource(
    "test-resource",
    "test://{id}",
    async (uri, { id }) => {
      return {
        contents: [{
          uri: uri.href,
          text: \`Test resource \${id}\`,
          metadata: { id }
        }]
      };
    }
  );
  
  // Add test actions
  server.tool(
    "test.echo",
    { message: z.string() },
    async ({ message }) => {
      return {
        content: [{ 
          type: "text", 
          text: message 
        }]
      };
    }
  );
  
  server.tool(
    "test.error",
    { message: z.string() },
    async ({ message }) => {
      throw new Error(message);
    }
  );
  
  // Start the server
  const transport = new HttpServerTransport({ port });
  await server.connect(transport);
  
  return server;
}
\`\`\`

### Testing Client-Server Interactions

Now, let's write integration tests for client-server interactions:

\`\`\`typescript
// src/integration/client-server.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestServer } from './setup';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";

describe('Client-Server Integration', () => {
  let server: McpServer;
  let client: McpClient;
  const TEST_PORT = 3456;
  
  beforeAll(async () => {
    // Set up the server
    server = await setupTestServer(TEST_PORT);
    
    // Set up the client
    const transport = new HttpClientTransport(\`http://localhost:\${TEST_PORT}\`);
    client = new McpClient(transport);
    await client.connect();
  });
  
  afterAll(async () => {
    // Clean up
    await client.disconnect();
    await server.disconnect();
  });
  
  it('should fetch a resource', async () => {
    const resources = await client.fetchResource('test://123');
    
    expect(resources).toHaveLength(1);
    expect(resources[0].text).toBe('Test resource 123');
    expect(resources[0].metadata).toEqual({ id: '123' });
  });
  
  it('should execute an action', async () => {
    const result = await client.executeAction('test.echo', { 
      message: 'Hello, world!' 
    });
    
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('Hello, world!');
  });
  
  it('should handle errors', async () => {
    await expect(client.executeAction('test.error', { 
      message: 'Test error' 
    })).rejects.toThrow('Test error');
  });
  
  it('should handle non-existent resources', async () => {
    await expect(client.fetchResource('nonexistent://123'))
      .rejects
      .toThrow();
  });
  
  it('should handle non-existent actions', async () => {
    await expect(client.executeAction('nonexistent.action', {}))
      .rejects
      .toThrow();
  });
});
\`\`\`

### Testing Streaming Resources

Streaming resources require special testing techniques:

\`\`\`typescript
// src/integration/streaming.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";

describe('Streaming Resources', () => {
  let server: McpServer;
  let client: McpClient;
  const TEST_PORT = 3457;
  
  beforeAll(async () => {
    // Set up the server
    server = new McpServer({
      name: "Streaming Test Server",
      version: "1.0.0"
    });
    
    // Add streaming resource
    server.streamingResource(
      "counter",
      "stream://counter/{count}",
      async (uri, { count }, stream) => {
        const maxCount = parseInt(count, 10);
        
        // Send initial state
        await stream.send([{
          uri: uri.href,
          text: \`Counter: 0/\${maxCount}\`,
          metadata: { current: 0, max: maxCount }
        }]);
        
        // Send updates
        for (let i = 1; i <= maxCount; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          await stream.send([{
            uri: \`\${uri.href}/update\`,
            text: \`Counter: \${i}/\${maxCount}\`,
            metadata: { current: i, max: maxCount }
          }]);
        }
      }
    );
    
    // Start the server
    const transport = new HttpServerTransport({ port: TEST_PORT });
    await server.connect(transport);
    
    // Set up the client
    const clientTransport = new HttpClientTransport(\`http://localhost:\${TEST_PORT}\`);
    client = new McpClient(clientTransport);
    await client.connect();
  });
  
  afterAll(async () => {
    // Clean up
    await client.disconnect();
    await server.disconnect();
  });
  
  it('should receive streaming updates', async () => {
    const messages: any[] = [];
    
    // Start streaming
    const stream = await client.streamResource('stream://counter/3');
    
    // Collect messages
    stream.onMessage(resources => {
      messages.push(...resources);
    });
    
    // Wait for all updates
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Close the stream
    await stream.close();
    
    // Verify results
    expect(messages.length).toBeGreaterThanOrEqual(4); // Initial + 3 updates
    
    // Check initial state
    expect(messages[0].text).toBe('Counter: 0/3');
    expect(messages[0].metadata).toEqual({ current: 0, max: 3 });
    
    // Check final state
    const lastMessage = messages[messages.length - 1];
    expect(lastMessage.text).toBe('Counter: 3/3');
    expect(lastMessage.metadata).toEqual({ current: 3, max: 3 });
  });
});
\`\`\`

## Debugging Common Issues

Debugging MCP applications can be challenging. Let's explore common issues and how to debug them.

### Server-side Debugging

#### Setting Up Logging

Proper logging is essential for debugging server-side issues:

\`\`\`typescript
// src/server/logger.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

export class Logger {
  private minLevel: LogLevel;
  private entries: LogEntry[] = [];
  private listeners: ((entry: LogEntry) => void)[] = [];
  
  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLevel = minLevel;
  }
  
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }
  
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }
  
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }
  
  error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }
  
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (level < this.minLevel) {
      return;
    }
    
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context
    };
    
    this.entries.push(entry);
    
    // Notify listeners
    for (const listener of this.listeners) {
      listener(entry);
    }
    
    // Log to console
    this.logToConsole(entry);
  }
  
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level];
    const contextStr = entry.context ? JSON.stringify(entry.context) : '';
    
    let method: 'log' | 'info' | 'warn' | 'error' = 'log';
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        method = 'log';
        break;
      case LogLevel.INFO:
        method = 'info';
        break;
      case LogLevel.WARN:
        method = 'warn';
        break;
      case LogLevel.ERROR:
        method = 'error';
        break;
    }
    
    console[method](\`[\${timestamp}] \${levelStr}: \${entry.message}\${contextStr ? ' ' + contextStr : ''}\`);
  }
  
  onLog(listener: (entry: LogEntry) => void): () => void {
    this.listeners.push(listener);
    
    // Return a function to remove the listener
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
  
  getEntries(level?: LogLevel): LogEntry[] {
    if (level === undefined) {
      return [...this.entries];
    }
    
    return this.entries.filter(entry => entry.level >= level);
  }
  
  clear(): void {
    this.entries = [];
  }
}
\`\`\`

Now, let's use this logger with our MCP server:

\`\`\`typescript
// src/server/debug-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { Logger, LogLevel } from './logger';
import { z } from "zod";

export async function createDebugServer(port: number = 3000): Promise<McpServer> {
  // Create logger
  const logger = new Logger(LogLevel.DEBUG);
  
  // Create server with logger
  const server = new McpServer({
    name: "Debug Server",
    version: "1.0.0",
    
    // Log all errors
    onError: (error, context) => {
      logger.error('Server error', {
        error: error.message,
        code: error.code,
        details: error.details,
        connectionId: context?.connectionId
      });
    }
  });
  
  // Add resources with logging
  server.resource(
    "debug-resource",
    "debug://{id}",
    async (uri, { id }, context) => {
      logger.info('Resource requested', {
        uri: uri.href,
        id,
        connectionId: context.connectionId
      });
      
      try {
        // Simulate resource fetching
        if (id === 'error') {
          throw new Error('Simulated resource error');
        }
        
        logger.debug('Fetching resource data', { id });
        
        // Simulate successful resource fetch
        const result = {
          contents: [{
            uri: uri.href,
            text: \`Debug resource \${id}\`,
            metadata: { id }
          }]
        };
        
        logger.info('Resource response ready', {
          uri: uri.href,
          contentLength: result.contents[0].text.length
        });
        
        return result;
      } catch (error) {
        logger.error('Resource handler error', {
          uri: uri.href,
          error: error.message
        });
        throw error;
      }
    }
  );
  
  // Add actions with logging
  server.tool(
    "debug.action",
    {
      input: z.string(),
      shouldFail: z.boolean().default(false)
    },
    async ({ input, shouldFail }, context) => {
      logger.info('Action requested', {
        action: 'debug.action',
        input,
        shouldFail,
        connectionId: context.connectionId
      });
      
      try {
        // Simulate action processing
        if (shouldFail) {
          throw new Error('Simulated action error');
        }
        
        logger.debug('Processing action', { input });
        
        // Simulate successful action
        const result = {
          content: [{ 
            type: "text", 
            text: \`Processed: \${input}\` 
          }]
        };
        
        logger.info('Action response ready', {
          action: 'debug.action',
          contentLength: result.content[0].text.length
        });
        
        return result;
      } catch (error) {
        logger.error('Action handler error', {
          action: 'debug.action',
          error: error.message
        });
        throw error;
      }
    }
  );
  
  // Add logging for connections
  server.on('connection', (context) => {
    logger.info('Client connected', {
      connectionId: context.connectionId
    });
    
    context.onClose(() => {
      logger.info('Client disconnected', {
        connectionId: context.connectionId
      });
    });
  });
  
  // Start the server
  logger.info('Starting server', { port });
  
  const transport = new HttpServerTransport({ port });
  await server.connect(transport);
  
  logger.info('Server started', { port });
  
  return server;
}
\`\`\`

#### Debugging Protocol Issues

Protocol issues can be difficult to debug. Here's a utility to help:

\`\`\`typescript
// src/server/protocol-debugger.ts
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Logger, LogLevel } from './logger';

export function startProtocolDebugger(port: number = 3001): void {
  const logger = new Logger(LogLevel.DEBUG);
  
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const startTime = Date.now();
    
    // Log request
    logger.info('Received request', {
      method: req.method,
      url: req.url,
      headers: req.headers
    });
    
    // Collect request body
    const chunks: Buffer[] = [];
    
    req.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      
      // Log request body
      if (body) {
        try {
          const jsonBody = JSON.parse(body);
          logger.debug('Request body (JSON)', { body: jsonBody });
        } catch {
          logger.debug('Request body (raw)', { body });
        }
      }
      
      // Forward to actual MCP server
      forwardRequest(req, body)
        .then(response => {
          // Log response
          logger.info('Received response', {
            status: response.status,
            headers: response.headers,
            time: Date.now() - startTime
          });
          
          // Log response body
          if (response.body) {
            try {
              const jsonBody = JSON.parse(response.body);
              logger.debug('Response body (JSON)', { body: jsonBody });
            } catch {
              logger.debug('Response body (raw)', { body: response.body });
            }
          }
          
          // Send response back to client
          res.writeHead(response.status, response.headers);
          res.end(response.body);
        })
        .catch(error => {
          logger.error('Forward request error', { error: error.message });
          
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Proxy error' }));
        });
    });
  });
  
  server.listen(port, () => {
    logger.info('Protocol debugger started', { port });
    logger.info(\`Forward target: http://localhost:3000\`);
  });
}

async function forwardRequest(
  req: IncomingMessage,
  body: string
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  // Forward to actual MCP server (assumed to be on port 3000)
  const url = \`http://localhost:3000\${req.url}\`;
  
  const response = await fetch(url, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: body || undefined
  });
  
  const responseBody = await response.text();
  
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: responseBody
  };
}
\`\`\`

### Client-side Debugging

#### Debugging Network Issues

Network issues are common in client applications. Here's a utility to help debug them:

\`\`\`typescript
// src/client/network-debugger.ts
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";
import { Logger, LogLevel } from '../server/logger';

export class DebugHttpClientTransport extends HttpClientTransport {
  private logger: Logger;
  
  constructor(url: string, logger: Logger) {
    super(url);
    this.logger = logger;
  }
  
  async send(message: any): Promise<any> {
    this.logger.debug('Sending message', { message });
    
    try {
      const response = await super.send(message);
      this.logger.debug('Received response', { response });
      return response;
    } catch (error) {
      this.logger.error('Transport error', { 
        error: error.message,
        message
      });
      throw error;
    }
  }
}

export function createDebugClient(serverUrl: string): McpClient {
  const logger = new Logger(LogLevel.DEBUG);
  const transport = new DebugHttpClientTransport(serverUrl, logger);
  
  logger.info('Creating debug client', { serverUrl });
  
  const client = new McpClient(transport);
  
  // Log connection events
  const originalConnect = client.connect.bind(client);
  client.connect = async () => {
    logger.info('Connecting to server', { serverUrl });
    
    try {
      await originalConnect();
      logger.info('Connected to server');
    } catch (error) {
      logger.error('Connection error', { error: error.message });
      throw error;
    }
  };
  
  const originalDisconnect = client.disconnect.bind(client);
  client.disconnect = async () => {
    logger.info('Disconnecting from server');
    
    try {
      await originalDisconnect();
      logger.info('Disconnected from server');
    } catch (error) {
      logger.error('Disconnection error', { error: error.message });
      throw error;
    }
  };
  
  // Log resource fetches
  const originalFetchResource = client.fetchResource.bind(client);
  client.fetchResource = async (uri: string) => {
    logger.info('Fetching resource', { uri });
    
    try {
      const resources = await originalFetchResource(uri);
      logger.info('Resource fetched', { 
        uri,
        resourceCount: resources.length
      });
      logger.debug('Resource content', { resources });
      return resources;
    } catch (error) {
      logger.error('Resource fetch error', { 
        uri,
        error: error.message
      });
      throw error;
    }
  };
  
  // Log action executions
  const originalExecuteAction = client.executeAction.bind(client);
  client.executeAction = async (action: string, params: any) => {
    logger.info('Executing action', { action, params });
    
    try {
      const result = await originalExecuteAction(action, params);
      logger.info('Action executed', { action });
      logger.debug('Action result', { result });
      return result;
    } catch (error) {
      logger.error('Action execution error', { 
        action,
        params,
        error: error.message
      });
      throw error;
    }
  };
  
  return client;
}
\`\`\`

#### Debugging Context Window Issues

Context window issues can be subtle. Here's a utility to help debug them:

\`\`\`typescript
// src/client/context-debugger.ts
import { ContextManager, ContextItem } from './context-manager';
import { Logger, LogLevel } from '../server/logger';

export class DebugContextManager extends ContextManager {
  private logger: Logger;
  
  constructor(maxTokens: number = 8000) {
    super(maxTokens);
    this.logger = new Logger(LogLevel.DEBUG);
  }
  
  addItem(uri: string, text: string, priority: number = 1): boolean {
    this.logger.info('Adding item to context', { 
      uri,
      textLength: text.length,
      priority
    });
    
    const tokenCount = this.estimateTokens(text);
    this.logger.debug('Estimated tokens', { tokenCount });
    
    const usage = this.getTokenUsage();
    this.logger.debug('Current token usage', { 
      used: usage.used,
      total: usage.total,
      percentage: usage.percentage
    });
    
    const result = super.addItem(uri, text, priority);
    
    if (result) {
      this.logger.info('Item added to context', { uri });
    } else {
      this.logger.warn('Failed to add item to context', { 
        uri,
        reason: 'Not enough space'
      });
    }
    
    const newUsage = this.getTokenUsage();
    this.logger.debug('New token usage', { 
      used: newUsage.used,
      total: newUsage.total,
      percentage: newUsage.percentage
    });
    
    return result;
  }
  
  removeItem(uri: string): boolean {
    this.logger.info('Removing item from context', { uri });
    
    const result = super.removeItem(uri);
    
    if (result) {
      this.logger.info('Item removed from context', { uri });
    } else {
      this.logger.warn('Failed to remove item from context', { 
        uri,
        reason: 'Item not found'
      });
    }
    
    return result;
  }
  
  clear(): void {
    this.logger.info('Clearing context');
    super.clear();
    this.logger.info('Context cleared');
  }
  
  // Helper method to log the current context state
  logContextState(): void {
    const items = this.getItems();
    const usage = this.getTokenUsage();
    
    this.logger.info('Context state', { 
      itemCount: items.length,
      tokenUsage: usage
    });
    
    for (const item of items) {
      this.logger.debug('Context item', { 
        uri: item.uri,
        tokenCount: item.tokenCount,
        priority: item.priority,
        age: Date.now() - item.timestamp
      });
    }
  }
  
  // Helper method to estimate tokens in text
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
\`\`\`

### Using Browser DevTools

Browser DevTools are invaluable for debugging client-side issues:

1. **Network Tab**: Monitor MCP protocol messages
   - Filter by "fetch" or "XHR" to see MCP requests
   - Examine request and response payloads
   - Check for status codes and error responses

2. **Console Tab**: Add debug logging
   \`\`\`typescript
   // Add this to your client code
   const DEBUG = true;
   
   function debugLog(message: string, data?: any): void {
     if (DEBUG) {
       console.log(\`[MCP] \${message}\`, data);
     }
   }
   
   // Use in your code
   debugLog('Fetching resource', { uri });
   \`\`\`

3. **Application Tab**: Inspect WebSocket connections
   - For streaming resources using WebSockets
   - Monitor connection state and messages

4. **Performance Tab**: Identify performance bottlenecks
   - Record performance during MCP operations
   - Look for long-running tasks or excessive network requests

### Common Issues and Solutions

Here are some common issues and their solutions:

#### 1. Connection Failures

**Symptoms:**
- Client fails to connect to the server
- Connection timeouts
- CORS errors in browser console

**Solutions:**
- Check server URL and port
- Verify server is running
- Check CORS configuration on server
- Check network connectivity
- Verify firewall settings

\`\`\`typescript
// Proper CORS configuration for MCP server
const transport = new HttpServerTransport({
  port: 3000,
  cors: {
    origin: "*", // In production, restrict to your domain
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
  }
});
\`\`\`

#### 2. Resource Not Found Errors

**Symptoms:**
- \`ResourceNotFoundError\` or similar errors
- 404 status codes in network requests

**Solutions:**
- Check resource URI format
- Verify resource handler is registered
- Check for typos in resource names
- Add logging to resource handlers

\`\`\`typescript
// Debug resource URIs
try {
  const resources = await client.fetchResource(uri);
  console.log('Resource fetched:', resources);
} catch (error) {
  console.error('Resource fetch error:', {
    uri,
    error: error.message,
    stack: error.stack
  });
}
\`\`\`

#### 3. Action Execution Failures

**Symptoms:**
- \`ActionExecutionError\` or similar errors
- 400 or 500 status codes in network requests

**Solutions:**
- Check action name
- Verify action handler is registered
- Check parameter types and validation
- Add logging to action handlers

\`\`\`typescript
// Debug action parameters
try {
  const result = await client.executeAction(action, params);
  console.log('Action executed:', result);
} catch (error) {
  console.error('Action execution error:', {
    action,
    params,
    error: error.message,
    stack: error.stack
  });
}
\`\`\`

#### 4. Context Window Overflow

**Symptoms:**
- Missing information in responses
- Unexpected behavior in context-aware features
- Memory usage warnings

**Solutions:**
- Monitor context window usage
- Implement priority-based eviction
- Reduce content size through summarization
- Add logging to context management

\`\`\`typescript
// Monitor context usage
const usage = contextManager.getTokenUsage();
console.log('Context usage:', {
  used: usage.used,
  total: usage.total,
  percentage: usage.percentage.toFixed(1) + '%'
});

if (usage.percentage > 90) {
  console.warn('Context window nearly full!');
}
\`\`\`

#### 5. Streaming Resource Issues

**Symptoms:**
- Missing updates
- Connection drops
- Stalled streams

**Solutions:**
- Check WebSocket connection
- Implement reconnection logic
- Add heartbeat mechanism
- Monitor stream health

\`\`\`typescript
// Robust stream handling
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

async function connectToStream() {
  try {
    const stream = await client.streamResource(uri);
    
    stream.onMessage(resources => {
      console.log('Stream update:', resources);
      // Process resources...
    });
    
    stream.onError(error => {
      console.error('Stream error:', error);
      
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(\`Reconnecting (attempt \${reconnectAttempts})...\`);
        setTimeout(connectToStream, 1000 * reconnectAttempts);
      } else {
        console.error('Max reconnect attempts reached');
      }
    });
    
    stream.onClose(() => {
      console.log('Stream closed');
    });
    
    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;
    
    return stream;
  } catch (error) {
    console.error('Failed to connect to stream:', error);
    
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log(\`Reconnecting (attempt \${reconnectAttempts})...\`);
      setTimeout(connectToStream, 1000 * reconnectAttempts);
    } else {
      console.error('Max reconnect attempts reached');
    }
  }
}
\`\`\`

## Summary

In this section, we've explored various techniques for testing and debugging MCP applications:

1. **Unit Testing**: We learned how to test individual components of MCP applications, including resource handlers, action handlers, and client-side components.

2. **Integration Testing**: We explored how to test client-server interactions and streaming resources to ensure that different parts of the system work together correctly.

3. **Debugging Tools**: We developed utilities for debugging server-side and client-side issues, including logging, protocol debugging, and context window debugging.

4. **Common Issues and Solutions**: We identified common issues in MCP applications and provided solutions for addressing them.

By applying these testing and debugging techniques, you can build more robust and reliable MCP applications. In the next section, we'll explore deployment and production considerations for MCP systems.
`;export{e as default};

const n=`# Section 5: Building an MCP Client in TypeScript

## Project Setup and Dependencies

Building an MCP client requires proper project setup and dependencies to ensure smooth development and integration with MCP servers.

### Required Packages

To build an MCP client in TypeScript, you'll need several key packages:

\`\`\`bash
# Create a new project directory
mkdir mcp-client-project
cd mcp-client-project

# Initialize the project
pnpm init

# Add the MCP SDK and other dependencies
pnpm add @modelcontextprotocol/sdk zod

# Add development dependencies
pnpm add -D typescript tsx @types/node vitest
\`\`\`

The main dependencies include:

1. **@modelcontextprotocol/sdk**: The official TypeScript SDK for MCP, providing client implementation
2. **zod**: For runtime type validation, especially useful for action parameters

Development dependencies include:

1. **typescript**: For TypeScript compilation
2. **tsx**: For running TypeScript files directly
3. **@types/node**: TypeScript type definitions for Node.js
4. **vitest**: For testing your client implementation

### Configuration for Client Applications

Create a TypeScript configuration file (\`tsconfig.json\`) optimized for MCP client development:

\`\`\`json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "declaration": true,
    "sourceMap": true,
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
\`\`\`

For Vite configuration (if building a web client), create a \`vite.config.ts\` file:

\`\`\`typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 3000,
  },
});
\`\`\`

### Development Workflow

A typical development workflow for MCP client applications includes:

1. **Project Structure**: Organize your code for maintainability
2. **Client Implementation**: Implement the MCP client
3. **Testing**: Test your client against MCP servers
4. **Integration**: Integrate the client into your application

Let's set up a basic project structure:

\`\`\`
mcp-client-project/
├── src/
│   ├── client/
│   │   ├── index.ts         # Client exports
│   │   ├── mcp-client.ts    # Client implementation
│   │   └── types.ts         # Client-specific types
│   ├── components/          # UI components (if applicable)
│   ├── utils/               # Utility functions
│   └── index.ts             # Main entry point
├── tests/
│   └── client.test.ts       # Client tests
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration (if applicable)
└── package.json             # Project metadata
\`\`\`

Create the main entry point (\`src/index.ts\`):

\`\`\`typescript
// Export client implementation
export * from './client';

// Example usage
import { createMcpClient } from './client';

async function example() {
  // Create an MCP client
  const client = createMcpClient({
    url: 'http://localhost:3000/mcp'
  });
  
  try {
    // Connect to the server
    await client.connect();
    console.log('Connected to MCP server');
    
    // Fetch a resource
    const resources = await client.fetchResource('docs://getting-started');
    console.log('Fetched resource:', resources[0].text);
    
    // Execute an action
    const result = await client.executeAction('calculator.add', { a: 5, b: 3 });
    console.log('Action result:', result.content[0].text);
    
    // Disconnect
    await client.disconnect();
    console.log('Disconnected from MCP server');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  example();
}
\`\`\`

## Implementing Client-side Protocol

The client-side protocol implementation handles communication with MCP servers, including connection establishment, message exchange, and error handling.

### Connection Establishment

The first step in using an MCP client is establishing a connection with the server:

\`\`\`typescript
// src/client/mcp-client.ts
import { 
  McpClient, 
  HttpClientTransport 
} from '@modelcontextprotocol/sdk/client/mcp.js';

// Create a client with HTTP transport
const transport = new HttpClientTransport('http://localhost:3000/mcp');
const client = new McpClient(transport);

// Connect to the server
async function connectToServer() {
  try {
    console.log('Connecting to MCP server...');
    await client.connect();
    console.log('Connected successfully!');
    
    // The client is now ready to use
  } catch (error) {
    console.error('Connection failed:', error);
    throw error;
  }
}
\`\`\`

For more flexibility, you can create a factory function that supports different transport types:

\`\`\`typescript
// src/client/index.ts
import { 
  McpClient, 
  HttpClientTransport,
  StdioClientTransport 
} from '@modelcontextprotocol/sdk/client';

export interface McpClientOptions {
  transportType?: 'http' | 'stdio';
  url?: string;
  timeout?: number;
}

export function createMcpClient(options: McpClientOptions = {}): McpClient {
  const {
    transportType = 'http',
    url = 'http://localhost:3000/mcp',
    timeout = 30000,
  } = options;
  
  let transport;
  
  if (transportType === 'http') {
    transport = new HttpClientTransport(url, { timeout });
  } else if (transportType === 'stdio') {
    transport = new StdioClientTransport();
  } else {
    throw new Error(\`Unsupported transport type: \${transportType}\`);
  }
  
  return new McpClient(transport);
}
\`\`\`

### Message Sending and Receiving

Once connected, the client can send requests and receive responses:

\`\`\`typescript
// Resource requests
async function fetchDocumentation() {
  try {
    // Request a resource by URI
    const resources = await client.fetchResource('docs://introduction');
    
    // Process the resource contents
    for (const resource of resources) {
      console.log(\`Resource: \${resource.uri}\`);
      console.log(resource.text);
      
      // Access metadata if available
      if (resource.metadata) {
        console.log('Metadata:', resource.metadata);
      }
    }
    
    return resources;
  } catch (error) {
    console.error('Failed to fetch documentation:', error);
    throw error;
  }
}

// Action requests
async function performCalculation(a: number, b: number) {
  try {
    // Execute an action with parameters
    const result = await client.executeAction('calculator.add', { a, b });
    
    // Process the action result
    console.log('Calculation result:');
    for (const content of result.content) {
      if (content.type === 'text') {
        console.log(content.text);
      } else {
        console.log(\`Content of type \${content.type}:\`, content);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Calculation failed:', error);
    throw error;
  }
}
\`\`\`

For more advanced use cases, you can work with the low-level message API:

\`\`\`typescript
// Low-level message sending
async function sendCustomRequest() {
  try {
    // Create and send a custom message
    const response = await client.request({
      type: 'resource_request',
      payload: {
        uri: 'custom://resource'
      }
    });
    
    console.log('Response:', response);
    return response;
  } catch (error) {
    console.error('Custom request failed:', error);
    throw error;
  }
}
\`\`\`

### Error Handling

Robust error handling is essential for MCP clients:

\`\`\`typescript
// src/client/error-handling.ts
import { McpError } from '@modelcontextprotocol/sdk/shared';

// Custom error classes
export class ConnectionError extends McpError {
  constructor(message: string, details?: unknown) {
    super(message, 'connection_error', details);
    this.name = 'ConnectionError';
  }
}

export class ResourceError extends McpError {
  constructor(message: string, details?: unknown) {
    super(message, 'resource_error', details);
    this.name = 'ResourceError';
  }
}

export class ActionError extends McpError {
  constructor(message: string, details?: unknown) {
    super(message, 'action_error', details);
    this.name = 'ActionError';
  }
}

// Error handling wrapper
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Transform error based on type
    if (error instanceof McpError) {
      // Pass through MCP errors
      throw error;
    } else if (error instanceof TypeError || error instanceof SyntaxError) {
      // Handle protocol errors
      throw new McpError(
        \`Protocol error in \${context}: \${error.message}\`,
        'protocol_error',
        { originalError: error }
      );
    } else {
      // Handle unexpected errors
      throw new McpError(
        \`Unexpected error in \${context}: \${error.message}\`,
        'unexpected_error',
        { originalError: error }
      );
    }
  }
}

// Usage
async function fetchResourceSafely(uri: string) {
  return withErrorHandling(
    () => client.fetchResource(uri),
    \`fetchResource(\${uri})\`
  );
}
\`\`\`

## Context Window Management

Managing the context window effectively is crucial for LLM applications using MCP.

### Client-side Context Tracking

The client can track which resources have been loaded into the context:

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

### Optimizing Context Usage

Strategies for optimizing context usage include:

#### Selective Loading

\`\`\`typescript
// src/client/selective-loader.ts
import { ContextManager } from './context-manager';

export class SelectiveLoader {
  constructor(
    private client: McpClient,
    private contextManager: ContextManager
  ) {}
  
  // Load a resource only if it's relevant to the query
  async loadRelevantResource(uri: string, query: string): Promise<boolean> {
    // Skip if already in context
    if (this.contextManager.hasItem(uri)) {
      return true;
    }
    
    // Fetch the resource
    const resources = await this.client.fetchResource(uri);
    if (resources.length === 0) {
      return false;
    }
    
    // Check relevance
    const resource = resources[0];
    const relevance = this.calculateRelevance(resource.text, query);
    
    // Only add to context if relevant enough
    if (relevance > 0.5) {
      return this.contextManager.addItem(
        resource.uri,
        resource.text,
        relevance // Use relevance as priority
      );
    }
    
    return false;
  }
  
  // Calculate relevance score between text and query
  private calculateRelevance(text: string, query: string): number {
    const textLower = text.toLowerCase();
    const queryTerms = query.toLowerCase().split(/\\s+/);
    
    let matchCount = 0;
    for (const term of queryTerms) {
      if (textLower.includes(term)) {
        matchCount++;
      }
    }
    
    return matchCount / queryTerms.length;
  }
}
\`\`\`

#### Memory Management

\`\`\`typescript
// src/client/memory-manager.ts
import { ContextManager } from './context-manager';

export class MemoryManager {
  constructor(private contextManager: ContextManager) {}
  
  // Summarize the context to reduce token usage
  async summarizeContext(): Promise<string> {
    const items = this.contextManager.getItems();
    
    // If context is small enough, no need to summarize
    const usage = this.contextManager.getTokenUsage();
    if (usage.percentage < 80) {
      return this.formatContext(items);
    }
    
    // Summarize each item
    const summaries = items.map(item => {
      // Simple summarization: take the first paragraph
      const firstParagraph = item.text.split('\\n\\n')[0];
      return \`\${item.uri}: \${firstParagraph}\`;
    });
    
    return summaries.join('\\n\\n');
  }
  
  // Format the context items for inclusion in a prompt
  private formatContext(items: ContextItem[]): string {
    return items.map(item => {
      return \`--- \${item.uri} ---\\n\${item.text}\`;
    }).join('\\n\\n');
  }
  
  // Periodically clean up old or low-priority items
  scheduleCleanup(intervalMs: number = 5 * 60 * 1000): () => void {
    const intervalId = setInterval(() => {
      this.cleanupOldItems();
    }, intervalMs);
    
    // Return a function to stop the cleanup
    return () => clearInterval(intervalId);
  }
  
  // Remove items older than a certain threshold
  private cleanupOldItems(maxAgeMs: number = 30 * 60 * 1000): void {
    const now = Date.now();
    const items = this.contextManager.getItems();
    
    for (const item of items) {
      if (now - item.timestamp > maxAgeMs) {
        this.contextManager.removeItem(item.uri);
      }
    }
  }
}
\`\`\`

## Practical Exercise: Simple Chat Client

Let's build a simple chat client that uses MCP to provide context-aware responses.

### Building a Chat Interface

First, let's create a simple command-line chat interface:

\`\`\`typescript
// src/chat/cli.ts
import readline from 'readline';
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp.js';
import { HttpClientTransport } from '@modelcontextprotocol/sdk/client/http.js';
import { ContextManager } from '../client/context-manager';

// Create the MCP client
const transport = new HttpClientTransport('http://localhost:3000/mcp');
const client = new McpClient(transport);
const contextManager = new ContextManager();

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connect to the server and start the chat
async function startChat() {
  try {
    console.log('Connecting to MCP server...');
    await client.connect();
    console.log('Connected! Type your messages (type "exit" to quit)');
    
    // Load initial context
    await loadInitialContext();
    
    // Start the chat loop
    chatLoop();
  } catch (error) {
    console.error('Failed to start chat:', error);
    rl.close();
    process.exit(1);
  }
}

// Load initial context
async function loadInitialContext() {
  try {
    console.log('Loading initial context...');
    
    // Fetch the introduction resource
    const resources = await client.fetchResource('docs://introduction');
    
    if (resources.length > 0) {
      contextManager.addItem(
        resources[0].uri,
        resources[0].text,
        2 // High priority
      );
      console.log('Loaded introduction context');
    }
  } catch (error) {
    console.error('Failed to load initial context:', error);
    // Continue anyway
  }
}

// Main chat loop
function chatLoop() {
  rl.question('You: ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      await cleanup();
      return;
    }
    
    try {
      // Try to find relevant context
      await findRelevantContext(input);
      
      // Get the response using the chat action
      const response = await client.executeAction('chat.respond', {
        message: input,
        context: formatContext()
      });
      
      // Display the response
      console.log('\\nAI:', response.content[0].text);
      
      // Continue the loop
      chatLoop();
    } catch (error) {
      console.error('Error:', error);
      chatLoop();
    }
  });
}

// Find relevant context for the input
async function findRelevantContext(input: string) {
  try {
    // Use the search action to find relevant resources
    const searchResult = await client.executeAction('search', {
      query: input
    });
    
    // Extract resource URIs from the search result
    const uris = extractUris(searchResult);
    
    // Load each resource into the context
    for (const uri of uris) {
      const resources = await client.fetchResource(uri);
      
      if (resources.length > 0) {
        contextManager.addItem(
          resources[0].uri,
          resources[0].text,
          1 // Normal priority
        );
      }
    }
    
    // Log context usage
    const usage = contextManager.getTokenUsage();
    console.log(\`Context usage: \${usage.used}/\${usage.total} tokens (\${usage.percentage.toFixed(1)}%)\`);
  } catch (error) {
    console.error('Failed to find relevant context:', error);
    // Continue without additional context
  }
}

// Extract URIs from search results
function extractUris(searchResult: any): string[] {
  // This implementation depends on the specific format of search results
  // For this example, we assume the search action returns text content with URIs
  const text = searchResult.content[0].text;
  const uriPattern = /([a-z]+:\\/\\/[^\\s]+)/g;
  
  const matches = text.match(uriPattern) || [];
  return matches;
}

// Format the context for inclusion in the prompt
function formatContext(): string {
  const items = contextManager.getItems();
  
  if (items.length === 0) {
    return '';
  }
  
  return items.map(item => {
    return \`--- \${item.uri} ---\\n\${item.text}\`;
  }).join('\\n\\n');
}

// Clean up and exit
async function cleanup() {
  console.log('Disconnecting...');
  await client.disconnect();
  console.log('Disconnected. Goodbye!');
  rl.close();
  process.exit(0);
}

// Start the chat
startChat();
\`\`\`

### Connecting to an MCP Server

For a more complete example, let's create a web-based chat client using React:

\`\`\`typescript
// src/components/ChatApp.tsx
import React, { useState, useEffect, useRef } from 'react';
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp.js';
import { HttpClientTransport } from '@modelcontextprotocol/sdk/client/http.js';
import { ContextManager } from '../client/context-manager';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export const ChatApp: React.FC = () => {
  const [client, setClient] = useState<McpClient | null>(null);
  const [contextManager] = useState(() => new ContextManager(8000));
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Connect to the MCP server on component mount
  useEffect(() => {
    const connectToServer = async () => {
      try {
        const transport = new HttpClientTransport('http://localhost:3000/mcp');
        const newClient = new McpClient(transport);
        
        await newClient.connect();
        setClient(newClient);
        setConnected(true);
        
        // Load initial context
        await loadInitialContext(newClient, contextManager);
        
        // Add welcome message
        addMessage('Welcome to the MCP Chat! How can I help you today?', 'ai');
      } catch (error) {
        console.error('Failed to connect:', error);
        addMessage('Failed to connect to the MCP server. Please try again later.', 'ai');
      }
    };
    
    connectToServer();
    
    // Cleanup on unmount
    return () => {
      if (client) {
        client.disconnect().catch(console.error);
      }
    };
  }, []);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Load initial context
  const loadInitialContext = async (
    client: McpClient,
    contextManager: ContextManager
  ) => {
    try {
      const resources = await client.fetchResource('docs://introduction');
      
      if (resources.length > 0) {
        contextManager.addItem(
          resources[0].uri,
          resources[0].text,
          2 // High priority
        );
      }
    } catch (error) {
      console.error('Failed to load initial context:', error);
    }
  };
  
  // Add a message to the chat
  const addMessage = (text: string, sender: 'user' | 'ai') => {
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        text,
        sender,
        timestamp: new Date()
      }
    ]);
  };
  
  // Handle sending a message
  const handleSend = async () => {
    if (!input.trim() || !client || !connected) return;
    
    const userMessage = input.trim();
    setInput('');
    addMessage(userMessage, 'user');
    setLoading(true);
    
    try {
      // Find relevant context
      await findRelevantContext(client, contextManager, userMessage);
      
      // Get AI response
      const response = await client.executeAction('chat.respond', {
        message: userMessage,
        context: formatContext(contextManager)
      });
      
      // Add AI response to chat
      addMessage(response.content[0].text, 'ai');
    } catch (error) {
      console.error('Error:', error);
      addMessage('Sorry, I encountered an error. Please try again.', 'ai');
    } finally {
      setLoading(false);
    }
  };
  
  // Find relevant context for the input
  const findRelevantContext = async (
    client: McpClient,
    contextManager: ContextManager,
    input: string
  ) => {
    try {
      // Use the search action to find relevant resources
      const searchResult = await client.executeAction('search', {
        query: input
      });
      
      // Extract resource URIs from the search result
      const uris = extractUris(searchResult);
      
      // Load each resource into the context
      for (const uri of uris) {
        const resources = await client.fetchResource(uri);
        
        if (resources.length > 0) {
          contextManager.addItem(
            resources[0].uri,
            resources[0].text,
            1 // Normal priority
          );
        }
      }
    } catch (error) {
      console.error('Failed to find relevant context:', error);
    }
  };
  
  // Extract URIs from search results
  const extractUris = (searchResult: any): string[] => {
    const text = searchResult.content[0].text;
    const uriPattern = /([a-z]+:\\/\\/[^\\s]+)/g;
    
    const matches = text.match(uriPattern) || [];
    return matches;
  };
  
  // Format the context for inclusion in the prompt
  const formatContext = (contextManager: ContextManager): string => {
    const items = contextManager.getItems();
    
    if (items.length === 0) {
      return '';
    }
    
    return items.map(item => {
      return \`--- \${item.uri} ---\\n\${item.text}\`;
    }).join('\\n\\n');
  };
  
  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>MCP Chat</h1>
        <div className="connection-status">
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>
      
      <div className="messages-container">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={\`message \${message.sender === 'user' ? 'user-message' : 'ai-message'}\`}
          >
            <div className="message-content">{message.text}</div>
            <div className="message-timestamp">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message ai-message">
            <div className="message-content loading">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-container">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          placeholder="Type your message..."
          disabled={!connected || loading}
        />
        <button 
          onClick={handleSend}
          disabled={!connected || loading || !input.trim()}
        >
          Send
        </button>
      </div>
      
      <div className="context-info">
        {contextManager && (
          <div>
            Context: {contextManager.getTokenUsage().used} tokens
            ({contextManager.getTokenUsage().percentage.toFixed(1)}%)
          </div>
        )}
      </div>
    </div>
  );
};
\`\`\`

### Handling Messages and Responses

To complete our chat client, let's add some utility functions for handling messages and responses:

\`\`\`typescript
// src/utils/message-handlers.ts
import { ContentBlock } from '@modelcontextprotocol/sdk/shared';

// Process different types of content blocks
export function processContentBlocks(
  blocks: ContentBlock[]
): { text: string; hasNonText: boolean } {
  let text = '';
  let hasNonText = false;
  
  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        text += block.text;
        break;
      case 'image':
        text += \`[Image: \${block.url}]\`;
        hasNonText = true;
        break;
      case 'table':
        text += formatTable(block);
        hasNonText = true;
        break;
      default:
        text += \`[Content of type \${block.type}]\`;
        hasNonText = true;
        break;
    }
    
    // Add a newline between blocks
    text += '\\n\\n';
  }
  
  return { text: text.trim(), hasNonText };
}

// Format a table content block as text
function formatTable(tableBlock: any): string {
  const { headers, rows } = tableBlock;
  
  if (!headers || !rows || !Array.isArray(headers) || !Array.isArray(rows)) {
    return '[Invalid table format]';
  }
  
  // Calculate column widths
  const columnWidths = headers.map((header, index) => {
    const headerLength = String(header).length;
    const maxDataLength = rows.reduce((max, row) => {
      const cellLength = String(row[index] || '').length;
      return Math.max(max, cellLength);
    }, 0);
    
    return Math.max(headerLength, maxDataLength, 3);
  });
  
  // Format headers
  let table = '';
  
  // Header row
  table += '| ';
  headers.forEach((header, index) => {
    table += String(header).padEnd(columnWidths[index]) + ' | ';
  });
  table += '\\n';
  
  // Separator row
  table += '| ';
  columnWidths.forEach(width => {
    table += '-'.repeat(width) + ' | ';
  });
  table += '\\n';
  
  // Data rows
  rows.forEach(row => {
    table += '| ';
    row.forEach((cell, index) => {
      table += String(cell).padEnd(columnWidths[index]) + ' | ';
    });
    table += '\\n';
  });
  
  return table;
}

// Format a message for display
export function formatMessage(message: string): string {
  // Convert markdown-style links to HTML
  const linkPattern = /\\[([^\\]]+)\\]\\(([^)]+)\\)/g;
  const withLinks = message.replace(linkPattern, '<a href="$2">$1</a>');
  
  // Convert markdown-style headers
  const headerPattern = /^(#{1,6})\\s+(.+)$/gm;
  const withHeaders = withLinks.replace(headerPattern, (_, hashes, text) => {
    const level = hashes.length;
    return \`<h\${level}>\${text}</h\${level}>\`;
  });
  
  // Convert markdown-style lists
  const listItemPattern = /^[-*]\\s+(.+)$/gm;
  const withLists = withHeaders.replace(listItemPattern, '<li>$1</li>');
  
  // Wrap list items in ul tags (simplified approach)
  const withWrappedLists = withLists.replace(
    /(<li>.*?<\\/li>\\n)+/gs,
    match => \`<ul>\\n\${match}</ul>\\n\`
  );
  
  // Convert newlines to <br> tags
  return withWrappedLists.replace(/\\n/g, '<br>');
}
\`\`\`

This completes our simple chat client implementation. The client connects to an MCP server, manages context effectively, and provides a user-friendly interface for interacting with the AI.

In the next section, we'll explore advanced MCP features that can enhance both client and server implementations.
`;export{n as default};

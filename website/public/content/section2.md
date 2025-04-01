# Section 2: TypeScript Fundamentals for MCP

## Essential TypeScript Concepts

When working with the Model Context Protocol in TypeScript, a solid understanding of TypeScript's type system and features is essential. This section covers the key TypeScript concepts that are particularly relevant for MCP development.

### Type System and Type Safety

TypeScript's static type system is one of its greatest strengths, especially when implementing a protocol like MCP where correctness is critical.

#### Static Typing Benefits

```typescript
// Without TypeScript
function processMessage(message) {
  // What properties does message have?
  // What if message is null or undefined?
  return message.payload;
}

// With TypeScript
interface McpMessage {
  type: string;
  id: string;
  timestamp: string;
  payload: unknown;
}

function processMessage(message: McpMessage): unknown {
  return message.payload;
}
```

TypeScript's static typing provides several benefits for MCP development:

1. **Error Detection**: Catches type-related errors at compile time rather than runtime
2. **Code Completion**: Provides intelligent suggestions based on types
3. **Documentation**: Types serve as inline documentation
4. **Refactoring Support**: Makes code changes safer and easier

#### Literal Types and Unions

MCP makes extensive use of literal types and unions to represent message types and states:

```typescript
// Message types as literal union
type McpMessageType = 
  | "hello" 
  | "welcome" 
  | "resource_request" 
  | "resource_response" 
  | "action_request" 
  | "action_response" 
  | "error" 
  | "goodbye";

// Using discriminated unions for messages
interface McpBaseMessage {
  type: McpMessageType;
  id: string;
  timestamp: string;
}

interface HelloMessage extends McpBaseMessage {
  type: "hello";
  payload: {
    version: string;
    capabilities: string[];
  };
}

interface ResourceRequestMessage extends McpBaseMessage {
  type: "resource_request";
  payload: {
    uri: string;
  };
}

type McpMessage = HelloMessage | ResourceRequestMessage | /* other message types */;
```

This pattern allows TypeScript to perform exhaustive checking in switch statements and conditionals, ensuring all possible message types are handled.

### Interfaces and Type Definitions

Interfaces and type definitions are crucial for defining the structure of MCP messages, resources, and actions.

#### Interface vs. Type Aliases

```typescript
// Interface definition
interface ResourceContent {
  uri: string;
  text: string;
  metadata?: Record<string, unknown>;
}

// Type alias
type ResourceResponse = {
  contents: ResourceContent[];
  nextPage?: string;
};
```

In MCP development:
- **Interfaces** are typically used for object shapes that might be extended
- **Type aliases** are used for unions, primitives, and complex types

#### Interface Extension and Composition

MCP uses interface extension to build on base message types:

```typescript
// Base message interface
interface McpBaseMessage {
  type: string;
  id: string;
  timestamp: string;
}

// Extended for specific message types
interface ActionRequestMessage extends McpBaseMessage {
  type: "action_request";
  payload: {
    action: string;
    parameters: Record<string, unknown>;
  };
}
```

This approach creates a hierarchy of types that accurately represents the protocol structure.

### Generics and Utility Types

Generics are essential for creating flexible, reusable components in MCP implementations.

#### Generic Functions and Classes

```typescript
// Generic resource handler
class ResourceHandler<T extends ResourceContent> {
  async fetch(uri: string): Promise<T> {
    // Implementation
  }
}

// Generic action handler
function createActionHandler<P, R>(
  handler: (params: P) => Promise<R>
): ActionHandler<P, R> {
  // Implementation
}
```

Generics allow for type-safe implementations that can work with different resource and action types.

#### Utility Types for MCP

TypeScript's utility types are particularly useful for MCP development:

```typescript
// Making certain properties optional
type PartialResourceContent = Partial<ResourceContent>;

// Extracting the payload type from a message
type HelloPayload = Extract<McpMessage, { type: "hello" }>["payload"];

// Creating a read-only version of a message
type ReadonlyMessage = Readonly<McpMessage>;

// Picking specific properties
type MessageIdentifier = Pick<McpBaseMessage, "id" | "type">;
```

These utility types help create derived types without duplicating definitions, keeping the codebase DRY and maintainable.

### Async Programming with Promises

MCP operations are inherently asynchronous, making TypeScript's async/await and Promise handling essential.

#### Promises and Async/Await

```typescript
// Promise-based resource fetching
async function fetchResource(uri: string): Promise<ResourceContent[]> {
  try {
    const response = await mcpClient.request({
      type: "resource_request",
      payload: { uri }
    });
    
    return response.payload.contents;
  } catch (error) {
    console.error(`Failed to fetch resource ${uri}:`, error);
    throw error;
  }
}
```

Key async patterns in MCP:
1. **Promise chaining** for sequential operations
2. **Promise.all** for parallel operations
3. **try/catch** blocks for error handling
4. **async/await** for readable asynchronous code

#### Error Handling in Async Code

Proper error handling is critical in MCP implementations:

```typescript
// Typed error handling
class McpError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "McpError";
  }
}

async function executeAction(
  action: string, 
  parameters: Record<string, unknown>
): Promise<ActionResponse> {
  try {
    return await mcpClient.request({
      type: "action_request",
      payload: { action, parameters }
    });
  } catch (error) {
    if (error instanceof McpError) {
      // Handle protocol-specific errors
      if (error.code === "action_not_found") {
        // Handle specific error case
      }
    }
    // Re-throw or transform the error
    throw error;
  }
}
```

This approach ensures that errors are properly typed and can be handled specifically based on their nature.

## Development Environment Setup

A well-configured development environment is essential for productive MCP development with TypeScript.

### Setting up a TypeScript Project with pnpm

pnpm is a fast, disk-space efficient package manager that works well for TypeScript projects.

#### Project Initialization

```bash
# Create project directory
mkdir mcp-project
cd mcp-project

# Initialize pnpm
pnpm init

# Add TypeScript
pnpm add -D typescript @types/node
```

#### TypeScript Configuration

Create a `tsconfig.json` file:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Key TypeScript settings for MCP development:
- **strict**: Enables strict type checking
- **declaration**: Generates `.d.ts` files for better tooling
- **sourceMap**: Helps with debugging
- **moduleResolution**: "node" works well for most MCP projects

### Configuring Vite for Development

Vite provides a fast development experience with instant server start and hot module replacement.

#### Setting up Vite

```bash
# Add Vite
pnpm add -D vite @vitejs/plugin-react

# Create vite.config.ts
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

#### Project Structure for MCP Applications

A typical MCP project structure:

```
mcp-project/
├── src/
│   ├── client/       # MCP client implementation
│   ├── server/       # MCP server implementation
│   ├── shared/       # Shared types and utilities
│   └── index.ts      # Main entry point
├── examples/         # Example usage
├── tests/            # Test files
├── tsconfig.json     # TypeScript configuration
├── vite.config.ts    # Vite configuration
└── package.json      # Project metadata
```

This structure separates concerns while keeping related code together.

### Adding Testing with Vitest

Vitest is a Vite-native testing framework that provides a fast, ESM-first testing experience.

#### Setting up Vitest

```bash
# Add Vitest
pnpm add -D vitest
```

Update `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Create a basic test:

```typescript
// tests/mcp-message.test.ts
import { describe, it, expect } from 'vitest';
import { createMessage } from '../src/shared/message';

describe('MCP Message', () => {
  it('should create a valid hello message', () => {
    const message = createMessage('hello', {
      version: '1.0.0',
      capabilities: ['resources', 'actions']
    });
    
    expect(message.type).toBe('hello');
    expect(message.payload.version).toBe('1.0.0');
    expect(message.id).toBeDefined();
    expect(message.timestamp).toBeDefined();
  });
});
```

#### Testing MCP Components

For MCP development, consider these testing approaches:

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test client-server interactions
3. **Mock Transports**: Use in-memory transports for testing
4. **Test Fixtures**: Create reusable message fixtures

### Using tsx for TypeScript Execution

tsx allows running TypeScript files directly without a separate compilation step.

#### Installing and Using tsx

```bash
# Add tsx
pnpm add -D tsx
```

Update `package.json`:

```json
{
  "scripts": {
    "start": "tsx src/index.ts",
    "dev": "tsx watch src/index.ts"
  }
}
```

#### Running MCP Servers with tsx

tsx is particularly useful for running MCP servers during development:

```bash
# Run an MCP server
pnpm tsx examples/echo-server.ts

# Run with debugging
NODE_OPTIONS='--inspect' pnpm tsx examples/echo-server.ts
```

This approach provides a streamlined development workflow without requiring separate build steps.

## TypeScript Best Practices for MCP

Following TypeScript best practices ensures that your MCP implementations are robust, maintainable, and performant.

### Code Organization

Organizing your MCP codebase effectively is crucial for maintainability.

#### Module Structure

```
src/
├── client/
│   ├── index.ts           # Public API
│   ├── mcp-client.ts      # Client implementation
│   ├── transports/        # Transport implementations
│   └── types.ts           # Client-specific types
├── server/
│   ├── index.ts           # Public API
│   ├── mcp-server.ts      # Server implementation
│   ├── resource-handler.ts # Resource handling
│   ├── action-handler.ts  # Action handling
│   └── types.ts           # Server-specific types
└── shared/
    ├── index.ts           # Shared exports
    ├── messages.ts        # Message utilities
    ├── errors.ts          # Error definitions
    └── types.ts           # Shared type definitions
```

This structure separates concerns while making dependencies clear.

#### Barrel Files

Use barrel files (index.ts) to simplify imports:

```typescript
// src/client/index.ts
export * from './mcp-client';
export * from './types';
export * from './transports/http';
export * from './transports/stdio';

// Usage elsewhere
import { McpClient, HttpClientTransport } from './client';
```

This approach reduces import complexity and provides a clean public API.

### Error Handling

Robust error handling is essential for reliable MCP implementations.

#### Error Types

Define specific error types for different failure modes:

```typescript
// src/shared/errors.ts
export class McpError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "McpError";
  }
}

export class ConnectionError extends McpError {
  constructor(message: string, details?: unknown) {
    super(message, "connection_error", details);
    this.name = "ConnectionError";
  }
}

export class ProtocolError extends McpError {
  constructor(message: string, details?: unknown) {
    super(message, "protocol_error", details);
    this.name = "ProtocolError";
  }
}
```

#### Error Handling Patterns

```typescript
async function fetchResource(uri: string): Promise<ResourceContent[]> {
  try {
    const response = await mcpClient.request({
      type: "resource_request",
      payload: { uri }
    });
    
    return response.payload.contents;
  } catch (error) {
    if (error instanceof ConnectionError) {
      // Handle connection issues
      await mcpClient.reconnect();
      return fetchResource(uri); // Retry
    } else if (error instanceof ProtocolError) {
      // Handle protocol errors
      console.error("Protocol error:", error.message);
      throw error;
    } else {
      // Handle unexpected errors
      console.error("Unexpected error:", error);
      throw new McpError(
        "Failed to fetch resource", 
        "unexpected_error",
        { originalError: error, uri }
      );
    }
  }
}
```

This pattern ensures errors are properly categorized and handled appropriately.

### Type Definitions

Well-designed type definitions make MCP implementations more robust and easier to use.

#### Protocol Message Types

Define the protocol message types clearly:

```typescript
// src/shared/types.ts
export type McpMessageType = 
  | "hello" 
  | "welcome" 
  | "resource_request" 
  | "resource_response" 
  | "action_request" 
  | "action_response" 
  | "error" 
  | "goodbye";

export interface McpBaseMessage {
  type: McpMessageType;
  id: string;
  timestamp: string;
}

export interface HelloMessage extends McpBaseMessage {
  type: "hello";
  payload: {
    version: string;
    capabilities: string[];
  };
}

// Define other message types...

export type McpMessage = 
  | HelloMessage 
  | WelcomeMessage 
  | ResourceRequestMessage 
  | ResourceResponseMessage 
  | ActionRequestMessage 
  | ActionResponseMessage 
  | ErrorMessage 
  | GoodbyeMessage;
```

#### Type Guards

Use type guards to safely work with message types:

```typescript
// src/shared/type-guards.ts
export function isHelloMessage(message: McpMessage): message is HelloMessage {
  return message.type === "hello";
}

export function isResourceResponseMessage(
  message: McpMessage
): message is ResourceResponseMessage {
  return message.type === "resource_response";
}

// Usage
function processMessage(message: McpMessage): void {
  if (isHelloMessage(message)) {
    // TypeScript knows message is HelloMessage here
    console.log(`Client supports: ${message.payload.capabilities.join(", ")}`);
  } else if (isResourceResponseMessage(message)) {
    // TypeScript knows message is ResourceResponseMessage here
    console.log(`Received ${message.payload.contents.length} resources`);
  }
}
```

Type guards ensure type safety when working with union types.

### Module Patterns

Effective module patterns help create maintainable MCP implementations.

#### Dependency Injection

Use dependency injection to make components testable:

```typescript
// src/client/mcp-client.ts
export class McpClient {
  constructor(private transport: ClientTransport) {}
  
  async connect(): Promise<void> {
    await this.transport.connect();
    // Implementation
  }
  
  async request(message: McpRequestMessage): Promise<McpResponseMessage> {
    // Implementation
  }
}

// Usage
const httpTransport = new HttpClientTransport("https://example.com/mcp");
const client = new McpClient(httpTransport);

// For testing
const mockTransport = new MockClientTransport();
const testClient = new McpClient(mockTransport);
```

This pattern makes it easy to swap implementations and isolate components for testing.

#### Factory Functions

Use factory functions to create complex objects with sensible defaults:

```typescript
// src/client/factory.ts
export function createMcpClient(options: McpClientOptions): McpClient {
  const {
    transportType = "http",
    url = "http://localhost:3000/mcp",
    timeout = 30000,
    ...otherOptions
  } = options;
  
  let transport: ClientTransport;
  
  if (transportType === "http") {
    transport = new HttpClientTransport(url, { timeout });
  } else if (transportType === "stdio") {
    transport = new StdioClientTransport();
  } else {
    throw new Error(`Unsupported transport type: ${transportType}`);
  }
  
  return new McpClient(transport, otherOptions);
}

// Usage
const client = createMcpClient({
  transportType: "http",
  url: "https://example.com/mcp"
});
```

This approach simplifies object creation while providing flexibility.

By mastering these TypeScript fundamentals and best practices, you'll be well-equipped to build robust, maintainable MCP implementations that leverage TypeScript's powerful type system.

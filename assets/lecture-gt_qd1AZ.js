const n=`# Section 3: MCP Core Concepts

## Message Structure and Format

The Model Context Protocol (MCP) is built around a well-defined message structure that enables standardized communication between clients and servers. Understanding this message structure is fundamental to working with MCP effectively.

### Protocol Messages Anatomy

All MCP messages follow a common base structure:

\`\`\`typescript
interface McpBaseMessage {
  type: string;        // The message type identifier
  id: string;          // Unique message identifier
  timestamp: string;   // ISO 8601 timestamp
}
\`\`\`

This base structure provides the foundation for all protocol messages, ensuring that each message can be uniquely identified and tracked. The \`type\` field is particularly important as it determines how the message should be interpreted.

Building on this base structure, specific message types add their own payload structures:

\`\`\`typescript
interface HelloMessage extends McpBaseMessage {
  type: "hello";
  payload: {
    version: string;           // Protocol version (e.g., "1.0.0")
    capabilities: string[];    // Client capabilities
  };
}

interface WelcomeMessage extends McpBaseMessage {
  type: "welcome";
  payload: {
    version: string;           // Protocol version
    capabilities: string[];    // Server capabilities
    server: {
      name: string;            // Server name
      version: string;         // Server version
    };
  };
}
\`\`\`

The TypeScript SDK for MCP defines all these message types, making it easy to work with them in a type-safe manner:

\`\`\`typescript
// Example of creating a hello message
import { createMessage } from "@modelcontextprotocol/sdk/shared";

const helloMessage = createMessage("hello", {
  version: "1.0.0",
  capabilities: ["resources", "actions"]
});

console.log(helloMessage);
// {
//   type: "hello",
//   id: "msg_1234567890",
//   timestamp: "2025-03-31T22:00:00.000Z",
//   payload: {
//     version: "1.0.0",
//     capabilities: ["resources", "actions"]
//   }
// }
\`\`\`

### Request and Response Formats

MCP communication typically follows a request-response pattern, where clients send requests and servers respond. The protocol defines specific message pairs for different operations:

#### Resource Requests and Responses

\`\`\`typescript
interface ResourceRequestMessage extends McpBaseMessage {
  type: "resource_request";
  payload: {
    uri: string;               // Resource URI to fetch
  };
}

interface ResourceResponseMessage extends McpBaseMessage {
  type: "resource_response";
  payload: {
    contents: ResourceContent[];  // Array of resource contents
    nextPage?: string;            // Optional URI for pagination
  };
}

interface ResourceContent {
  uri: string;                 // Resource URI
  text: string;                // Resource text content
  metadata?: Record<string, unknown>; // Optional metadata
}
\`\`\`

Example of a resource request and response:

\`\`\`typescript
// Client sends a resource request
const resourceRequest = createMessage("resource_request", {
  uri: "docs://getting-started"
});

// Server responds with a resource response
const resourceResponse = createMessage("resource_response", {
  contents: [
    {
      uri: "docs://getting-started",
      text: "# Getting Started with MCP\\n\\nThis guide will help you...",
      metadata: {
        title: "Getting Started",
        lastUpdated: "2025-03-15"
      }
    }
  ]
});
\`\`\`

#### Action Requests and Responses

\`\`\`typescript
interface ActionRequestMessage extends McpBaseMessage {
  type: "action_request";
  payload: {
    action: string;            // Action identifier
    parameters: Record<string, unknown>; // Action parameters
  };
}

interface ActionResponseMessage extends McpBaseMessage {
  type: "action_response";
  payload: {
    content: ContentBlock[];   // Action result content
  };
}

interface ContentBlock {
  type: string;                // Content type (e.g., "text", "image")
  [key: string]: unknown;      // Content-specific properties
}
\`\`\`

Example of an action request and response:

\`\`\`typescript
// Client sends an action request
const actionRequest = createMessage("action_request", {
  action: "calculate",
  parameters: {
    operation: "add",
    a: 5,
    b: 3
  }
});

// Server responds with an action response
const actionResponse = createMessage("action_response", {
  content: [
    {
      type: "text",
      text: "8"
    }
  ]
});
\`\`\`

### Content Types and Serialization

MCP supports different content types to represent various kinds of information. The most common content type is text, but the protocol is designed to support other types as well.

#### Text Content

\`\`\`typescript
interface TextContent extends ContentBlock {
  type: "text";
  text: string;                // Plain text content
}
\`\`\`

#### Other Content Types

The protocol can be extended to support additional content types:

\`\`\`typescript
interface ImageContent extends ContentBlock {
  type: "image";
  url: string;                 // Image URL
  altText?: string;            // Alternative text
}

interface TableContent extends ContentBlock {
  type: "table";
  headers: string[];           // Table headers
  rows: unknown[][];           // Table data
}
\`\`\`

#### JSON Serialization

MCP messages are typically serialized as JSON for transmission. The TypeScript SDK handles serialization and deserialization automatically:

\`\`\`typescript
import { serializeMessage, deserializeMessage } from "@modelcontextprotocol/sdk/shared";

// Serialize a message to JSON
const messageJson = serializeMessage(helloMessage);
console.log(messageJson);
// '{"type":"hello","id":"msg_1234567890","timestamp":"2025-03-31T22:00:00.000Z","payload":{"version":"1.0.0","capabilities":["resources","actions"]}}'

// Deserialize a message from JSON
const parsedMessage = deserializeMessage(messageJson);
console.log(parsedMessage.type); // "hello"
\`\`\`

This standardized serialization ensures that messages can be reliably transmitted between clients and servers, regardless of their implementation language or platform.

## Context Windows and Management

One of the key challenges in LLM applications is managing the limited context window effectively. MCP provides mechanisms to help with this challenge.

### Understanding Context Windows

A context window in an LLM refers to the amount of text the model can consider at once when generating a response. This window has a fixed size, typically measured in tokens (roughly 4 characters per token in English).

Context windows have several important characteristics:

1. **Fixed Size**: Each LLM has a maximum context window size (e.g., 8K, 16K, or 32K tokens)
2. **Input + Output**: The context window includes both the input (prompt) and the generated output
3. **Token Consumption**: Different content types consume different numbers of tokens
4. **Recency Bias**: LLMs tend to pay more attention to recent content in the context window

MCP helps manage these constraints by providing structured ways to load and organize content within the context window.

### Context Persistence Strategies

MCP enables several strategies for persisting context across interactions:

#### Resource Caching

\`\`\`typescript
// Client-side resource caching
class ResourceCache {
  private cache: Map<string, ResourceContent[]> = new Map();
  
  store(uri: string, contents: ResourceContent[]): void {
    this.cache.set(uri, contents);
  }
  
  retrieve(uri: string): ResourceContent[] | undefined {
    return this.cache.get(uri);
  }
  
  has(uri: string): boolean {
    return this.cache.has(uri);
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Usage in an MCP client
const resourceCache = new ResourceCache();

async function fetchResource(uri: string): Promise<ResourceContent[]> {
  // Check cache first
  if (resourceCache.has(uri)) {
    return resourceCache.retrieve(uri)!;
  }
  
  // Fetch from server if not in cache
  const response = await mcpClient.request({
    type: "resource_request",
    payload: { uri }
  });
  
  const contents = response.payload.contents;
  
  // Store in cache for future use
  resourceCache.store(uri, contents);
  
  return contents;
}
\`\`\`

#### Session Management

MCP servers can maintain session state to provide context persistence:

\`\`\`typescript
// Server-side session management
class SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  
  createSession(sessionId: string): void {
    this.sessions.set(sessionId, {
      resources: new Set<string>(),
      lastAccessed: Date.now()
    });
  }
  
  recordResourceAccess(sessionId: string, uri: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.resources.add(uri);
      session.lastAccessed = Date.now();
    }
  }
  
  getAccessedResources(sessionId: string): Set<string> | undefined {
    const session = this.sessions.get(sessionId);
    return session?.resources;
  }
  
  // Additional session management methods...
}
\`\`\`

### Optimizing Context Usage

MCP provides several techniques for optimizing context usage:

#### Resource Filtering

\`\`\`typescript
// Filter resources based on relevance
function filterRelevantResources(
  query: string,
  resources: ResourceContent[]
): ResourceContent[] {
  // Simple relevance scoring based on term frequency
  return resources
    .map(resource => ({
      resource,
      score: calculateRelevance(query, resource.text)
    }))
    .filter(item => item.score > 0.5) // Threshold for relevance
    .sort((a, b) => b.score - a.score) // Sort by relevance
    .map(item => item.resource);
}

function calculateRelevance(query: string, text: string): number {
  // Simple relevance calculation
  const queryTerms = query.toLowerCase().split(/\\s+/);
  const textLower = text.toLowerCase();
  
  let matchCount = 0;
  for (const term of queryTerms) {
    if (textLower.includes(term)) {
      matchCount++;
    }
  }
  
  return matchCount / queryTerms.length;
}
\`\`\`

#### Content Summarization

\`\`\`typescript
// Summarize content to reduce token usage
async function summarizeContent(
  content: string,
  maxTokens: number
): Promise<string> {
  if (estimateTokens(content) <= maxTokens) {
    return content; // No summarization needed
  }
  
  // Use an LLM to summarize the content
  // This is a simplified example; actual implementation would depend on the LLM API
  const summary = await llmClient.summarize(content, maxTokens);
  return summary;
}

function estimateTokens(text: string): number {
  // Simple token estimation (approximately 4 characters per token in English)
  return Math.ceil(text.length / 4);
}
\`\`\`

#### Prioritization

\`\`\`typescript
// Prioritize content based on importance
function prioritizeContent(
  resources: ResourceContent[],
  maxTokens: number
): ResourceContent[] {
  // Sort by priority (could be based on metadata, recency, etc.)
  const prioritized = [...resources].sort((a, b) => {
    const priorityA = a.metadata?.priority as number || 0;
    const priorityB = b.metadata?.priority as number || 0;
    return priorityB - priorityA;
  });
  
  // Select resources until we hit the token limit
  const selected: ResourceContent[] = [];
  let tokenCount = 0;
  
  for (const resource of prioritized) {
    const resourceTokens = estimateTokens(resource.text);
    if (tokenCount + resourceTokens <= maxTokens) {
      selected.push(resource);
      tokenCount += resourceTokens;
    } else {
      break;
    }
  }
  
  return selected;
}
\`\`\`

These techniques help make the most of the limited context window, ensuring that the most relevant and important information is included.

## Action Handling

Actions in MCP allow LLMs to perform operations beyond simply retrieving information. They enable the LLM to interact with external systems, perform computations, and produce side effects.

### Defining and Implementing Actions

Actions are defined on the server side and can be invoked by clients. The TypeScript SDK provides a clean way to define actions:

\`\`\`typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod"; // For parameter validation

// Create an MCP server
const server = new McpServer({
  name: "Calculator",
  version: "1.0.0"
});

// Define an addition action
server.tool(
  "add", // Action name
  { 
    a: z.number(), // Parameter schema using Zod
    b: z.number()
  },
  async ({ a, b }) => ({ // Action implementation
    content: [{ 
      type: "text", 
      text: String(a + b) 
    }]
  })
);

// Define a more complex action
server.tool(
  "calculate",
  {
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    a: z.number(),
    b: z.number()
  },
  async ({ operation, a, b }) => {
    let result: number;
    
    switch (operation) {
      case "add":
        result = a + b;
        break;
      case "subtract":
        result = a - b;
        break;
      case "multiply":
        result = a * b;
        break;
      case "divide":
        if (b === 0) {
          throw new Error("Division by zero");
        }
        result = a / b;
        break;
    }
    
    return {
      content: [{ 
        type: "text", 
        text: String(result) 
      }]
    };
  }
);
\`\`\`

### Action Parameters and Validation

MCP actions use Zod for parameter validation, providing a type-safe way to define and validate action parameters:

\`\`\`typescript
import { z } from "zod";

// Simple parameter schema
const addParametersSchema = z.object({
  a: z.number(),
  b: z.number()
});

// More complex parameter schema with validation
const userParametersSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
  preferences: z.object({
    theme: z.enum(["light", "dark", "system"]).default("system"),
    notifications: z.boolean().default(true)
  }).optional()
});

// Using the schema in an action
server.tool(
  "createUser",
  userParametersSchema.shape, // Extract the shape for the SDK
  async (params) => {
    // params is fully typed based on the schema
    const { name, email, age, preferences } = params;
    
    // Implementation...
    
    return {
      content: [{ 
        type: "text", 
        text: \`User \${name} created successfully\` 
      }]
    };
  }
);
\`\`\`

The use of Zod provides several benefits:
1. **Type Safety**: Parameters are validated at runtime but also provide TypeScript types
2. **Clear Validation Rules**: Validation rules are declarative and easy to understand
3. **Detailed Error Messages**: Validation failures produce clear error messages
4. **Default Values**: Schemas can specify default values for optional parameters

### Response Handling

Action responses in MCP follow a standardized format:

\`\`\`typescript
interface ActionResponse {
  content: ContentBlock[];
}

// Different types of content blocks
type ContentBlock = 
  | TextContent
  | ImageContent
  | TableContent
  | CustomContent;

interface TextContent {
  type: "text";
  text: string;
}

interface ImageContent {
  type: "image";
  url: string;
  altText?: string;
}

interface TableContent {
  type: "table";
  headers: string[];
  rows: unknown[][];
}

interface CustomContent {
  type: string;
  [key: string]: unknown;
}
\`\`\`

Actions can return different types of content based on their purpose:

\`\`\`typescript
// Text response
server.tool(
  "greet",
  { name: z.string() },
  async ({ name }) => ({
    content: [{ 
      type: "text", 
      text: \`Hello, \${name}!\` 
    }]
  })
);

// Mixed content response
server.tool(
  "weatherReport",
  { location: z.string() },
  async ({ location }) => {
    // Fetch weather data (simplified example)
    const weather = await getWeatherData(location);
    
    return {
      content: [
        { 
          type: "text", 
          text: \`Weather report for \${location}:\\n\${weather.description}\` 
        },
        {
          type: "image",
          url: weather.iconUrl,
          altText: \`Weather icon for \${weather.description}\`
        },
        {
          type: "table",
          headers: ["Metric", "Value"],
          rows: [
            ["Temperature", \`\${weather.temperature}°C\`],
            ["Humidity", \`\${weather.humidity}%\`],
            ["Wind", \`\${weather.windSpeed} km/h\`]
          ]
        }
      ]
    };
  }
);
\`\`\`

Clients can process these responses based on the content types:

\`\`\`typescript
// Client-side response handling
async function executeWeatherAction(location: string): Promise<void> {
  const response = await mcpClient.request({
    type: "action_request",
    payload: {
      action: "weatherReport",
      parameters: { location }
    }
  });
  
  // Process different content types
  for (const content of response.payload.content) {
    switch (content.type) {
      case "text":
        console.log(content.text);
        break;
      case "image":
        displayImage(content.url, content.altText);
        break;
      case "table":
        displayTable(content.headers, content.rows);
        break;
      default:
        console.log(\`Unknown content type: \${content.type}\`);
    }
  }
}

function displayImage(url: string, altText?: string): void {
  // Implementation to display an image
  console.log(\`[Image: \${url}\${altText ? \` (\${altText})\` : ''}]\`);
}

function displayTable(headers: string[], rows: unknown[][]): void {
  // Implementation to display a table
  console.log(\`Table with headers: \${headers.join(', ')}\`);
  for (const row of rows) {
    console.log(\`Row: \${row.join(', ')}\`);
  }
}
\`\`\`

## Content Blocks and Chunking

When working with large amounts of content, it's important to manage how that content is delivered and processed. MCP provides mechanisms for handling large content through content blocks and chunking.

### Working with Large Content

Large content presents several challenges in MCP:
1. **Context Window Limits**: LLMs have fixed context window sizes
2. **Transmission Efficiency**: Large content can be inefficient to transmit
3. **Processing Overhead**: Processing large content can be resource-intensive

MCP addresses these challenges through content blocks and chunking:

\`\`\`typescript
// Example of a large resource
const largeResource: ResourceContent = {
  uri: "docs://complete-guide",
  text: "# Complete Guide to MCP\\n\\n[... very long content ...]",
  metadata: {
    title: "Complete Guide to MCP",
    size: "large"
  }
};

// Checking if content is too large
function isContentTooLarge(content: string, maxTokens: number): boolean {
  return estimateTokens(content) > maxTokens;
}

// If content is too large, it needs to be chunked
if (isContentTooLarge(largeResource.text, 4000)) {
  const chunks = chunkContent(largeResource.text, 4000);
  console.log(\`Content split into \${chunks.length} chunks\`);
}
\`\`\`

### Chunking Strategies

There are several strategies for chunking large content:

#### Size-based Chunking

\`\`\`typescript
function chunkBySize(
  content: string,
  maxTokens: number
): string[] {
  const chunks: string[] = [];
  let currentChunk = "";
  let currentTokens = 0;
  
  // Split by paragraphs for more natural chunks
  const paragraphs = content.split(/\\n\\s*\\n/);
  
  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);
    
    // If a single paragraph is too large, split it further
    if (paragraphTokens > maxTokens) {
      const subChunks = chunkParagraph(paragraph, maxTokens);
      for (const subChunk of subChunks) {
        chunks.push(subChunk);
      }
      continue;
    }
    
    // If adding this paragraph would exceed the limit, start a new chunk
    if (currentTokens + paragraphTokens > maxTokens) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
      currentTokens = paragraphTokens;
    } else {
      // Otherwise, add to the current chunk
      if (currentChunk) {
        currentChunk += "\\n\\n" + paragraph;
      } else {
        currentChunk = paragraph;
      }
      currentTokens += paragraphTokens;
    }
  }
  
  // Add the last chunk if it's not empty
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

function chunkParagraph(
  paragraph: string,
  maxTokens: number
): string[] {
  // Split by sentences for more natural sub-chunks
  const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
  return chunkBySize(sentences.join(" "), maxTokens);
}
\`\`\`

#### Semantic Chunking

\`\`\`typescript
// More advanced chunking based on semantic boundaries
async function chunkBySemantic(
  content: string,
  maxTokens: number
): Promise<string[]> {
  // This is a simplified example; actual implementation would be more complex
  
  // 1. Identify semantic sections (e.g., headings, topics)
  const sections = identifySections(content);
  
  // 2. Create chunks based on these sections
  const chunks: string[] = [];
  let currentChunk = "";
  let currentTokens = 0;
  
  for (const section of sections) {
    const sectionTokens = estimateTokens(section.text);
    
    // If a single section is too large, split it further
    if (sectionTokens > maxTokens) {
      const subChunks = chunkBySize(section.text, maxTokens);
      for (const subChunk of subChunks) {
        chunks.push(subChunk);
      }
      continue;
    }
    
    // If adding this section would exceed the limit, start a new chunk
    if (currentTokens + sectionTokens > maxTokens) {
      chunks.push(currentChunk);
      currentChunk = section.text;
      currentTokens = sectionTokens;
    } else {
      // Otherwise, add to the current chunk
      if (currentChunk) {
        currentChunk += "\\n\\n" + section.text;
      } else {
        currentChunk = section.text;
      }
      currentTokens += sectionTokens;
    }
  }
  
  // Add the last chunk if it's not empty
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

function identifySections(content: string): { title: string; text: string }[] {
  // Identify sections based on headings
  const sections: { title: string; text: string }[] = [];
  const headingPattern = /^(#{1,6})\\s+(.+)$/gm;
  
  let lastIndex = 0;
  let lastTitle = "Introduction";
  let match;
  
  while ((match = headingPattern.exec(content)) !== null) {
    // Add the previous section
    if (lastIndex > 0) {
      const sectionText = content.substring(lastIndex, match.index).trim();
      sections.push({ title: lastTitle, text: sectionText });
    } else if (match.index > 0) {
      // Add content before the first heading
      const introText = content.substring(0, match.index).trim();
      if (introText) {
        sections.push({ title: "Introduction", text: introText });
      }
    }
    
    lastIndex = match.index + match[0].length;
    lastTitle = match[2];
  }
  
  // Add the last section
  if (lastIndex < content.length) {
    const sectionText = content.substring(lastIndex).trim();
    sections.push({ title: lastTitle, text: sectionText });
  }
  
  return sections;
}
\`\`\`

### Efficient Content Delivery

Once content is chunked, it needs to be delivered efficiently:

#### Pagination

MCP supports pagination for resource responses:

\`\`\`typescript
interface ResourceResponseMessage extends McpBaseMessage {
  type: "resource_response";
  payload: {
    contents: ResourceContent[];
    nextPage?: string;  // URI for the next page
  };
}

// Server-side pagination implementation
server.resource(
  "large-document",
  new ResourceTemplate("docs://{documentId}", { list: undefined }),
  async (uri, { documentId }, context) => {
    // Get the page parameter, if any
    const url = new URL(uri.href);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = 5; // Number of chunks per page
    
    // Fetch the document
    const document = await documentStore.get(documentId);
    
    // Chunk the document if needed
    const chunks = document.chunks || chunkContent(document.content, 4000);
    
    // Calculate pagination
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, chunks.length);
    const currentChunks = chunks.slice(startIndex, endIndex);
    
    // Create resource contents
    const contents = currentChunks.map((chunk, index) => ({
      uri: \`docs://\${documentId}/chunk/\${startIndex + index + 1}\`,
      text: chunk,
      metadata: {
        documentId,
        chunkIndex: startIndex + index,
        totalChunks: chunks.length
      }
    }));
    
    // Determine if there's a next page
    let nextPage: string | undefined;
    if (endIndex < chunks.length) {
      const nextPageUrl = new URL(uri.href);
      nextPageUrl.searchParams.set("page", String(page + 1));
      nextPage = nextPageUrl.href;
    }
    
    return {
      contents,
      nextPage
    };
  }
);

// Client-side pagination handling
async function fetchAllResourcePages(
  uri: string
): Promise<ResourceContent[]> {
  let currentUri = uri;
  const allContents: ResourceContent[] = [];
  
  while (currentUri) {
    const response = await mcpClient.request({
      type: "resource_request",
      payload: { uri: currentUri }
    });
    
    // Add contents from this page
    allContents.push(...response.payload.contents);
    
    // Move to the next page, if any
    currentUri = response.payload.nextPage || "";
  }
  
  return allContents;
}
\`\`\`

#### Streaming

For real-time applications, streaming can be more efficient:

\`\`\`typescript
// Server-side streaming implementation
server.streamingResource(
  "live-data",
  "data://live",
  async (uri, context, stream) => {
    // Set up a data source (e.g., a WebSocket connection)
    const dataSource = await connectToDataSource();
    
    // Send initial data
    await stream.send([{
      uri: "data://live/initial",
      text: "Initial data payload",
      metadata: { timestamp: Date.now() }
    }]);
    
    // Set up a listener for new data
    dataSource.on("data", async (newData) => {
      await stream.send([{
        uri: \`data://live/\${newData.id}\`,
        text: newData.content,
        metadata: { timestamp: newData.timestamp }
      }]);
    });
    
    // Clean up when the stream is closed
    context.onClose(() => {
      dataSource.disconnect();
    });
  }
);

// Client-side streaming handling
async function subscribeToLiveData(
  uri: string,
  onData: (content: ResourceContent) => void
): Promise<() => void> {
  const stream = await mcpClient.streamResource(uri);
  
  stream.on("data", (contents) => {
    for (const content of contents) {
      onData(content);
    }
  });
  
  return () => {
    stream.close();
  };
}

// Usage
const unsubscribe = await subscribeToLiveData("data://live", (content) => {
  console.log(\`Received: \${content.text}\`);
});

// Later, to stop receiving updates
unsubscribe();
\`\`\`

By effectively using content blocks and chunking strategies, MCP applications can handle large amounts of content efficiently, making the most of limited context windows and providing a better user experience.

This section has covered the core concepts of MCP: message structure and format, context windows and management, action handling, and content blocks and chunking. Understanding these concepts is essential for building effective MCP applications. In the next sections, we'll explore how to implement these concepts in practice by building MCP servers and clients.
`;export{n as default};

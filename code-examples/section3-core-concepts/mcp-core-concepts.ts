/**
 * MCP Core Concepts
 * 
 * This example demonstrates the core concepts of MCP including:
 * - Message structure and format
 * - Context windows and management
 * - Action handling
 * - Content blocks and chunking
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";
import { z } from "zod";

// Define the port for our MCP server
const PORT = 3000;

/**
 * Context Manager Class
 * 
 * Demonstrates how to manage context in MCP applications
 */
class ContextManager {
  private items: Map<string, { text: string; priority: number; timestamp: number }> = new Map();
  private maxItems: number;
  
  constructor(maxItems: number = 10) {
    this.maxItems = maxItems;
  }
  
  /**
   * Add an item to the context
   */
  addItem(uri: string, text: string, priority: number = 1): void {
    // Check if we need to make room
    if (this.items.size >= this.maxItems) {
      this.makeRoom();
    }
    
    // Add or update the item
    this.items.set(uri, {
      text,
      priority,
      timestamp: Date.now()
    });
    
    console.log(`Added item to context: ${uri}`);
  }
  
  /**
   * Get an item from the context
   */
  getItem(uri: string): string | null {
    const item = this.items.get(uri);
    return item ? item.text : null;
  }
  
  /**
   * Get all items in the context
   */
  getAllItems(): Array<{ uri: string; text: string; priority: number; timestamp: number }> {
    return Array.from(this.items.entries()).map(([uri, item]) => ({
      uri,
      ...item
    }));
  }
  
  /**
   * Make room in the context by removing low-priority items
   */
  private makeRoom(): void {
    // Sort items by priority (ascending) and then by timestamp (ascending)
    const sortedItems = Array.from(this.items.entries())
      .sort(([, a], [, b]) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.timestamp - b.timestamp;
      });
    
    // Remove the lowest priority item
    if (sortedItems.length > 0) {
      const [uriToRemove] = sortedItems[0];
      this.items.delete(uriToRemove);
      console.log(`Removed item from context: ${uriToRemove}`);
    }
  }
}

/**
 * Start the MCP server with various resource and action handlers
 */
async function startServer() {
  // Create a new MCP server
  const server = new McpServer({
    name: "MCP Core Concepts Server",
    version: "1.0.0"
  });

  // Register a simple resource
  server.resource(
    "document",
    "doc://{documentId}",
    async (uri, { documentId }) => {
      console.log(`Server: Received request for document: ${documentId}`);
      
      // Simulate fetching a document
      const documents = {
        "1": "This is document 1. It contains important information about MCP.",
        "2": "This is document 2. It explains context management in detail.",
        "3": "This is document 3. It covers action handling and content blocks."
      };
      
      const content = documents[documentId] || "Document not found";
      
      return {
        contents: [{
          uri: uri.href,
          text: content,
          metadata: {
            documentId,
            timestamp: new Date().toISOString()
          }
        }]
      };
    }
  );

  // Register a chunked resource for large content
  server.resource(
    "large-document",
    "large-doc://{documentId}",
    async (uri, { documentId }) => {
      console.log(`Server: Received request for large document: ${documentId}`);
      
      // Simulate a large document that needs to be chunked
      const largeContent = "This is a large document that demonstrates content chunking in MCP. ".repeat(50);
      
      // Split content into chunks
      const chunkSize = 200;
      const chunks = [];
      
      for (let i = 0; i < largeContent.length; i += chunkSize) {
        chunks.push(largeContent.substring(i, i + chunkSize));
      }
      
      // Create content blocks for each chunk
      const contents = chunks.map((chunk, index) => ({
        uri: `${uri.href}/chunk/${index + 1}`,
        text: chunk,
        metadata: {
          documentId,
          chunkIndex: index,
          totalChunks: chunks.length
        }
      }));
      
      return { contents };
    }
  );

  // Register an action handler with parameter validation
  server.tool(
    "summarize",
    {
      text: z.string(),
      maxLength: z.number().optional()
    },
    async ({ text, maxLength = 100 }) => {
      console.log(`Server: Received summarize action request`);
      
      // Simple summarization: take the first sentence and truncate
      const firstSentence = text.split('.')[0] + '.';
      const summary = firstSentence.length > maxLength
        ? firstSentence.substring(0, maxLength) + '...'
        : firstSentence;
      
      return {
        content: [{
          type: "text",
          text: `Summary: ${summary}`
        }]
      };
    }
  );

  // Create an HTTP transport for the server
  const transport = new HttpServerTransport({ port: PORT });
  
  // Connect the server to the transport
  await server.connect(transport);
  
  console.log(`MCP server running on port ${PORT}`);
  
  return server;
}

/**
 * Create and use an MCP client with context management
 */
async function runClient() {
  // Create a transport for the client
  const transport = new HttpClientTransport(`http://localhost:${PORT}`);
  
  // Create a new MCP client
  const client = new McpClient(transport);
  
  // Create a context manager
  const contextManager = new ContextManager(5);
  
  // Connect the client
  await client.connect();
  console.log("Client: Connected to MCP server");
  
  try {
    // Fetch multiple resources and add them to context
    for (const docId of ["1", "2", "3"]) {
      console.log(`Client: Fetching document ${docId}`);
      
      const resources = await client.fetchResource(`doc://${docId}`);
      
      resources.forEach(resource => {
        console.log(`- Received: ${resource.text.substring(0, 30)}...`);
        
        // Add to context manager
        contextManager.addItem(resource.uri, resource.text, parseInt(docId));
      });
    }
    
    // Display the current context
    console.log("\nCurrent Context:");
    contextManager.getAllItems().forEach(item => {
      console.log(`- ${item.uri} (Priority: ${item.priority}): ${item.text.substring(0, 30)}...`);
    });
    
    // Fetch a large document to demonstrate chunking
    console.log("\nClient: Fetching large document");
    const largeResources = await client.fetchResource("large-doc://1");
    
    console.log(`Received ${largeResources.length} chunks:`);
    largeResources.forEach((resource, index) => {
      console.log(`- Chunk ${index + 1}/${resource.metadata.totalChunks}: ${resource.text.substring(0, 30)}...`);
    });
    
    // Combine chunks and add to context
    const combinedText = largeResources.map(r => r.text).join("");
    contextManager.addItem("large-doc://1", combinedText, 5);
    
    // Execute an action using content from context
    console.log("\nClient: Executing summarize action");
    const textToSummarize = contextManager.getItem("doc://2") || "No content available";
    
    const actionResult = await client.executeAction("summarize", {
      text: textToSummarize,
      maxLength: 50
    });
    
    console.log("Action Result:", actionResult.content[0].text);
    
    // Display final context state
    console.log("\nFinal Context State:");
    contextManager.getAllItems().forEach(item => {
      console.log(`- ${item.uri} (Priority: ${item.priority}): ${item.text.substring(0, 30)}...`);
    });
  } finally {
    // Disconnect the client
    await client.disconnect();
    console.log("\nClient: Disconnected from MCP server");
  }
}

/**
 * Main function to run the example
 */
async function main() {
  // Start the server
  const server = await startServer();
  
  try {
    // Run the client
    await runClient();
  } finally {
    // Disconnect the server
    await server.disconnect();
    console.log("Server: Shut down");
  }
}

// Run the example
main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});

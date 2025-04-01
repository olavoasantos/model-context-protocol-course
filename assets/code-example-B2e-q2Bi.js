const n=`/**
 * Building an MCP Client in TypeScript
 * 
 * This example demonstrates how to build a complete MCP client that can
 * interact with an MCP server, manage context, and handle various response types.
 */

import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";

// Define the server URL
const SERVER_URL = "http://localhost:3000";

/**
 * Context Manager Class
 * 
 * Manages the context window for the MCP client
 */
class ContextManager {
  private items: Map<string, ContextItem> = new Map();
  private maxTokens: number;
  private currentTokens: number = 0;
  
  constructor(maxTokens: number = 8000) {
    this.maxTokens = maxTokens;
  }
  
  /**
   * Add an item to the context
   */
  addItem(uri: string, text: string, metadata: any = {}, priority: number = 1): boolean {
    // Estimate token count (simple approximation)
    const tokenCount = this.estimateTokens(text);
    
    // Check if we need to make room
    if (this.currentTokens + tokenCount > this.maxTokens) {
      if (!this.makeRoom(tokenCount)) {
        console.log(\`Cannot add item: \${uri} - Not enough space in context window\`);
        return false;
      }
    }
    
    // Add or update the item
    this.items.set(uri, {
      uri,
      text,
      metadata,
      tokenCount,
      priority,
      timestamp: Date.now()
    });
    
    this.currentTokens += tokenCount;
    console.log(\`Added to context: \${uri} (\${tokenCount} tokens, priority \${priority})\`);
    return true;
  }
  
  /**
   * Get an item from the context
   */
  getItem(uri: string): ContextItem | undefined {
    return this.items.get(uri);
  }
  
  /**
   * Remove an item from the context
   */
  removeItem(uri: string): boolean {
    const item = this.items.get(uri);
    if (item) {
      this.items.delete(uri);
      this.currentTokens -= item.tokenCount;
      console.log(\`Removed from context: \${uri}\`);
      return true;
    }
    return false;
  }
  
  /**
   * Get all items in the context
   */
  getAllItems(): ContextItem[] {
    return Array.from(this.items.values());
  }
  
  /**
   * Get the current token usage
   */
  getTokenUsage(): { used: number; total: number; percentage: number } {
    return {
      used: this.currentTokens,
      total: this.maxTokens,
      percentage: (this.currentTokens / this.maxTokens) * 100
    };
  }
  
  /**
   * Clear the context
   */
  clear(): void {
    this.items.clear();
    this.currentTokens = 0;
    console.log("Context cleared");
  }
  
  /**
   * Make room in the context for new content
   */
  private makeRoom(requiredTokens: number): boolean {
    // If the required tokens exceed the max, it's impossible
    if (requiredTokens > this.maxTokens) {
      return false;
    }
    
    // If we already have enough room, no action needed
    if (this.currentTokens + requiredTokens <= this.maxTokens) {
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
      if (this.currentTokens <= targetTokens) {
        break;
      }
      
      this.items.delete(item.uri);
      this.currentTokens -= item.tokenCount;
      console.log(\`Evicted from context: \${item.uri} (priority \${item.priority})\`);
    }
    
    return this.currentTokens <= targetTokens;
  }
  
  /**
   * Estimate the number of tokens in a text
   */
  private estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }
}

/**
 * Context Item interface
 */
interface ContextItem {
  uri: string;
  text: string;
  metadata: any;
  tokenCount: number;
  priority: number;
  timestamp: number;
}

/**
 * MCP Client Wrapper
 * 
 * A wrapper around the MCP client that adds context management
 */
class McpClientWrapper {
  private client: McpClient;
  private contextManager: ContextManager;
  private connected: boolean = false;
  
  constructor(serverUrl: string, maxContextTokens: number = 8000) {
    const transport = new HttpClientTransport(serverUrl);
    this.client = new McpClient(transport);
    this.contextManager = new ContextManager(maxContextTokens);
  }
  
  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
      console.log("Connected to MCP server");
    }
  }
  
  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
      this.connected = false;
      console.log("Disconnected from MCP server");
    }
  }
  
  /**
   * Fetch a resource and add it to context
   */
  async fetchResource(uri: string, priority: number = 1): Promise<any[]> {
    this.ensureConnected();
    
    console.log(\`Fetching resource: \${uri}\`);
    const resources = await this.client.fetchResource(uri);
    
    // Add resources to context
    resources.forEach(resource => {
      this.contextManager.addItem(
        resource.uri,
        resource.text,
        resource.metadata,
        priority
      );
    });
    
    return resources;
  }
  
  /**
   * Execute an action
   */
  async executeAction(action: string, params: any): Promise<any> {
    this.ensureConnected();
    
    console.log(\`Executing action: \${action}\`);
    return await this.client.executeAction(action, params);
  }
  
  /**
   * Get the context manager
   */
  getContextManager(): ContextManager {
    return this.contextManager;
  }
  
  /**
   * Check if connected to the server
   */
  isConnected(): boolean {
    return this.connected;
  }
  
  /**
   * Ensure the client is connected
   */
  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error("Client not connected to MCP server");
    }
  }
}

/**
 * Knowledge Base Client
 * 
 * A specialized client for interacting with the knowledge base server
 */
class KnowledgeBaseClient {
  private client: McpClientWrapper;
  
  constructor(serverUrl: string) {
    this.client = new McpClientWrapper(serverUrl);
  }
  
  /**
   * Connect to the server
   */
  async connect(): Promise<void> {
    await this.client.connect();
  }
  
  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
  
  /**
   * Get a knowledge base
   */
  async getKnowledgeBase(id: string): Promise<any> {
    const resources = await this.client.fetchResource(\`kb://\${id}\`);
    return resources[0];
  }
  
  /**
   * Get a document
   */
  async getDocument(id: string): Promise<any> {
    const resources = await this.client.fetchResource(\`doc://\${id}\`);
    return resources[0];
  }
  
  /**
   * Search for documents
   */
  async searchDocuments(query: string): Promise<any[]> {
    return await this.client.fetchResource(\`search://\${query}\`);
  }
  
  /**
   * Create a new document
   */
  async createDocument(knowledgeBaseId: string, title: string, content: string): Promise<any> {
    return await this.client.executeAction("document.create", {
      knowledgeBaseId,
      title,
      content
    });
  }
  
  /**
   * Update a document
   */
  async updateDocument(documentId: string, updates: { title?: string; content?: string }): Promise<any> {
    return await this.client.executeAction("document.update", {
      documentId,
      ...updates
    });
  }
  
  /**
   * Summarize a document
   */
  async summarizeDocument(documentId: string): Promise<any> {
    return await this.client.executeAction("document.summarize", {
      documentId
    });
  }
  
  /**
   * Get the context manager
   */
  getContextManager(): ContextManager {
    return this.client.getContextManager();
  }
}

/**
 * Example usage of the Knowledge Base Client
 */
async function runClientExample() {
  // Create the client
  const client = new KnowledgeBaseClient(SERVER_URL);
  
  try {
    // Connect to the server
    await client.connect();
    
    // Get a knowledge base
    console.log("\\nFetching knowledge base...");
    const kb = await client.getKnowledgeBase("kb1");
    console.log("Knowledge Base:", {
      title: kb.metadata.title,
      description: kb.metadata.description,
      documentCount: kb.metadata.documentCount
    });
    
    // Get documents
    console.log("\\nFetching documents...");
    const doc1 = await client.getDocument("doc1");
    console.log("Document 1:", {
      title: doc1.metadata.title,
      content: doc1.text.substring(doc1.metadata.title.length + 2) // Remove title from content
    });
    
    // Search for documents
    console.log("\\nSearching for documents...");
    const searchResults = await client.searchDocuments("MCP");
    console.log(\`Found \${searchResults.length} documents:\`);
    searchResults.forEach((doc, index) => {
      console.log(\`\${index + 1}. \${doc.metadata.title}\`);
    });
    
    // Create a new document
    console.log("\\nCreating a new document...");
    const createResult = await client.createDocument(
      "kb1",
      "MCP Client Implementation",
      "This document explains how to implement an MCP client with context management."
    );
    console.log("Create result:", createResult.content[0].text);
    
    // Summarize a document
    console.log("\\nSummarizing a document...");
    const summaryResult = await client.summarizeDocument("doc2");
    console.log("Summary:", summaryResult.content[0].text);
    
    // Check context state
    console.log("\\nContext state:");
    const contextManager = client.getContextManager();
    const usage = contextManager.getTokenUsage();
    console.log(\`Token usage: \${usage.used}/\${usage.total} (\${usage.percentage.toFixed(1)}%)\`);
    
    const contextItems = contextManager.getAllItems();
    console.log(\`Items in context: \${contextItems.length}\`);
    contextItems.forEach(item => {
      console.log(\`- \${item.uri} (\${item.tokenCount} tokens, priority \${item.priority})\`);
    });
  } finally {
    // Disconnect from the server
    await client.disconnect();
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await runClientExample();
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

// Export for testing
export { McpClientWrapper, ContextManager, KnowledgeBaseClient };
`;export{n as default};

const n=`/**
 * Advanced MCP Features
 * 
 * This example demonstrates advanced MCP features including:
 * - Implementing action handlers with complex logic
 * - Content block management with different content types
 * - Context window optimization techniques
 * - Error handling and recovery
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

// Define the port for our MCP server
const PORT = 3000;

/**
 * Advanced Context Manager
 * 
 * Implements sophisticated context management with LRU, priority, and semantic relevance
 */
class AdvancedContextManager {
  private items: Map<string, ContextItem> = new Map();
  private maxTokens: number;
  private currentTokens: number = 0;
  private semanticIndex: Map<string, Set<string>> = new Map();
  
  constructor(maxTokens: number = 8000) {
    this.maxTokens = maxTokens;
  }
  
  /**
   * Add an item to the context
   */
  addItem(uri: string, text: string, metadata: any = {}, priority: number = 1): boolean {
    // Estimate token count
    const tokenCount = this.estimateTokens(text);
    
    // Check if we need to make room
    if (this.currentTokens + tokenCount > this.maxTokens) {
      if (!this.makeRoom(tokenCount)) {
        console.log(\`Cannot add item: \${uri} - Not enough space in context window\`);
        return false;
      }
    }
    
    // Extract keywords for semantic indexing
    const keywords = this.extractKeywords(text);
    
    // Add or update the item
    this.items.set(uri, {
      uri,
      text,
      metadata,
      tokenCount,
      priority,
      timestamp: Date.now(),
      keywords,
      accessCount: 0
    });
    
    // Update semantic index
    keywords.forEach(keyword => {
      if (!this.semanticIndex.has(keyword)) {
        this.semanticIndex.set(keyword, new Set());
      }
      this.semanticIndex.get(keyword)?.add(uri);
    });
    
    this.currentTokens += tokenCount;
    console.log(\`Added to context: \${uri} (\${tokenCount} tokens, priority \${priority})\`);
    return true;
  }
  
  /**
   * Get an item from the context
   */
  getItem(uri: string): ContextItem | undefined {
    const item = this.items.get(uri);
    if (item) {
      // Update access count and timestamp for LRU
      item.accessCount += 1;
      item.timestamp = Date.now();
    }
    return item;
  }
  
  /**
   * Find semantically relevant items
   */
  findRelevantItems(query: string): ContextItem[] {
    const queryKeywords = this.extractKeywords(query);
    const relevanceScores = new Map<string, number>();
    
    // Calculate relevance scores
    queryKeywords.forEach(keyword => {
      const matchingUris = this.semanticIndex.get(keyword) || new Set();
      matchingUris.forEach(uri => {
        const currentScore = relevanceScores.get(uri) || 0;
        relevanceScores.set(uri, currentScore + 1);
      });
    });
    
    // Sort by relevance score
    const sortedUris = Array.from(relevanceScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([uri]) => uri);
    
    // Return relevant items
    return sortedUris
      .map(uri => this.items.get(uri))
      .filter((item): item is ContextItem => item !== undefined);
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
    
    // Calculate a composite score for each item based on:
    // - Priority (higher is better)
    // - Access count (higher is better)
    // - Recency (higher is better)
    const now = Date.now();
    const maxAge = 3600000; // 1 hour in milliseconds
    
    const itemScores = Array.from(this.items.entries()).map(([uri, item]) => {
      const priorityScore = item.priority * 10;
      const accessScore = Math.min(item.accessCount, 10);
      const ageScore = Math.max(0, 10 - (10 * (now - item.timestamp) / maxAge));
      
      return {
        uri,
        item,
        score: priorityScore + accessScore + ageScore
      };
    });
    
    // Sort by score (ascending)
    itemScores.sort((a, b) => a.score - b.score);
    
    // Remove items until we have enough room
    const targetTokens = this.maxTokens - requiredTokens;
    for (const { uri, item, score } of itemScores) {
      if (this.currentTokens <= targetTokens) {
        break;
      }
      
      // Remove from semantic index
      item.keywords.forEach(keyword => {
        const uriSet = this.semanticIndex.get(keyword);
        if (uriSet) {
          uriSet.delete(uri);
          if (uriSet.size === 0) {
            this.semanticIndex.delete(keyword);
          }
        }
      });
      
      // Remove from items
      this.items.delete(uri);
      this.currentTokens -= item.tokenCount;
      console.log(\`Evicted from context: \${uri} (score \${score.toFixed(2)})\`);
    }
    
    return this.currentTokens <= targetTokens;
  }
  
  /**
   * Extract keywords from text for semantic indexing
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction: lowercase, remove punctuation, split by whitespace
    const words = text.toLowerCase()
      .replace(/[^\\w\\s]/g, '')
      .split(/\\s+/)
      .filter(word => word.length > 3);
    
    // Remove duplicates
    return Array.from(new Set(words));
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
  keywords: string[];
  accessCount: number;
}

/**
 * Content Block Manager
 * 
 * Manages different types of content blocks
 */
class ContentBlockManager {
  /**
   * Create a text content block
   */
  createTextBlock(text: string, metadata: any = {}): ContentBlock {
    return {
      type: "text",
      text,
      metadata
    };
  }
  
  /**
   * Create a code content block
   */
  createCodeBlock(code: string, language: string, metadata: any = {}): ContentBlock {
    return {
      type: "code",
      text: code,
      metadata: {
        ...metadata,
        language
      }
    };
  }
  
  /**
   * Create a table content block
   */
  createTableBlock(headers: string[], rows: string[][], metadata: any = {}): ContentBlock {
    // Format as markdown table
    const headerRow = \`| \${headers.join(' | ')} |\`;
    const separatorRow = \`| \${headers.map(() => '---').join(' | ')} |\`;
    const dataRows = rows.map(row => \`| \${row.join(' | ')} |\`);
    
    const tableText = [headerRow, separatorRow, ...dataRows].join('\\n');
    
    return {
      type: "table",
      text: tableText,
      metadata: {
        ...metadata,
        format: "markdown",
        headers,
        rowCount: rows.length
      }
    };
  }
  
  /**
   * Create an image reference content block
   */
  createImageBlock(imageUrl: string, altText: string, metadata: any = {}): ContentBlock {
    return {
      type: "image",
      text: \`![\${altText}](\${imageUrl})\`,
      metadata: {
        ...metadata,
        imageUrl,
        altText
      }
    };
  }
  
  /**
   * Create a composite content block with multiple blocks
   */
  createCompositeBlock(blocks: ContentBlock[], metadata: any = {}): ContentBlock[] {
    return blocks.map((block, index) => ({
      ...block,
      metadata: {
        ...block.metadata,
        ...metadata,
        compositeIndex: index,
        compositeTotal: blocks.length
      }
    }));
  }
}

/**
 * Content Block interface
 */
interface ContentBlock {
  type: string;
  text: string;
  metadata: any;
}

/**
 * Error Handler
 * 
 * Handles errors with retry logic and fallbacks
 */
class ErrorHandler {
  private maxRetries: number;
  private retryDelayMs: number;
  
  constructor(maxRetries: number = 3, retryDelayMs: number = 1000) {
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
  }
  
  /**
   * Execute a function with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    errorHandler?: (error: Error, attempt: number) => Promise<void>
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.error(\`Error (attempt \${attempt}/\${this.maxRetries}):\`, error);
        
        if (errorHandler) {
          await errorHandler(lastError, attempt);
        }
        
        if (attempt < this.maxRetries) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * attempt));
        }
      }
    }
    
    throw new Error(\`Operation failed after \${this.maxRetries} attempts: \${lastError?.message}\`);
  }
  
  /**
   * Execute a function with a fallback
   */
  async withFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: (error: Error) => Promise<T>
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (error) {
      console.error("Primary operation failed, using fallback:", error);
      return await fallbackOperation(error as Error);
    }
  }
}

/**
 * Start the MCP server with advanced features
 */
async function startServer() {
  // Create a content block manager
  const blockManager = new ContentBlockManager();
  
  // Create an error handler
  const errorHandler = new ErrorHandler();
  
  // Create a new MCP server
  const server = new McpServer({
    name: "Advanced MCP Server",
    version: "1.0.0",
    
    // Error handling
    onError: (error, context) => {
      console.error(\`Server error: \${error.message}\`, {
        code: error.code,
        details: error.details,
        connectionId: context?.connectionId
      });
    }
  });

  // Register a resource with complex content blocks
  server.resource(
    "article",
    "article://{articleId}",
    async (uri, { articleId }) => {
      console.log(\`Server: Received request for article: \${articleId}\`);
      
      // Simulate fetching an article
      const articleData = await errorHandler.withRetry(async () => {
        // Simulate potential errors
        if (Math.random() < 0.2) {
          throw new Error("Simulated database error");
        }
        
        // Return article data
        return {
          id: articleId,
          title: \`Article \${articleId}\`,
          content: \`This is the content of article \${articleId}. It contains multiple paragraphs and sections.\`,
          author: "John Doe",
          publishedAt: new Date().toISOString(),
          tags: ["MCP", "TypeScript", "Advanced"]
        };
      });
      
      // Create different content blocks
      const textBlock = blockManager.createTextBlock(
        \`# \${articleData.title}\\n\\n\${articleData.content}\`,
        { author: articleData.author, publishedAt: articleData.publishedAt }
      );
      
      const codeBlock = blockManager.createCodeBlock(
        \`const article = {\\n  id: "\${articleData.id}",\\n  title: "\${articleData.title}"\\n};\`,
        "typescript",
        { purpose: "Example code" }
      );
      
      const tableBlock = blockManager.createTableBlock(
        ["Property", "Value"],
        [
          ["ID", articleData.id],
          ["Title", articleData.title],
          ["Author", articleData.author],
          ["Published", articleData.publishedAt]
        ],
        { purpose: "Article metadata" }
      );
      
      // Combine blocks
      const blocks = blockManager.createCompositeBlock(
        [textBlock, codeBlock, tableBlock],
        { articleId: articleData.id }
      );
      
      // Return content blocks
      return {
        contents: blocks.map((block, index) => ({
          uri: \`\${uri.href}/block/\${index + 1}\`,
          text: block.text,
          metadata: block.metadata
        }))
      };
    }
  );

  // Register an action with complex parameter handling
  server.tool(
    "article.analyze",
    {
      articleId: z.string(),
      analysisType: z.enum(["sentiment", "keywords", "summary"]),
      options: z.object({
        maxResults: z.number().optional(),
        includeMetadata: z.boolean().optional()
      }).optional()
    },
    async ({ articleId, analysisType, options = {} }) => {
      console.log(\`Server: Received analyze action for article \${articleId}\`);
      
      const { maxResults = 5, includeMetadata = false } = options;
      
      // Simulate analysis with potential errors
      const analysisResult = await errorHandler.withFallback(
        async () => {
          // Simulate primary analysis
          if (Math.random() < 0.3) {
            throw new Error("Primary analysis service unavailable");
          }
          
          // Return analysis results
          switch (analysisType) {
            case "sentiment":
              return { score: 0.75, label: "Positive" };
            case "keywords":
              return { keywords: ["MCP", "TypeScript", "Protocol", "Context", "Advanced"] };
            case "summary":
              return { summary: \`This is a summary of article \${articleId}.\` };
          }
        },
        async (error) => {
          // Fallback analysis (simpler)
          console.log(\`Using fallback analysis due to: \${error.message}\`);
          
          switch (analysisType) {
            case "sentiment":
              return { score: 0.5, label: "Neutral", fallback: true };
            case "keywords":
              return { keywords: ["MCP", "TypeScript"], fallback: true };
            case "summary":
              return { summary: \`Article \${articleId} (fallback summary).\`, fallback: true };
          }
        }
      );
      
      // Create response content
      let responseText = "";
      
      switch (analysisType) {
        case "sentiment":
          responseText = \`Sentiment Analysis: \${analysisResult.label} (\${analysisResult.score})\`;
          break;
        case "keywords":
          const keywords = analysisResult.keywords.slice(0, maxResults);
          responseText = \`Keywords: \${keywords.join(", ")}\`;
          break;
        case "summary":
          responseText = \`Summary: \${analysisResult.summary}\`;
          break;
      }
      
      // Add metadata notice if requested
      if (includeMetadata) {
        responseText += \`\\n\\nAnalysis metadata: \${JSON.stringify(analysisResult)}\`;
      }
      
      // Add fallback notice if applicable
      if (analysisResult.fallback) {
        responseText += "\\n\\nNote: This is a fallback result as the primary analysis service was unavailable.";
      }
      
      return {
        content: [{
          type: "text",
          text: responseText
        }]
      };
    }
  );

  // Create an HTTP transport for the server
  const transport = new HttpServerTransport({ port: PORT });
  
  // Connect the server to the transport
  await server.connect(transport);
  
  console.log(\`MCP server running on port \${PORT}\`);
  
  return server;
}

/**
 * Create and use an MCP client with advanced features
 */
async function runClient() {
  // Create a transport for the client
  const transport = new HttpClientTransport(\`http://localhost:\${PORT}\`);
  
  // Create a new MCP client
  const client = new McpClient(transport);
  
  // Create an advanced context manager
  const contextManager = new AdvancedContextManager(4000);
  
  // Create an error handler
  const errorHandler = new ErrorHandler();
  
  // Connect the client
  await client.connect();
  console.log("Client: Connected to MCP server");
  
  try {
    // Fetch an article with multiple content blocks
    console.log("\\nClient: Fetching article");
    
    const articleResources = await errorHandler.withRetry(
      async () => await client.fetchResource("article://123"),
      async (error, attempt) => {
        console.log(\`Retrying article fetch (attempt \${attempt})...\`);
      }
    );
    
    console.log(\`Received \${articleResources.length} content blocks:\`);
    
    // Process and add to context
    articleResources.forEach((resource, index) => {
      console.log(\`- Block \${index + 1}: \${resource.metadata.type || "text"}\`);
      
      // Add to context with priority based on block type
      const priority = resource.metadata.type === "text" ? 3 : 1;
      contextManager.addItem(resource.uri, resource.text, resource.metadata, priority);
    });
    
    // Execute an action with complex parameters
    console.log("\\nClient: Executing article.analyze action");
    
    const analysisResult = await client.executeAction("article.analyze", {
      articleId: "123",
      analysisType: "keywords",
      options: {
        maxResults: 3,
        includeMetadata: true
      }
    });
    
    console.log("Analysis Result:", analysisResult.content[0].text);
    
    // Find relevant context items
    console.log("\\nClient: Finding relevant context items for 'TypeScript MCP'");
    const relevantItems = contextManager.findRelevantItems("TypeScript MCP");
    
    console.log(\`Found \${relevantItems.length} relevant items:\`);
    relevantItems.forEach((item, index) => {
      console.log(\`- \${index + 1}: \${item.uri} (\${item.keywords.join(", ")})\`);
    });
  } finally {
    // Disconnect the client
    await client.disconnect();
    console.log("\\nClient: Disconnected from MCP server");
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
if (require.main === module) {
  main().catch(error => {
    console.error("Error:", error);
    process.exit(1);
  });
}

// Export for testing
export { 
  AdvancedContextManager, 
  ContentBlockManager, 
  ErrorHandler 
};
`;export{n as default};

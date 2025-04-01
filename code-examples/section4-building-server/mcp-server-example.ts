/**
 * Building an MCP Server in TypeScript
 * 
 * This example demonstrates how to build a complete MCP server with multiple
 * resources and actions, proper error handling, and connection management.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define the port for our MCP server
const PORT = 3000;

/**
 * Knowledge Base Store
 * 
 * A simple in-memory store for knowledge base data
 */
class KnowledgeBaseStore {
  private knowledgeBases: Map<string, KnowledgeBase> = new Map();
  private documents: Map<string, Document> = new Map();
  
  constructor() {
    // Initialize with some sample data
    this.addKnowledgeBase({
      id: "kb1",
      title: "MCP Introduction",
      description: "An introduction to Model Context Protocol",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    this.addDocument({
      id: "doc1",
      knowledgeBaseId: "kb1",
      title: "What is MCP?",
      content: "Model Context Protocol (MCP) is a communication protocol designed for AI agents to manage context effectively.",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    this.addDocument({
      id: "doc2",
      knowledgeBaseId: "kb1",
      title: "MCP Components",
      content: "MCP consists of resources, actions, and context management mechanisms that enable efficient communication between clients and servers.",
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  
  // Knowledge Base methods
  addKnowledgeBase(kb: KnowledgeBase): void {
    this.knowledgeBases.set(kb.id, kb);
  }
  
  getKnowledgeBase(id: string): KnowledgeBase | undefined {
    return this.knowledgeBases.get(id);
  }
  
  getAllKnowledgeBases(): KnowledgeBase[] {
    return Array.from(this.knowledgeBases.values());
  }
  
  // Document methods
  addDocument(doc: Document): void {
    this.documents.set(doc.id, doc);
  }
  
  getDocument(id: string): Document | undefined {
    return this.documents.get(id);
  }
  
  getDocumentsByKnowledgeBase(knowledgeBaseId: string): Document[] {
    return Array.from(this.documents.values())
      .filter(doc => doc.knowledgeBaseId === knowledgeBaseId);
  }
  
  searchDocuments(query: string): Document[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.documents.values())
      .filter(doc => 
        doc.title.toLowerCase().includes(lowerQuery) || 
        doc.content.toLowerCase().includes(lowerQuery)
      );
  }
  
  updateDocument(id: string, updates: Partial<Document>): Document | undefined {
    const doc = this.documents.get(id);
    if (!doc) return undefined;
    
    const updatedDoc = { ...doc, ...updates, updatedAt: new Date() };
    this.documents.set(id, updatedDoc);
    return updatedDoc;
  }
}

// Type definitions
interface KnowledgeBase {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Document {
  id: string;
  knowledgeBaseId: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create and start the MCP server
 */
async function startServer() {
  // Create the data store
  const store = new KnowledgeBaseStore();
  
  // Create a new MCP server
  const server = new McpServer({
    name: "Knowledge Base MCP Server",
    version: "1.0.0",
    
    // Error handling
    onError: (error, context) => {
      console.error(`Server error: ${error.message}`, {
        code: error.code,
        details: error.details,
        connectionId: context?.connectionId
      });
    }
  });

  // Register resource handlers
  registerResources(server, store);
  
  // Register action handlers
  registerActions(server, store);
  
  // Set up connection handling
  server.on('connection', (context) => {
    console.log(`Client connected: ${context.connectionId}`);
    
    context.onClose(() => {
      console.log(`Client disconnected: ${context.connectionId}`);
    });
  });

  // Create an HTTP transport for the server
  const transport = new HttpServerTransport({ 
    port: PORT,
    cors: {
      origin: "*", // In production, restrict to your domain
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type"]
    }
  });
  
  // Connect the server to the transport
  await server.connect(transport);
  
  console.log(`MCP server running on port ${PORT}`);
  
  return server;
}

/**
 * Register resource handlers
 */
function registerResources(server: McpServer, store: KnowledgeBaseStore) {
  // Knowledge Base resource
  const kbTemplate = new ResourceTemplate("kb://{knowledgeBaseId}");
  
  server.resource(
    "knowledge-base",
    kbTemplate,
    async (uri, { knowledgeBaseId }, context) => {
      console.log(`Resource request: knowledge-base ${knowledgeBaseId} from ${context.connectionId}`);
      
      // Get the knowledge base
      const kb = store.getKnowledgeBase(knowledgeBaseId);
      
      if (!kb) {
        throw new Error(`Knowledge base not found: ${knowledgeBaseId}`);
      }
      
      // Get documents in this knowledge base
      const documents = store.getDocumentsByKnowledgeBase(knowledgeBaseId);
      
      // Format the response
      return {
        contents: [{
          uri: uri.href,
          text: `# ${kb.title}\n\n${kb.description}\n\n## Documents\n\n${
            documents.map(doc => `- ${doc.title}`).join('\n')
          }`,
          metadata: {
            id: kb.id,
            title: kb.title,
            description: kb.description,
            documentCount: documents.length,
            createdAt: kb.createdAt.toISOString(),
            updatedAt: kb.updatedAt.toISOString()
          }
        }]
      };
    }
  );
  
  // Document resource
  const docTemplate = new ResourceTemplate("doc://{documentId}");
  
  server.resource(
    "document",
    docTemplate,
    async (uri, { documentId }, context) => {
      console.log(`Resource request: document ${documentId} from ${context.connectionId}`);
      
      // Get the document
      const doc = store.getDocument(documentId);
      
      if (!doc) {
        throw new Error(`Document not found: ${documentId}`);
      }
      
      // Get the knowledge base
      const kb = store.getKnowledgeBase(doc.knowledgeBaseId);
      
      if (!kb) {
        throw new Error(`Knowledge base not found: ${doc.knowledgeBaseId}`);
      }
      
      // Format the response
      return {
        contents: [{
          uri: uri.href,
          text: `# ${doc.title}\n\n${doc.content}`,
          metadata: {
            id: doc.id,
            title: doc.title,
            knowledgeBaseId: doc.knowledgeBaseId,
            knowledgeBaseTitle: kb.title,
            createdAt: doc.createdAt.toISOString(),
            updatedAt: doc.updatedAt.toISOString()
          }
        }]
      };
    }
  );
  
  // Search resource
  const searchTemplate = new ResourceTemplate("search://{query}");
  
  server.resource(
    "search",
    searchTemplate,
    async (uri, { query }, context) => {
      console.log(`Resource request: search "${query}" from ${context.connectionId}`);
      
      // Search for documents
      const results = store.searchDocuments(query);
      
      // Format the response
      return {
        contents: results.map(doc => ({
          uri: `doc://${doc.id}`,
          text: `# ${doc.title}\n\n${doc.content.substring(0, 100)}...`,
          metadata: {
            id: doc.id,
            title: doc.title,
            knowledgeBaseId: doc.knowledgeBaseId
          }
        }))
      };
    }
  );
}

/**
 * Register action handlers
 */
function registerActions(server: McpServer, store: KnowledgeBaseStore) {
  // Create document action
  server.tool(
    "document.create",
    {
      knowledgeBaseId: z.string(),
      title: z.string(),
      content: z.string()
    },
    async ({ knowledgeBaseId, title, content }, context) => {
      console.log(`Action request: document.create from ${context.connectionId}`);
      
      // Check if knowledge base exists
      const kb = store.getKnowledgeBase(knowledgeBaseId);
      
      if (!kb) {
        throw new Error(`Knowledge base not found: ${knowledgeBaseId}`);
      }
      
      // Create a new document
      const docId = `doc${Date.now()}`;
      const newDoc: Document = {
        id: docId,
        knowledgeBaseId,
        title,
        content,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      store.addDocument(newDoc);
      
      return {
        content: [{
          type: "text",
          text: `Document created successfully. ID: ${docId}`
        }]
      };
    }
  );
  
  // Update document action
  server.tool(
    "document.update",
    {
      documentId: z.string(),
      title: z.string().optional(),
      content: z.string().optional()
    },
    async ({ documentId, title, content }, context) => {
      console.log(`Action request: document.update from ${context.connectionId}`);
      
      // Check if document exists
      const doc = store.getDocument(documentId);
      
      if (!doc) {
        throw new Error(`Document not found: ${documentId}`);
      }
      
      // Update the document
      const updates: Partial<Document> = {};
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      
      const updatedDoc = store.updateDocument(documentId, updates);
      
      return {
        content: [{
          type: "text",
          text: `Document updated successfully. ID: ${documentId}`
        }]
      };
    }
  );
  
  // Summarize document action
  server.tool(
    "document.summarize",
    {
      documentId: z.string()
    },
    async ({ documentId }, context) => {
      console.log(`Action request: document.summarize from ${context.connectionId}`);
      
      // Check if document exists
      const doc = store.getDocument(documentId);
      
      if (!doc) {
        throw new Error(`Document not found: ${documentId}`);
      }
      
      // Generate a simple summary (in a real app, this would use an AI model)
      const sentences = doc.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      let summary = '';
      
      if (sentences.length > 2) {
        // Take first and last sentence
        summary = `${sentences[0].trim()}. ${sentences[sentences.length - 1].trim()}.`;
      } else {
        summary = doc.content;
      }
      
      return {
        content: [{
          type: "text",
          text: `Summary of "${doc.title}":\n\n${summary}`
        }]
      };
    }
  );
}

/**
 * Main function to run the server
 */
async function main() {
  try {
    // Start the server
    const server = await startServer();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down server...');
      await server.disconnect();
      console.log('Server shut down');
      process.exit(0);
    });
    
    console.log('Server is running. Press Ctrl+C to shut down.');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run the server
if (require.main === module) {
  main().catch(console.error);
}

// Export for testing
export { startServer, KnowledgeBaseStore };

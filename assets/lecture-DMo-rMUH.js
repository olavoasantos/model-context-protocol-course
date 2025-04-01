const n=`# Section 7: Real-world Applications

In this section, we'll explore practical applications of the Model Context Protocol (MCP) in real-world scenarios. We'll build three complete applications that demonstrate how MCP can be used to create powerful, context-aware systems.

## Building a Complete Chat Application with MCP

Chat applications are one of the most common use cases for MCP. Let's build a complete chat application that leverages MCP for context management.

### Architecture Overview

Our chat application will consist of several components:

1. **MCP Server**: Handles context management and provides tools
2. **Chat Backend**: Manages user sessions and message history
3. **Web Frontend**: Provides the user interface
4. **Database**: Stores conversation history and user data

Here's a high-level architecture diagram:

\`\`\`
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Web Frontend   │◄────┤  Chat Backend   │◄────┤   MCP Server    │
│  (React + TS)   │     │  (Node.js + TS) │     │  (TypeScript)   │
│                 │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐             │
         └─────────────►│                 │◄────────────┘
                        │    Database     │
                        │   (MongoDB)     │
                        │                 │
                        └─────────────────┘
\`\`\`

### Server Implementation

Let's start by implementing the MCP server:

\`\`\`typescript
// src/server/mcp-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { z } from "zod";
import { ChatDatabase } from "./database.js";
import { generateResponse } from "./ai-service.js";

export async function createMcpServer(port: number = 3001) {
  // Create the MCP server
  const server = new McpServer({
    name: "Chat Application Server",
    version: "1.0.0",
    description: "MCP server for the chat application"
  });
  
  // Initialize database
  const db = new ChatDatabase();
  await db.connect();
  
  // Add conversation history resource
  server.resource(
    "conversation-history",
    "chat://history/{conversationId}",
    async (uri, { conversationId }) => {
      // Fetch conversation history
      const messages = await db.getConversationMessages(conversationId);
      
      if (messages.length === 0) {
        return {
          contents: [{
            uri: uri.href,
            text: "No messages in this conversation yet."
          }]
        };
      }
      
      // Format messages
      const formattedHistory = messages.map(msg => 
        \`\${msg.sender}: \${msg.content}\`
      ).join("\\n\\n");
      
      return {
        contents: [{
          uri: uri.href,
          text: formattedHistory,
          metadata: {
            messageCount: messages.length,
            lastUpdated: new Date().toISOString()
          }
        }]
      };
    }
  );
  
  // Add user profile resource
  server.resource(
    "user-profile",
    "chat://user/{userId}",
    async (uri, { userId }) => {
      // Fetch user profile
      const user = await db.getUserProfile(userId);
      
      if (!user) {
        throw new Error(\`User not found: \${userId}\`);
      }
      
      return {
        contents: [{
          uri: uri.href,
          text: \`User: \${user.name}\\nPreferences: \${JSON.stringify(user.preferences)}\`,
          metadata: user
        }]
      };
    }
  );
  
  // Add chat response action
  server.tool(
    "chat.respond",
    {
      conversationId: z.string(),
      message: z.string(),
      userId: z.string()
    },
    async ({ conversationId, message, userId }) => {
      // Get user profile
      const user = await db.getUserProfile(userId);
      
      if (!user) {
        throw new Error(\`User not found: \${userId}\`);
      }
      
      // Get conversation history
      const history = await db.getConversationMessages(conversationId);
      
      // Generate response using AI service
      const response = await generateResponse(message, history, user);
      
      // Save the user message and response to the database
      await db.addMessage(conversationId, userId, message);
      await db.addMessage(conversationId, "assistant", response);
      
      return {
        content: [{ 
          type: "text", 
          text: response 
        }]
      };
    }
  );
  
  // Add conversation management actions
  server.tool(
    "conversation.create",
    {
      userId: z.string(),
      title: z.string().optional()
    },
    async ({ userId, title }) => {
      // Create a new conversation
      const conversationId = await db.createConversation(userId, title);
      
      return {
        content: [{ 
          type: "text", 
          text: \`Conversation created with ID: \${conversationId}\` 
        }]
      };
    }
  );
  
  server.tool(
    "conversation.list",
    {
      userId: z.string()
    },
    async ({ userId }) => {
      // List user's conversations
      const conversations = await db.getUserConversations(userId);
      
      if (conversations.length === 0) {
        return {
          content: [{ 
            type: "text", 
            text: "No conversations found." 
          }]
        };
      }
      
      // Format as a table
      return {
        content: [{
          type: "table",
          headers: ["ID", "Title", "Created", "Messages"],
          rows: conversations.map(conv => [
            conv.id,
            conv.title || "Untitled",
            new Date(conv.createdAt).toLocaleString(),
            String(conv.messageCount)
          ])
        }]
      };
    }
  );
  
  // Connect with HTTP transport
  const transport = new HttpServerTransport({
    port,
    cors: {
      origin: "*", // In production, restrict this to your frontend domain
      methods: ["GET", "POST"]
    }
  });
  
  console.log(\`Starting MCP server on port \${port}...\`);
  await server.connect(transport);
  console.log(\`MCP server running on port \${port}\`);
  
  return server;
}
\`\`\`

### Database Implementation

Next, let's implement the database layer:

\`\`\`typescript
// src/server/database.ts
import { MongoClient, Collection, ObjectId } from "mongodb";

export interface User {
  id: string;
  name: string;
  email: string;
  preferences: {
    theme: "light" | "dark";
    notifications: boolean;
    language: string;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  sender: string;
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

export class ChatDatabase {
  private client: MongoClient;
  private users: Collection<User>;
  private messages: Collection<Message>;
  private conversations: Collection<Conversation>;
  
  constructor(uri: string = "mongodb://localhost:27017/chat-app") {
    this.client = new MongoClient(uri);
  }
  
  async connect(): Promise<void> {
    await this.client.connect();
    const db = this.client.db();
    
    this.users = db.collection("users");
    this.messages = db.collection("messages");
    this.conversations = db.collection("conversations");
    
    // Create indexes
    await this.messages.createIndex({ conversationId: 1 });
    await this.conversations.createIndex({ userId: 1 });
  }
  
  async disconnect(): Promise<void> {
    await this.client.close();
  }
  
  async getUserProfile(userId: string): Promise<User | null> {
    return this.users.findOne({ id: userId });
  }
  
  async createUser(user: Omit<User, "id">): Promise<string> {
    const id = new ObjectId().toString();
    await this.users.insertOne({ ...user, id });
    return id;
  }
  
  async createConversation(userId: string, title?: string): Promise<string> {
    const id = new ObjectId().toString();
    const now = new Date();
    
    await this.conversations.insertOne({
      id,
      userId,
      title,
      createdAt: now,
      updatedAt: now,
      messageCount: 0
    });
    
    return id;
  }
  
  async getUserConversations(userId: string): Promise<Conversation[]> {
    return this.conversations.find({ userId }).sort({ updatedAt: -1 }).toArray();
  }
  
  async getConversationMessages(conversationId: string): Promise<Message[]> {
    return this.messages.find({ conversationId }).sort({ timestamp: 1 }).toArray();
  }
  
  async addMessage(conversationId: string, sender: string, content: string): Promise<string> {
    const id = new ObjectId().toString();
    const timestamp = new Date();
    
    await this.messages.insertOne({
      id,
      conversationId,
      sender,
      content,
      timestamp
    });
    
    // Update conversation
    await this.conversations.updateOne(
      { id: conversationId },
      { 
        $inc: { messageCount: 1 },
        $set: { updatedAt: timestamp }
      }
    );
    
    return id;
  }
}
\`\`\`

### AI Service Implementation

Now, let's implement the AI service that generates responses:

\`\`\`typescript
// src/server/ai-service.ts
import { Message, User } from "./database.js";
import { Configuration, OpenAIApi } from "openai";

// Initialize OpenAI client
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

export async function generateResponse(
  message: string,
  history: Message[],
  user: User
): Promise<string> {
  // Format conversation history for the AI
  const formattedHistory = history.map(msg => ({
    role: msg.sender === "assistant" ? "assistant" : "user",
    content: msg.content
  }));
  
  // Add the current message
  formattedHistory.push({
    role: "user",
    content: message
  });
  
  // Add user preferences to system message
  const systemMessage = {
    role: "system",
    content: \`You are a helpful assistant chatting with \${user.name}. \` +
             \`Their preferences: \${JSON.stringify(user.preferences)}. \` +
             \`Respond in their preferred language (\${user.preferences.language}).\`
  };
  
  try {
    // Generate response using OpenAI
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [systemMessage, ...formattedHistory],
      max_tokens: 1000,
      temperature: 0.7
    });
    
    return completion.data.choices[0].message?.content || "I'm not sure how to respond to that.";
  } catch (error) {
    console.error("Error generating response:", error);
    return "I'm having trouble generating a response right now. Please try again later.";
  }
}
\`\`\`

### Chat Backend Implementation

Next, let's implement the chat backend that connects the frontend to the MCP server:

\`\`\`typescript
// src/server/chat-backend.ts
import express from "express";
import cors from "cors";
import { createMcpServer } from "./mcp-server.js";
import { ChatDatabase } from "./database.js";
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";

async function startServer() {
  // Create Express app
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  // Initialize database
  const db = new ChatDatabase();
  await db.connect();
  
  // Start MCP server
  const mcpServer = await createMcpServer(3001);
  
  // Create MCP client
  const transport = new HttpClientTransport("http://localhost:3001");
  const mcpClient = new McpClient(transport);
  await mcpClient.connect();
  
  // API routes
  
  // User routes
  app.post("/api/users", async (req, res) => {
    try {
      const { name, email, preferences } = req.body;
      const userId = await db.createUser({ name, email, preferences });
      res.status(201).json({ userId });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/users/:userId", async (req, res) => {
    try {
      const user = await db.getUserProfile(req.params.userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Conversation routes
  app.post("/api/conversations", async (req, res) => {
    try {
      const { userId, title } = req.body;
      
      // Use MCP action to create conversation
      const result = await mcpClient.executeAction("conversation.create", {
        userId,
        title
      });
      
      // Extract conversation ID from response
      const response = result.content[0].text;
      const conversationId = response.match(/ID: ([a-f0-9]+)/i)?.[1];
      
      res.status(201).json({ conversationId });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/conversations", async (req, res) => {
    try {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      
      // Use MCP action to list conversations
      const result = await mcpClient.executeAction("conversation.list", {
        userId: String(userId)
      });
      
      // If the result is a table, convert it to JSON
      if (result.content[0].type === "table") {
        const { headers, rows } = result.content[0];
        
        const conversations = rows.map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header.toLowerCase()] = row[index];
          });
          return obj;
        });
        
        res.json(conversations);
      } else {
        // Text response means no conversations
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/conversations/:conversationId/messages", async (req, res) => {
    try {
      const { conversationId } = req.params;
      
      // Use MCP resource to get conversation history
      const resources = await mcpClient.fetchResource(\`chat://history/\${conversationId}\`);
      
      if (resources.length === 0) {
        return res.json([]);
      }
      
      // Parse the text into messages
      const text = resources[0].text;
      
      if (text === "No messages in this conversation yet.") {
        return res.json([]);
      }
      
      const messages = text.split("\\n\\n").map(msg => {
        const [sender, content] = msg.split(": ");
        return { sender, content };
      });
      
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Message routes
  app.post("/api/conversations/:conversationId/messages", async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { message, userId } = req.body;
      
      if (!message || !userId) {
        return res.status(400).json({ error: "message and userId are required" });
      }
      
      // Use MCP action to send message and get response
      const result = await mcpClient.executeAction("chat.respond", {
        conversationId,
        message,
        userId
      });
      
      const response = result.content[0].text;
      
      res.json({ response });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Start the server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(\`Chat backend running on port \${PORT}\`);
  });
}

startServer().catch(error => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
\`\`\`

### Frontend Implementation

Finally, let's implement the React frontend:

\`\`\`typescript
// src/client/components/Chat.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Message } from '../types';
import { fetchMessages, sendMessage } from '../api';
import './Chat.css';

interface ChatProps {
  userId: string;
}

export const Chat: React.FC<ChatProps> = ({ userId }) => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Load messages on mount and when conversationId changes
  useEffect(() => {
    if (!conversationId) {
      navigate('/conversations');
      return;
    }
    
    const loadMessages = async () => {
      try {
        const fetchedMessages = await fetchMessages(conversationId);
        setMessages(fetchedMessages);
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };
    
    loadMessages();
    
    // Poll for new messages every 3 seconds
    const interval = setInterval(loadMessages, 3000);
    
    return () => clearInterval(interval);
  }, [conversationId, navigate]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSend = async () => {
    if (!input.trim() || !conversationId) return;
    
    const userMessage = input.trim();
    setInput('');
    
    // Optimistically add user message
    setMessages(prev => [...prev, { sender: 'user', content: userMessage }]);
    
    setLoading(true);
    
    try {
      // Send message and get response
      const { response } = await sendMessage(conversationId, userMessage, userId);
      
      // Add assistant response
      setMessages(prev => [...prev, { sender: 'assistant', content: response }]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      setMessages(prev => [
        ...prev,
        { 
          sender: 'system', 
          content: 'Failed to send message. Please try again.' 
        }
      ]);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="chat-container">
      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message, index) => (
            <div 
              key={index} 
              className={\`message \${message.sender}-message\`}
            >
              <div className="message-content">{message.content}</div>
            </div>
          ))
        )}
        {loading && (
          <div className="message assistant-message loading">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
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
          disabled={loading}
        />
        <button 
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
};
\`\`\`

### API Client Implementation

Let's implement the API client for the frontend:

\`\`\`typescript
// src/client/api.ts
import { User, Conversation, Message } from './types';

const API_URL = 'http://localhost:3000/api';

// User API
export async function createUser(
  name: string,
  email: string,
  preferences: User['preferences']
): Promise<string> {
  const response = await fetch(\`\${API_URL}/users\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, email, preferences })
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to create user: \${response.statusText}\`);
  }
  
  const data = await response.json();
  return data.userId;
}

export async function getUser(userId: string): Promise<User> {
  const response = await fetch(\`\${API_URL}/users/\${userId}\`);
  
  if (!response.ok) {
    throw new Error(\`Failed to get user: \${response.statusText}\`);
  }
  
  return response.json();
}

// Conversation API
export async function createConversation(
  userId: string,
  title?: string
): Promise<string> {
  const response = await fetch(\`\${API_URL}/conversations\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userId, title })
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to create conversation: \${response.statusText}\`);
  }
  
  const data = await response.json();
  return data.conversationId;
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const response = await fetch(\`\${API_URL}/conversations?userId=\${userId}\`);
  
  if (!response.ok) {
    throw new Error(\`Failed to get conversations: \${response.statusText}\`);
  }
  
  return response.json();
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const response = await fetch(\`\${API_URL}/conversations/\${conversationId}/messages\`);
  
  if (!response.ok) {
    throw new Error(\`Failed to fetch messages: \${response.statusText}\`);
  }
  
  return response.json();
}

export async function sendMessage(
  conversationId: string,
  message: string,
  userId: string
): Promise<{ response: string }> {
  const response = await fetch(\`\${API_URL}/conversations/\${conversationId}/messages\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message, userId })
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to send message: \${response.statusText}\`);
  }
  
  return response.json();
}
\`\`\`

### Running the Application

To run the application, we need to set up the project structure and scripts:

\`\`\`json
// package.json
{
  "name": "mcp-chat-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build:server": "tsc -p tsconfig.server.json",
    "build:client": "vite build",
    "start:server": "node dist/server/chat-backend.js",
    "start:mcp": "node dist/server/mcp-server.js",
    "dev:server": "tsx watch src/server/chat-backend.ts",
    "dev:client": "vite",
    "dev": "concurrently \\"pnpm run dev:server\\" \\"pnpm run dev:client\\""
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "mongodb": "^5.0.0",
    "openai": "^3.2.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.1",
    "zod": "^3.20.6"
  },
  "devDependencies": {
    "@types/cors": "^2.8.13",
    "@types/express": "^4.17.17",
    "@types/node": "^18.14.0",
    "@types/react": "^18.0.28",
    "@types/react-dom": "^18.0.11",
    "@vitejs/plugin-react": "^3.1.0",
    "concurrently": "^7.6.0",
    "tsx": "^3.12.3",
    "typescript": "^4.9.5",
    "vite": "^4.1.4"
  }
}
\`\`\`

With this implementation, we have a complete chat application that uses MCP for context management. The application demonstrates how MCP can be used to create a more context-aware chat experience.

## Creating an AI Agent with MCP

Now, let's build an AI agent that uses MCP for context management. This agent will be able to perform tasks and maintain context across interactions.

### Agent Architecture

Our AI agent will have the following components:

1. **MCP Server**: Provides context and tools
2. **Agent Core**: Manages the agent's state and decision-making
3. **Tool Registry**: Registers and manages available tools
4. **Memory System**: Stores and retrieves information

Here's a high-level architecture:

\`\`\`
┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │
│   Agent Core    │◄────┤   MCP Server    │
│  (TypeScript)   │     │  (TypeScript)   │
│                 │     │                 │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │
│  Tool Registry  │     │  Memory System  │
│  (TypeScript)   │     │  (TypeScript)   │
│                 │     │                 │
└─────────────────┘     └─────────────────┘
\`\`\`

### Agent Core Implementation

Let's start by implementing the agent core:

\`\`\`typescript
// src/agent/agent-core.ts
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";
import { ToolRegistry } from "./tool-registry.js";
import { MemorySystem } from "./memory-system.js";
import { Configuration, OpenAIApi } from "openai";

// Initialize OpenAI client
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

export class AgentCore {
  private mcpClient: McpClient;
  private toolRegistry: ToolRegistry;
  private memorySystem: MemorySystem;
  
  constructor(
    mcpServerUrl: string = "http://localhost:3001"
  ) {
    // Create MCP client
    const transport = new HttpClientTransport(mcpServerUrl);
    this.mcpClient = new McpClient(transport);
    
    // Initialize components
    this.toolRegistry = new ToolRegistry();
    this.memorySystem = new MemorySystem();
  }
  
  async initialize(): Promise<void> {
    // Connect to MCP server
    await this.mcpClient.connect();
    
    // Register default tools
    this.registerDefaultTools();
  }
  
  private registerDefaultTools(): void {
    // Register built-in tools
    this.toolRegistry.registerTool("search", this.searchTool.bind(this));
    this.toolRegistry.registerTool("calculate", this.calculateTool.bind(this));
    this.toolRegistry.registerTool("remember", this.rememberTool.bind(this));
    this.toolRegistry.registerTool("recall", this.recallTool.bind(this));
  }
  
  async processInput(
    input: string,
    userId: string
  ): Promise<string> {
    try {
      // Fetch user context
      const userContext = await this.mcpClient.fetchResource(\`agent://user/\${userId}\`);
      
      // Fetch relevant memories
      const relevantMemories = await this.memorySystem.retrieveRelevantMemories(input, userId);
      
      // Build context for the AI
      const context = this.buildContext(userContext, relevantMemories);
      
      // Generate initial response
      const initialResponse = await this.generateResponse(input, context);
      
      // Check if we need to use tools
      const toolCalls = this.extractToolCalls(initialResponse);
      
      if (toolCalls.length > 0) {
        // Execute tool calls
        const toolResults = await this.executeToolCalls(toolCalls);
        
        // Generate final response with tool results
        const finalResponse = await this.generateResponseWithToolResults(
          input,
          context,
          toolCalls,
          toolResults
        );
        
        return finalResponse;
      }
      
      // Store the interaction in memory
      await this.memorySystem.storeMemory(userId, input, initialResponse);
      
      return initialResponse;
    } catch (error) {
      console.error("Error processing input:", error);
      return "I encountered an error while processing your request. Please try again.";
    }
  }
  
  private buildContext(
    userContext: any[],
    memories: any[]
  ): string {
    let context = "";
    
    // Add user context
    if (userContext.length > 0) {
      context += "User Context:\\n" + userContext[0].text + "\\n\\n";
    }
    
    // Add memories
    if (memories.length > 0) {
      context += "Relevant Memories:\\n";
      
      for (const memory of memories) {
        context += \`- \${memory.content}\\n\`;
      }
      
      context += "\\n";
    }
    
    return context;
  }
  
  private async generateResponse(
    input: string,
    context: string
  ): Promise<string> {
    const systemMessage = \`You are an AI assistant with access to the following tools:
- search: Search for information on the web
- calculate: Perform mathematical calculations
- remember: Store information in your memory
- recall: Retrieve information from your memory

When you need to use a tool, use the following format:
<tool>
name: tool_name
input: tool_input
</tool>

Here is context that may be relevant:
\${context}\`;
    
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: input }
      ],
      temperature: 0.7
    });
    
    return completion.data.choices[0].message?.content || "I'm not sure how to respond to that.";
  }
  
  private extractToolCalls(response: string): Array<{ name: string; input: string }> {
    const toolCallPattern = /<tool>\\s*name:\\s*([a-z_]+)\\s*input:\\s*([^<]+)\\s*<\\/tool>/g;
    const toolCalls = [];
    let match;
    
    while ((match = toolCallPattern.exec(response)) !== null) {
      toolCalls.push({
        name: match[1].trim(),
        input: match[2].trim()
      });
    }
    
    return toolCalls;
  }
  
  private async executeToolCalls(
    toolCalls: Array<{ name: string; input: string }>
  ): Promise<Array<{ name: string; result: string }>> {
    const results = [];
    
    for (const call of toolCalls) {
      try {
        const tool = this.toolRegistry.getTool(call.name);
        
        if (!tool) {
          results.push({
            name: call.name,
            result: \`Error: Tool '\${call.name}' not found\`
          });
          continue;
        }
        
        const result = await tool(call.input);
        
        results.push({
          name: call.name,
          result
        });
      } catch (error) {
        results.push({
          name: call.name,
          result: \`Error: \${error.message}\`
        });
      }
    }
    
    return results;
  }
  
  private async generateResponseWithToolResults(
    input: string,
    context: string,
    toolCalls: Array<{ name: string; input: string }>,
    toolResults: Array<{ name: string; result: string }>
  ): Promise<string> {
    const systemMessage = \`You are an AI assistant with access to the following tools:
- search: Search for information on the web
- calculate: Perform mathematical calculations
- remember: Store information in your memory
- recall: Retrieve information from your memory

Here is context that may be relevant:
\${context}\`;
    
    // Format tool calls and results
    let toolsContent = "I used the following tools to help answer your question:\\n\\n";
    
    for (let i = 0; i < toolCalls.length; i++) {
      const call = toolCalls[i];
      const result = toolResults[i];
      
      toolsContent += \`Tool: \${call.name}\\n\`;
      toolsContent += \`Input: \${call.input}\\n\`;
      toolsContent += \`Result: \${result.result}\\n\\n\`;
    }
    
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: input },
        { role: "assistant", content: toolsContent }
      ],
      temperature: 0.7
    });
    
    return completion.data.choices[0].message?.content || "I'm not sure how to respond to that.";
  }
  
  // Tool implementations
  
  private async searchTool(query: string): Promise<string> {
    try {
      // Use MCP action to perform search
      const result = await this.mcpClient.executeAction("search", { query });
      return result.content[0].text;
    } catch (error) {
      console.error("Search tool error:", error);
      return \`Error performing search: \${error.message}\`;
    }
  }
  
  private async calculateTool(expression: string): Promise<string> {
    try {
      // Use MCP action to perform calculation
      const result = await this.mcpClient.executeAction("calculate", { expression });
      return result.content[0].text;
    } catch (error) {
      console.error("Calculate tool error:", error);
      return \`Error performing calculation: \${error.message}\`;
    }
  }
  
  private async rememberTool(input: string): Promise<string> {
    try {
      // Parse input (format: "userId: content")
      const [userId, ...contentParts] = input.split(":");
      const content = contentParts.join(":").trim();
      
      if (!userId || !content) {
        return "Error: Invalid format. Use 'userId: content'";
      }
      
      // Store in memory
      await this.memorySystem.storeMemory(userId.trim(), "remember", content);
      
      return \`Successfully stored: "\${content}"\`;
    } catch (error) {
      console.error("Remember tool error:", error);
      return \`Error storing memory: \${error.message}\`;
    }
  }
  
  private async recallTool(input: string): Promise<string> {
    try {
      // Parse input (format: "userId: query")
      const [userId, ...queryParts] = input.split(":");
      const query = queryParts.join(":").trim();
      
      if (!userId || !query) {
        return "Error: Invalid format. Use 'userId: query'";
      }
      
      // Retrieve from memory
      const memories = await this.memorySystem.retrieveRelevantMemories(query, userId.trim());
      
      if (memories.length === 0) {
        return "No relevant memories found.";
      }
      
      // Format memories
      return memories.map(memory => 
        \`- \${memory.content}\`
      ).join("\\n");
    } catch (error) {
      console.error("Recall tool error:", error);
      return \`Error retrieving memories: \${error.message}\`;
    }
  }
}
\`\`\`

### Tool Registry Implementation

Next, let's implement the tool registry:

\`\`\`typescript
// src/agent/tool-registry.ts
export type ToolFunction = (input: string) => Promise<string>;

export class ToolRegistry {
  private tools: Map<string, ToolFunction> = new Map();
  
  registerTool(name: string, fn: ToolFunction): void {
    this.tools.set(name, fn);
  }
  
  getTool(name: string): ToolFunction | undefined {
    return this.tools.get(name);
  }
  
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }
  
  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }
}
\`\`\`

### Memory System Implementation

Now, let's implement the memory system:

\`\`\`typescript
// src/agent/memory-system.ts
import { MongoClient, Collection } from "mongodb";

interface Memory {
  userId: string;
  input: string;
  content: string;
  timestamp: Date;
  embedding?: number[];
}

export class MemorySystem {
  private client: MongoClient;
  private memories: Collection<Memory>;
  
  constructor(uri: string = "mongodb://localhost:27017/agent") {
    this.client = new MongoClient(uri);
  }
  
  async initialize(): Promise<void> {
    await this.client.connect();
    const db = this.client.db();
    
    this.memories = db.collection("memories");
    
    // Create indexes
    await this.memories.createIndex({ userId: 1 });
    await this.memories.createIndex({ timestamp: 1 });
  }
  
  async storeMemory(
    userId: string,
    input: string,
    content: string
  ): Promise<void> {
    // Create memory object
    const memory: Memory = {
      userId,
      input,
      content,
      timestamp: new Date()
    };
    
    // Store in database
    await this.memories.insertOne(memory);
  }
  
  async retrieveRelevantMemories(
    query: string,
    userId: string,
    limit: number = 5
  ): Promise<Memory[]> {
    // Simple keyword-based retrieval (in a real implementation, use embeddings)
    const keywords = this.extractKeywords(query);
    
    if (keywords.length === 0) {
      return [];
    }
    
    // Create regex pattern for each keyword
    const patterns = keywords.map(keyword => 
      new RegExp(keyword, "i")
    );
    
    // Query database
    const memories = await this.memories.find({
      userId,
      $or: [
        { input: { $in: patterns } },
        { content: { $in: patterns } }
      ]
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
    
    return memories;
  }
  
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction (remove stop words, etc.)
    const stopWords = new Set([
      "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "with",
      "about", "is", "are", "was", "were", "be", "been", "being", "have", "has",
      "had", "do", "does", "did", "i", "you", "he", "she", "it", "we", "they"
    ]);
    
    return text
      .toLowerCase()
      .replace(/[^\\w\\s]/g, "")
      .split(/\\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }
}
\`\`\`

### MCP Server Implementation

Let's implement the MCP server for the agent:

\`\`\`typescript
// src/agent/mcp-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { z } from "zod";

export async function createAgentMcpServer(port: number = 3001) {
  // Create the MCP server
  const server = new McpServer({
    name: "Agent MCP Server",
    version: "1.0.0",
    description: "MCP server for the AI agent"
  });
  
  // Add user context resource
  server.resource(
    "user-context",
    "agent://user/{userId}",
    async (uri, { userId }) => {
      // In a real implementation, fetch user data from a database
      const userData = {
        name: "Example User",
        preferences: {
          language: "English",
          topics: ["technology", "science", "history"]
        },
        lastInteraction: new Date().toISOString()
      };
      
      return {
        contents: [{
          uri: uri.href,
          text: \`User: \${userData.name}\\nPreferences: \${JSON.stringify(userData.preferences)}\`,
          metadata: userData
        }]
      };
    }
  );
  
  // Add search action
  server.tool(
    "search",
    {
      query: z.string()
    },
    async ({ query }) => {
      // In a real implementation, perform an actual search
      // This is a mock implementation
      return {
        content: [{ 
          type: "text", 
          text: \`Search results for "\${query}":\\n\\n\` +
                \`1. Example result 1\\n\` +
                \`2. Example result 2\\n\` +
                \`3. Example result 3\` 
        }]
      };
    }
  );
  
  // Add calculate action
  server.tool(
    "calculate",
    {
      expression: z.string()
    },
    async ({ expression }) => {
      try {
        // Simple calculator (unsafe in production)
        const result = eval(expression);
        
        return {
          content: [{ 
            type: "text", 
            text: \`\${expression} = \${result}\` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: \`Error calculating "\${expression}": \${error.message}\` 
          }]
        };
      }
    }
  );
  
  // Connect with HTTP transport
  const transport = new HttpServerTransport({
    port,
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  console.log(\`Starting Agent MCP server on port \${port}...\`);
  await server.connect(transport);
  console.log(\`Agent MCP server running on port \${port}\`);
  
  return server;
}
\`\`\`

### Agent CLI Interface

Let's create a simple CLI interface for the agent:

\`\`\`typescript
// src/agent/cli.ts
import readline from "readline";
import { AgentCore } from "./agent-core.js";
import { createAgentMcpServer } from "./mcp-server.js";

async function main() {
  try {
    // Start MCP server
    const mcpServer = await createAgentMcpServer(3001);
    
    // Create agent
    const agent = new AgentCore("http://localhost:3001");
    await agent.initialize();
    
    console.log("AI Agent initialized. Type 'exit' to quit.");
    console.log("Format your messages as 'userId: your message'");
    
    // Create readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Start interaction loop
    rl.setPrompt("You: ");
    rl.prompt();
    
    rl.on("line", async (input) => {
      if (input.toLowerCase() === "exit") {
        rl.close();
        process.exit(0);
      }
      
      // Parse input (format: "userId: message")
      const colonIndex = input.indexOf(":");
      
      if (colonIndex === -1) {
        console.log("Invalid format. Use 'userId: your message'");
        rl.prompt();
        return;
      }
      
      const userId = input.substring(0, colonIndex).trim();
      const message = input.substring(colonIndex + 1).trim();
      
      if (!userId || !message) {
        console.log("Invalid format. Use 'userId: your message'");
        rl.prompt();
        return;
      }
      
      try {
        console.log("Agent is thinking...");
        
        // Process the input
        const response = await agent.processInput(message, userId);
        
        console.log("\\nAgent:", response);
      } catch (error) {
        console.error("Error:", error);
      }
      
      rl.prompt();
    });
    
    rl.on("close", () => {
      console.log("Goodbye!");
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    process.exit(1);
  }
}

main();
\`\`\`

### Running the Agent

To run the agent, we need to set up the project structure and scripts:

\`\`\`json
// package.json
{
  "name": "mcp-agent",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/agent/cli.js",
    "dev": "tsx src/agent/cli.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "mongodb": "^5.0.0",
    "openai": "^3.2.1",
    "zod": "^3.20.6"
  },
  "devDependencies": {
    "@types/node": "^18.14.0",
    "tsx": "^3.12.3",
    "typescript": "^4.9.5"
  }
}
\`\`\`

With this implementation, we have an AI agent that uses MCP for context management and tool execution. The agent demonstrates how MCP can be used to create more capable AI systems.

## Implementing a Shared Todo List with MCP

Finally, let's build a shared todo list application using MCP. This application will demonstrate how MCP can be used for real-time collaboration.

### Architecture Overview

Our todo list application will have the following components:

1. **MCP Server**: Manages todo items and provides real-time updates
2. **Web Frontend**: Provides the user interface
3. **Database**: Stores todo items

Here's a high-level architecture:

\`\`\`
┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │
│  Web Frontend   │◄────┤   MCP Server    │
│  (React + TS)   │     │  (TypeScript)   │
│                 │     │                 │
└─────────────────┘     └────────┬────────┘
                                 │
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │    Database     │
                        │   (MongoDB)     │
                        │                 │
                        └─────────────────┘
\`\`\`

### MCP Server Implementation

Let's start by implementing the MCP server:

\`\`\`typescript
// src/server/todo-mcp-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { z } from "zod";
import { TodoDatabase } from "./todo-database.js";

// Active streams for real-time updates
const activeStreams = new Map<string, any>();

export async function createTodoMcpServer(port: number = 3001) {
  // Create the MCP server
  const server = new McpServer({
    name: "Todo List Server",
    version: "1.0.0",
    description: "MCP server for the shared todo list application"
  });
  
  // Initialize database
  const db = new TodoDatabase();
  await db.connect();
  
  // Add todo list resource
  server.resource(
    "todo-list",
    "todo://list/{listId}",
    async (uri, { listId }) => {
      // Fetch todo list
      const list = await db.getTodoList(listId);
      
      if (!list) {
        throw new Error(\`Todo list not found: \${listId}\`);
      }
      
      // Fetch todo items
      const items = await db.getTodoItems(listId);
      
      // Format as text
      const formattedItems = items.map(item => 
        \`- [\${item.completed ? "x" : " "}] \${item.text}\`
      ).join("\\n");
      
      const text = \`# \${list.title}\\n\\n\${formattedItems || "No items yet."}\`;
      
      return {
        contents: [{
          uri: uri.href,
          text,
          metadata: {
            list,
            items
          }
        }]
      };
    }
  );
  
  // Add streaming todo list updates
  server.streamingResource(
    "todo-list-updates",
    "todo://updates/{listId}",
    async (uri, { listId }, stream) => {
      // Fetch initial state
      const list = await db.getTodoList(listId);
      
      if (!list) {
        throw new Error(\`Todo list not found: \${listId}\`);
      }
      
      const items = await db.getTodoItems(listId);
      
      // Send initial state
      await stream.send([{
        uri: \`todo://list/\${listId}\`,
        text: \`# \${list.title}\\n\\n\${items.map(item => 
          \`- [\${item.completed ? "x" : " "}] \${item.text}\`
        ).join("\\n") || "No items yet."}\`,
        metadata: {
          list,
          items,
          type: "initial"
        }
      }]);
      
      // Store the stream for updates
      activeStreams.set(listId, stream);
      
      // Clean up when the stream is closed
      stream.onClose(() => {
        activeStreams.delete(listId);
      });
    }
  );
  
  // Add todo list management actions
  server.tool(
    "todo.createList",
    {
      title: z.string(),
      userId: z.string()
    },
    async ({ title, userId }) => {
      // Create a new todo list
      const listId = await db.createTodoList(title, userId);
      
      return {
        content: [{ 
          type: "text", 
          text: \`Todo list created with ID: \${listId}\` 
        }]
      };
    }
  );
  
  server.tool(
    "todo.addItem",
    {
      listId: z.string(),
      text: z.string(),
      userId: z.string()
    },
    async ({ listId, text, userId }) => {
      // Add a new todo item
      const itemId = await db.addTodoItem(listId, text, userId);
      
      // Send update to active streams
      await sendListUpdate(listId, "item_added", { itemId, text });
      
      return {
        content: [{ 
          type: "text", 
          text: \`Todo item added with ID: \${itemId}\` 
        }]
      };
    }
  );
  
  server.tool(
    "todo.toggleItem",
    {
      listId: z.string(),
      itemId: z.string(),
      userId: z.string()
    },
    async ({ listId, itemId, userId }) => {
      // Toggle todo item completion
      const completed = await db.toggleTodoItem(listId, itemId, userId);
      
      // Send update to active streams
      await sendListUpdate(listId, "item_toggled", { itemId, completed });
      
      return {
        content: [{ 
          type: "text", 
          text: \`Todo item \${completed ? "completed" : "uncompleted"}\` 
        }]
      };
    }
  );
  
  server.tool(
    "todo.deleteItem",
    {
      listId: z.string(),
      itemId: z.string(),
      userId: z.string()
    },
    async ({ listId, itemId, userId }) => {
      // Delete todo item
      await db.deleteTodoItem(listId, itemId, userId);
      
      // Send update to active streams
      await sendListUpdate(listId, "item_deleted", { itemId });
      
      return {
        content: [{ 
          type: "text", 
          text: \`Todo item deleted\` 
        }]
      };
    }
  );
  
  server.tool(
    "todo.getUserLists",
    {
      userId: z.string()
    },
    async ({ userId }) => {
      // Get user's todo lists
      const lists = await db.getUserTodoLists(userId);
      
      if (lists.length === 0) {
        return {
          content: [{ 
            type: "text", 
            text: "No todo lists found." 
          }]
        };
      }
      
      // Format as a table
      return {
        content: [{
          type: "table",
          headers: ["ID", "Title", "Created", "Items"],
          rows: lists.map(list => [
            list.id,
            list.title,
            new Date(list.createdAt).toLocaleString(),
            String(list.itemCount)
          ])
        }]
      };
    }
  );
  
  // Helper function to send updates to active streams
  async function sendListUpdate(
    listId: string,
    updateType: string,
    data: any
  ): Promise<void> {
    const stream = activeStreams.get(listId);
    
    if (!stream) {
      return;
    }
    
    // Fetch updated list and items
    const list = await db.getTodoList(listId);
    const items = await db.getTodoItems(listId);
    
    // Send update
    await stream.send([{
      uri: \`todo://list/\${listId}/update\`,
      text: \`# \${list.title}\\n\\n\${items.map(item => 
        \`- [\${item.completed ? "x" : " "}] \${item.text}\`
      ).join("\\n") || "No items yet."}\`,
      metadata: {
        list,
        items,
        type: "update",
        updateType,
        data
      }
    }]);
  }
  
  // Connect with HTTP transport
  const transport = new HttpServerTransport({
    port,
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  console.log(\`Starting Todo MCP server on port \${port}...\`);
  await server.connect(transport);
  console.log(\`Todo MCP server running on port \${port}\`);
  
  return server;
}
\`\`\`

### Database Implementation

Next, let's implement the database layer:

\`\`\`typescript
// src/server/todo-database.ts
import { MongoClient, Collection, ObjectId } from "mongodb";

export interface TodoList {
  id: string;
  title: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  itemCount: number;
}

export interface TodoItem {
  id: string;
  listId: string;
  text: string;
  completed: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class TodoDatabase {
  private client: MongoClient;
  private lists: Collection<TodoList>;
  private items: Collection<TodoItem>;
  
  constructor(uri: string = "mongodb://localhost:27017/todo-app") {
    this.client = new MongoClient(uri);
  }
  
  async connect(): Promise<void> {
    await this.client.connect();
    const db = this.client.db();
    
    this.lists = db.collection("todo-lists");
    this.items = db.collection("todo-items");
    
    // Create indexes
    await this.lists.createIndex({ userId: 1 });
    await this.items.createIndex({ listId: 1 });
  }
  
  async disconnect(): Promise<void> {
    await this.client.close();
  }
  
  async createTodoList(title: string, userId: string): Promise<string> {
    const id = new ObjectId().toString();
    const now = new Date();
    
    await this.lists.insertOne({
      id,
      title,
      userId,
      createdAt: now,
      updatedAt: now,
      itemCount: 0
    });
    
    return id;
  }
  
  async getTodoList(listId: string): Promise<TodoList | null> {
    return this.lists.findOne({ id: listId });
  }
  
  async getUserTodoLists(userId: string): Promise<TodoList[]> {
    return this.lists.find({ userId }).sort({ updatedAt: -1 }).toArray();
  }
  
  async addTodoItem(listId: string, text: string, userId: string): Promise<string> {
    const id = new ObjectId().toString();
    const now = new Date();
    
    await this.items.insertOne({
      id,
      listId,
      text,
      completed: false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now
    });
    
    // Update list
    await this.lists.updateOne(
      { id: listId },
      { 
        $inc: { itemCount: 1 },
        $set: { updatedAt: now }
      }
    );
    
    return id;
  }
  
  async getTodoItems(listId: string): Promise<TodoItem[]> {
    return this.items.find({ listId }).sort({ createdAt: 1 }).toArray();
  }
  
  async toggleTodoItem(listId: string, itemId: string, userId: string): Promise<boolean> {
    const item = await this.items.findOne({ id: itemId, listId });
    
    if (!item) {
      throw new Error(\`Todo item not found: \${itemId}\`);
    }
    
    const completed = !item.completed;
    const now = new Date();
    
    await this.items.updateOne(
      { id: itemId },
      { 
        $set: { 
          completed,
          updatedAt: now
        }
      }
    );
    
    // Update list
    await this.lists.updateOne(
      { id: listId },
      { $set: { updatedAt: now } }
    );
    
    return completed;
  }
  
  async deleteTodoItem(listId: string, itemId: string, userId: string): Promise<void> {
    const item = await this.items.findOne({ id: itemId, listId });
    
    if (!item) {
      throw new Error(\`Todo item not found: \${itemId}\`);
    }
    
    await this.items.deleteOne({ id: itemId });
    
    // Update list
    await this.lists.updateOne(
      { id: listId },
      { 
        $inc: { itemCount: -1 },
        $set: { updatedAt: new Date() }
      }
    );
  }
}
\`\`\`

### Frontend Implementation

Now, let's implement the React frontend:

\`\`\`typescript
// src/client/components/TodoApp.tsx
import React, { useState, useEffect } from 'react';
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";
import './TodoApp.css';

interface TodoList {
  id: string;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

interface TodoItem {
  id: string;
  listId: string;
  text: string;
  completed: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const TodoApp: React.FC = () => {
  const [mcpClient, setMcpClient] = useState<McpClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [userId, setUserId] = useState('user1'); // Simplified user management
  const [lists, setLists] = useState<TodoList[]>([]);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [newListTitle, setNewListTitle] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Connect to MCP server on mount
  useEffect(() => {
    const connectToServer = async () => {
      try {
        const transport = new HttpClientTransport('http://localhost:3001');
        const client = new McpClient(transport);
        
        await client.connect();
        setMcpClient(client);
        setConnected(true);
        
        // Load user's lists
        await loadUserLists(client);
      } catch (error) {
        console.error('Failed to connect:', error);
        setError('Failed to connect to the server. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    connectToServer();
    
    // Cleanup on unmount
    return () => {
      if (mcpClient) {
        mcpClient.disconnect().catch(console.error);
      }
    };
  }, []);
  
  // Load user's todo lists
  const loadUserLists = async (client: McpClient) => {
    try {
      const result = await client.executeAction('todo.getUserLists', {
        userId
      });
      
      // If the result is a table, convert it to lists
      if (result.content[0].type === 'table') {
        const { headers, rows } = result.content[0];
        
        const lists = rows.map(row => {
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header.toLowerCase()] = row[index];
          });
          return obj as TodoList;
        });
        
        setLists(lists);
        
        // Select the first list if available
        if (lists.length > 0 && !selectedList) {
          setSelectedList(lists[0].id);
        }
      } else {
        // Text response means no lists
        setLists([]);
      }
    } catch (error) {
      console.error('Failed to load lists:', error);
      setError('Failed to load your todo lists.');
    }
  };
  
  // Load todo items for a list
  const loadTodoItems = async (listId: string) => {
    if (!mcpClient) return;
    
    try {
      // Use streaming resource for real-time updates
      const stream = await mcpClient.streamResource(\`todo://updates/\${listId}\`);
      
      stream.onMessage(resources => {
        if (resources.length === 0) return;
        
        const resource = resources[0];
        const metadata = resource.metadata as any;
        
        if (metadata && metadata.items) {
          setItems(metadata.items);
        }
      });
      
      return () => {
        stream.close();
      };
    } catch (error) {
      console.error('Failed to load items:', error);
      setError('Failed to load todo items.');
    }
  };
  
  // Effect to load items when selected list changes
  useEffect(() => {
    if (!selectedList) return;
    
    const cleanup = loadTodoItems(selectedList);
    
    return () => {
      cleanup?.then(fn => fn());
    };
  }, [selectedList, mcpClient]);
  
  // Create a new todo list
  const createList = async () => {
    if (!mcpClient || !newListTitle.trim()) return;
    
    try {
      await mcpClient.executeAction('todo.createList', {
        title: newListTitle.trim(),
        userId
      });
      
      setNewListTitle('');
      await loadUserLists(mcpClient);
    } catch (error) {
      console.error('Failed to create list:', error);
      setError('Failed to create todo list.');
    }
  };
  
  // Add a new todo item
  const addItem = async () => {
    if (!mcpClient || !selectedList || !newItemText.trim()) return;
    
    try {
      await mcpClient.executeAction('todo.addItem', {
        listId: selectedList,
        text: newItemText.trim(),
        userId
      });
      
      setNewItemText('');
    } catch (error) {
      console.error('Failed to add item:', error);
      setError('Failed to add todo item.');
    }
  };
  
  // Toggle a todo item
  const toggleItem = async (itemId: string) => {
    if (!mcpClient || !selectedList) return;
    
    try {
      await mcpClient.executeAction('todo.toggleItem', {
        listId: selectedList,
        itemId,
        userId
      });
    } catch (error) {
      console.error('Failed to toggle item:', error);
      setError('Failed to update todo item.');
    }
  };
  
  // Delete a todo item
  const deleteItem = async (itemId: string) => {
    if (!mcpClient || !selectedList) return;
    
    try {
      await mcpClient.executeAction('todo.deleteItem', {
        listId: selectedList,
        itemId,
        userId
      });
    } catch (error) {
      console.error('Failed to delete item:', error);
      setError('Failed to delete todo item.');
    }
  };
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  if (error) {
    return <div className="error">{error}</div>;
  }
  
  return (
    <div className="todo-app">
      <header>
        <h1>Shared Todo Lists</h1>
        <div className="user-info">
          User: {userId}
        </div>
      </header>
      
      <div className="app-container">
        <div className="lists-sidebar">
          <h2>Your Lists</h2>
          
          <div className="new-list-form">
            <input
              type="text"
              value={newListTitle}
              onChange={e => setNewListTitle(e.target.value)}
              placeholder="New list title"
            />
            <button onClick={createList}>Create</button>
          </div>
          
          <ul className="lists">
            {lists.length === 0 ? (
              <li className="empty-state">No lists yet</li>
            ) : (
              lists.map(list => (
                <li
                  key={list.id}
                  className={selectedList === list.id ? 'selected' : ''}
                  onClick={() => setSelectedList(list.id)}
                >
                  {list.title}
                  <span className="item-count">{list.itemCount}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        
        <div className="items-container">
          {selectedList ? (
            <>
              <h2>
                {lists.find(list => list.id === selectedList)?.title || 'Todo Items'}
              </h2>
              
              <div className="new-item-form">
                <input
                  type="text"
                  value={newItemText}
                  onChange={e => setNewItemText(e.target.value)}
                  placeholder="New todo item"
                  onKeyPress={e => e.key === 'Enter' && addItem()}
                />
                <button onClick={addItem}>Add</button>
              </div>
              
              <ul className="items">
                {items.length === 0 ? (
                  <li className="empty-state">No items yet</li>
                ) : (
                  items.map(item => (
                    <li key={item.id} className={item.completed ? 'completed' : ''}>
                      <label>
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => toggleItem(item.id)}
                        />
                        <span className="item-text">{item.text}</span>
                      </label>
                      <button
                        className="delete-button"
                        onClick={() => deleteItem(item.id)}
                      >
                        ×
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          ) : (
            <div className="empty-state">
              Select a list or create a new one
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
\`\`\`

### Running the Application

To run the application, we need to set up the project structure and scripts:

\`\`\`json
// package.json
{
  "name": "mcp-todo-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build:server": "tsc -p tsconfig.server.json",
    "build:client": "vite build",
    "start:server": "node dist/server/todo-mcp-server.js",
    "dev:server": "tsx watch src/server/todo-mcp-server.ts",
    "dev:client": "vite",
    "dev": "concurrently \\"pnpm run dev:server\\" \\"pnpm run dev:client\\""
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "mongodb": "^5.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.1",
    "zod": "^3.20.6"
  },
  "devDependencies": {
    "@types/cors": "^2.8.13",
    "@types/express": "^4.17.17",
    "@types/node": "^18.14.0",
    "@types/react": "^18.0.28",
    "@types/react-dom": "^18.0.11",
    "@vitejs/plugin-react": "^3.1.0",
    "concurrently": "^7.6.0",
    "tsx": "^3.12.3",
    "typescript": "^4.9.5",
    "vite": "^4.1.4"
  }
}
\`\`\`

With this implementation, we have a shared todo list application that uses MCP for real-time updates. The application demonstrates how MCP can be used for collaborative applications.

## Summary

In this section, we've explored three real-world applications of MCP:

1. **Chat Application**: We built a complete chat application that uses MCP for context management, demonstrating how MCP can enhance conversational AI systems.

2. **AI Agent**: We created an AI agent that uses MCP for context management and tool execution, showing how MCP can be used to build more capable AI systems.

3. **Shared Todo List**: We implemented a shared todo list application that uses MCP for real-time updates, illustrating how MCP can be used for collaborative applications.

These examples demonstrate the versatility of MCP and how it can be applied to various domains. By leveraging MCP's context management capabilities, you can build more intelligent and responsive applications.

In the next section, we'll explore testing and debugging techniques for MCP applications.
`;export{n as default};

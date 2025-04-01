/**
 * Real-world Applications with MCP
 * 
 * This example demonstrates building a complete chat application with MCP,
 * including both client and server components.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";
import { z } from "zod";
import * as crypto from "crypto";

// Define the port for our MCP server
const PORT = 3000;

/**
 * Chat Message interface
 */
interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: string;
}

/**
 * Chat Room interface
 */
interface ChatRoom {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  messages: ChatMessage[];
}

/**
 * User interface
 */
interface User {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
}

/**
 * Chat Database
 * 
 * A simple in-memory database for the chat application
 */
class ChatDatabase {
  private users: Map<string, User> = new Map();
  private rooms: Map<string, ChatRoom> = new Map();
  private messageListeners: Map<string, Set<(message: ChatMessage) => void>> = new Map();
  
  constructor() {
    // Initialize with some sample data
    this.addUser({
      id: "user1",
      username: "alice",
      displayName: "Alice",
      createdAt: new Date().toISOString()
    });
    
    this.addUser({
      id: "user2",
      username: "bob",
      displayName: "Bob",
      createdAt: new Date().toISOString()
    });
    
    this.createRoom("user1", "general", "General discussion");
    this.createRoom("user1", "mcp", "MCP discussion");
  }
  
  // User methods
  addUser(user: User): void {
    this.users.set(user.id, user);
  }
  
  getUser(id: string): User | undefined {
    return this.users.get(id);
  }
  
  getUserByUsername(username: string): User | undefined {
    return Array.from(this.users.values()).find(user => user.username === username);
  }
  
  // Room methods
  createRoom(userId: string, name: string, description: string): ChatRoom {
    const id = `room_${crypto.randomBytes(8).toString("hex")}`;
    const room: ChatRoom = {
      id,
      name,
      description,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      messages: []
    };
    
    this.rooms.set(id, room);
    return room;
  }
  
  getRoom(id: string): ChatRoom | undefined {
    return this.rooms.get(id);
  }
  
  getAllRooms(): ChatRoom[] {
    return Array.from(this.rooms.values());
  }
  
  // Message methods
  addMessage(roomId: string, userId: string, content: string): ChatMessage | undefined {
    const room = this.rooms.get(roomId);
    const user = this.users.get(userId);
    
    if (!room || !user) {
      return undefined;
    }
    
    const message: ChatMessage = {
      id: `msg_${crypto.randomBytes(8).toString("hex")}`,
      roomId,
      userId,
      username: user.username,
      content,
      timestamp: new Date().toISOString()
    };
    
    room.messages.push(message);
    
    // Notify listeners
    this.notifyMessageListeners(roomId, message);
    
    return message;
  }
  
  getMessages(roomId: string, limit: number = 50): ChatMessage[] {
    const room = this.rooms.get(roomId);
    if (!room) {
      return [];
    }
    
    // Return the most recent messages
    return [...room.messages].reverse().slice(0, limit).reverse();
  }
  
  // Message listeners for real-time updates
  addMessageListener(roomId: string, listener: (message: ChatMessage) => void): () => void {
    if (!this.messageListeners.has(roomId)) {
      this.messageListeners.set(roomId, new Set());
    }
    
    this.messageListeners.get(roomId)?.add(listener);
    
    // Return a function to remove the listener
    return () => {
      this.messageListeners.get(roomId)?.delete(listener);
    };
  }
  
  private notifyMessageListeners(roomId: string, message: ChatMessage): void {
    const listeners = this.messageListeners.get(roomId);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(message);
        } catch (error) {
          console.error("Error in message listener:", error);
        }
      });
    }
  }
}

/**
 * Start the Chat MCP Server
 */
async function startChatServer() {
  // Create the database
  const db = new ChatDatabase();
  
  // Create a new MCP server
  const server = new McpServer({
    name: "Chat MCP Server",
    version: "1.0.0"
  });

  // Register resource handlers
  
  // User resource
  server.resource(
    "user",
    "user://{userId}",
    async (uri, { userId }) => {
      console.log(`Server: Received request for user: ${userId}`);
      
      const user = db.getUser(userId);
      
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }
      
      return {
        contents: [{
          uri: uri.href,
          text: `# ${user.displayName}\n\nUsername: @${user.username}`,
          metadata: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            createdAt: user.createdAt
          }
        }]
      };
    }
  );
  
  // Room resource
  server.resource(
    "room",
    "room://{roomId}",
    async (uri, { roomId }) => {
      console.log(`Server: Received request for room: ${roomId}`);
      
      const room = db.getRoom(roomId);
      
      if (!room) {
        throw new Error(`Room not found: ${roomId}`);
      }
      
      // Get recent messages
      const messages = db.getMessages(roomId, 10);
      
      // Format messages as text
      const messagesText = messages.map(msg => {
        return `**${msg.username}**: ${msg.content}`;
      }).join('\n\n');
      
      return {
        contents: [{
          uri: uri.href,
          text: `# ${room.name}\n\n${room.description}\n\n## Recent Messages\n\n${messagesText || "No messages yet."}`,
          metadata: {
            id: room.id,
            name: room.name,
            description: room.description,
            createdBy: room.createdBy,
            createdAt: room.createdAt,
            messageCount: room.messages.length
          }
        }]
      };
    }
  );
  
  // Rooms list resource
  server.resource(
    "rooms",
    "rooms://list",
    async (uri) => {
      console.log(`Server: Received request for rooms list`);
      
      const rooms = db.getAllRooms();
      
      // Format rooms as text
      const roomsText = rooms.map(room => {
        return `- **${room.name}**: ${room.description} (${room.messages.length} messages)`;
      }).join('\n');
      
      return {
        contents: [{
          uri: uri.href,
          text: `# Available Chat Rooms\n\n${roomsText}`,
          metadata: {
            count: rooms.length
          }
        }]
      };
    }
  );
  
  // Messages resource
  server.resource(
    "messages",
    "messages://{roomId}",
    async (uri, { roomId }) => {
      console.log(`Server: Received request for messages in room: ${roomId}`);
      
      const room = db.getRoom(roomId);
      
      if (!room) {
        throw new Error(`Room not found: ${roomId}`);
      }
      
      // Get messages
      const messages = db.getMessages(roomId, 50);
      
      // Return messages as separate content blocks
      return {
        contents: messages.map(msg => ({
          uri: `message://${msg.id}`,
          text: msg.content,
          metadata: {
            id: msg.id,
            roomId: msg.roomId,
            userId: msg.userId,
            username: msg.username,
            timestamp: msg.timestamp
          }
        }))
      };
    }
  );

  // Register action handlers
  
  // Login action
  server.tool(
    "auth.login",
    {
      username: z.string(),
      password: z.string() // In a real app, use proper authentication
    },
    async ({ username, password }, context) => {
      console.log(`Server: Login attempt for user: ${username}`);
      
      // In a real app, validate credentials properly
      // For this example, we'll accept any password and look up the user
      const user = db.getUserByUsername(username);
      
      if (!user) {
        throw new Error(`Invalid username or password`);
      }
      
      return {
        content: [{
          type: "text",
          text: `Logged in as ${user.displayName}`
        }],
        metadata: {
          userId: user.id,
          username: user.username,
          displayName: user.displayName
        }
      };
    }
  );
  
  // Send message action
  server.tool(
    "chat.sendMessage",
    {
      roomId: z.string(),
      userId: z.string(),
      content: z.string()
    },
    async ({ roomId, userId, content }) => {
      console.log(`Server: Send message to room ${roomId} from user ${userId}`);
      
      const message = db.addMessage(roomId, userId, content);
      
      if (!message) {
        throw new Error(`Failed to send message`);
      }
      
      return {
        content: [{
          type: "text",
          text: `Message sent successfully`
        }],
        metadata: {
          messageId: message.id,
          timestamp: message.timestamp
        }
      };
    }
  );
  
  // Create room action
  server.tool(
    "chat.createRoom",
    {
      userId: z.string(),
      name: z.string(),
      description: z.string()
    },
    async ({ userId, name, description }) => {
      console.log(`Server: Create room "${name}" by user ${userId}`);
      
      const room = db.createRoom(userId, name, description);
      
      return {
        content: [{
          type: "text",
          text: `Room "${name}" created successfully`
        }],
        metadata: {
          roomId: room.id,
          name: room.name,
          description: room.description
        }
      };
    }
  );

  // Create an HTTP transport for the server
  const transport = new HttpServerTransport({ port: PORT });
  
  // Connect the server to the transport
  await server.connect(transport);
  
  console.log(`Chat MCP server running on port ${PORT}`);
  
  return server;
}

/**
 * Chat Client
 * 
 * A client for the chat application
 */
class ChatClient {
  private client: McpClient;
  private currentUser: User | null = null;
  private messageCallbacks: Map<string, Set<(message: ChatMessage) => void>> = new Map();
  
  constructor(serverUrl: string) {
    const transport = new HttpClientTransport(serverUrl);
    this.client = new McpClient(transport);
  }
  
  /**
   * Connect to the server
   */
  async connect(): Promise<void> {
    await this.client.connect();
    console.log("Connected to chat server");
  }
  
  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    await this.client.disconnect();
    console.log("Disconnected from chat server");
  }
  
  /**
   * Login to the chat server
   */
  async login(username: string, password: string): Promise<User> {
    const result = await this.client.executeAction("auth.login", {
      username,
      password
    });
    
    this.currentUser = {
      id: result.metadata.userId,
      username: result.metadata.username,
      displayName: result.metadata.displayName,
      createdAt: new Date().toISOString()
    };
    
    console.log(`Logged in as ${this.currentUser.displayName}`);
    return this.currentUser;
  }
  
  /**
   * Get the current user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }
  
  /**
   * Get a list of available rooms
   */
  async getRooms(): Promise<any[]> {
    const resources = await this.client.fetchResource("rooms://list");
    return resources;
  }
  
  /**
   * Get details about a specific room
   */
  async getRoom(roomId: string): Promise<any> {
    const resources = await this.client.fetchResource(`room://${roomId}`);
    return resources[0];
  }
  
  /**
   * Get messages in a room
   */
  async getMessages(roomId: string): Promise<any[]> {
    const resources = await this.client.fetchResource(`messages://${roomId}`);
    return resources;
  }
  
  /**
   * Send a message to a room
   */
  async sendMessage(roomId: string, content: string): Promise<any> {
    if (!this.currentUser) {
      throw new Error("Not logged in");
    }
    
    const result = await this.client.executeAction("chat.sendMessage", {
      roomId,
      userId: this.currentUser.id,
      content
    });
    
    return result;
  }
  
  /**
   * Create a new room
   */
  async createRoom(name: string, description: string): Promise<any> {
    if (!this.currentUser) {
      throw new Error("Not logged in");
    }
    
    const result = await this.client.executeAction("chat.createRoom", {
      userId: this.currentUser.id,
      name,
      description
    });
    
    return result;
  }
  
  /**
   * Start polling for new messages in a room
   */
  startMessagePolling(roomId: string, callback: (message: ChatMessage) => void): () => void {
    // Add callback to the set for this room
    if (!this.messageCallbacks.has(roomId)) {
      this.messageCallbacks.set(roomId, new Set());
      
      // Start polling
      this.pollMessages(roomId);
    }
    
    this.messageCallbacks.get(roomId)?.add(callback);
    
    // Return a function to stop receiving updates
    return () => {
      const callbacks = this.messageCallbacks.get(roomId);
      if (callbacks) {
        callbacks.delete(callback);
        
        if (callbacks.size === 0) {
          this.messageCallbacks.delete(roomId);
        }
      }
    };
  }
  
  /**
   * Poll for new messages
   */
  private async pollMessages(roomId: string): Promise<void> {
    let lastMessageTimestamp = new Date(0).toISOString();
    
    const poll = async () => {
      try {
        // Only continue polling if we have callbacks for this room
        if (!this.messageCallbacks.has(roomId)) {
          return;
        }
        
        // Get messages
        const messages = await this.getMessages(roomId);
        
        // Find new messages
        const newMessages = messages.filter(msg => 
          msg.metadata.timestamp > lastMessageTimestamp
        );
        
        if (newMessages.length > 0) {
          // Update last timestamp
          lastMessageTimestamp = newMessages[newMessages.length - 1].metadata.timestamp;
          
          // Notify callbacks
          const callbacks = this.messageCallbacks.get(roomId);
          if (callbacks) {
            newMessages.forEach(msg => {
              const chatMessage: ChatMessage = {
                id: msg.metadata.id,
                roomId: msg.metadata.roomId,
                userId: msg.metadata.userId,
                username: msg.metadata.username,
                content: msg.text,
                timestamp: msg.metadata.timestamp
              };
              
              callbacks.forEach(callback => {
                try {
                  callback(chatMessage);
                } catch (error) {
                  console.error("Error in message callback:", error);
                }
              });
            });
          }
        }
        
        // Schedule next poll
        setTimeout(poll, 2000);
      } catch (error) {
        console.error("Error polling messages:", error);
        
        // Retry after a delay
        setTimeout(poll, 5000);
      }
    };
    
    // Start polling
    poll();
  }
}

/**
 * Example usage of the Chat Client
 */
async function runChatClientExample() {
  // Create the client
  const client = new ChatClient(`http://localhost:${PORT}`);
  
  try {
    // Connect to the server
    await client.connect();
    
    // Login
    const user = await client.login("alice", "password");
    console.log(`Logged in as: ${user.displayName} (${user.username})`);
    
    // Get available rooms
    console.log("\nFetching available rooms...");
    const roomsResource = await client.getRooms();
    console.log(`Available rooms: ${roomsResource[0].metadata.count}`);
    console.log(roomsResource[0].text);
    
    // Get details about a specific room
    const roomId = "room_1"; // In a real app, get this from the rooms list
    console.log(`\nFetching details for room: ${roomId}`);
    const roomResource = await client.getRoom(roomId);
    console.log(`Room: ${roomResource.metadata.name}`);
    console.log(roomResource.text);
    
    // Send a message
    console.log("\nSending a message...");
    const sendResult = await client.sendMessage(roomId, "Hello from MCP Chat Client!");
    console.log(`Message sent: ${sendResult.content[0].text}`);
    
    // Get messages
    console.log("\nFetching messages...");
    const messages = await client.getMessages(roomId);
    console.log(`Received ${messages.length} messages:`);
    messages.forEach((msg, index) => {
      console.log(`${index + 1}. ${msg.metadata.username}: ${msg.text}`);
    });
    
    // Create a new room
    console.log("\nCreating a new room...");
    const createResult = await client.createRoom("TypeScript MCP", "Discussion about MCP in TypeScript");
    console.log(`Room created: ${createResult.content[0].text}`);
    console.log(`Room ID: ${createResult.metadata.roomId}`);
    
    // Start listening for new messages
    console.log("\nStarting message polling...");
    const stopPolling = client.startMessagePolling(roomId, (message) => {
      console.log(`New message: ${message.username}: ${message.content}`);
    });
    
    // Send another message to demonstrate polling
    console.log("\nSending another message...");
    await client.sendMessage(roomId, "This message should be detected by polling!");
    
    // Wait a bit to see the polling in action
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Stop polling
    stopPolling();
    console.log("Stopped message polling");
  } finally {
    // Disconnect from the server
    await client.disconnect();
  }
}

/**
 * Main function
 */
async function main() {
  // Start the server
  const server = await startChatServer();
  
  try {
    // Run the client example
    await runChatClientExample();
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
export { ChatClient, ChatDatabase };

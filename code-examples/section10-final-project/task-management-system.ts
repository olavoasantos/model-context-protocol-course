/**
 * Final Project: Full-Stack MCP Application
 * 
 * This example demonstrates a complete full-stack application using MCP,
 * including both client and server components with multi-agent communication.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";
import { z } from "zod";
import * as express from "express";
import * as http from "http";
import * as path from "path";
import * as fs from "fs/promises";
import * as crypto from "crypto";

// Define the port for our MCP server
const PORT = 3000;

/**
 * Task interface
 */
interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  priority: "low" | "medium" | "high";
  dueDate: string | null;
  tags: string[];
}

/**
 * User interface
 */
interface User {
  id: string;
  username: string;
  displayName: string;
  role: "user" | "agent" | "admin";
  createdAt: string;
}

/**
 * Agent interface
 */
interface Agent extends User {
  capabilities: string[];
  status: "idle" | "busy";
  lastActive: string;
}

/**
 * Message interface
 */
interface Message {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  timestamp: string;
  attachments: string[];
}

/**
 * Database
 * 
 * A simple in-memory database for the task management application
 */
class Database {
  private tasks: Map<string, Task> = new Map();
  private users: Map<string, User> = new Map();
  private agents: Map<string, Agent> = new Map();
  private messages: Map<string, Message[]> = new Map();
  
  constructor() {
    // Initialize with sample data
    this.initializeSampleData();
  }
  
  /**
   * Initialize sample data
   */
  private initializeSampleData(): void {
    // Add users
    this.addUser({
      id: "user1",
      username: "john",
      displayName: "John Doe",
      role: "user",
      createdAt: new Date().toISOString()
    });
    
    this.addUser({
      id: "user2",
      username: "jane",
      displayName: "Jane Smith",
      role: "admin",
      createdAt: new Date().toISOString()
    });
    
    // Add agents
    this.addAgent({
      id: "agent1",
      username: "research_agent",
      displayName: "Research Agent",
      role: "agent",
      createdAt: new Date().toISOString(),
      capabilities: ["research", "summarize"],
      status: "idle",
      lastActive: new Date().toISOString()
    });
    
    this.addAgent({
      id: "agent2",
      username: "coding_agent",
      displayName: "Coding Agent",
      role: "agent",
      createdAt: new Date().toISOString(),
      capabilities: ["code", "debug"],
      status: "idle",
      lastActive: new Date().toISOString()
    });
    
    // Add tasks
    this.addTask({
      id: "task1",
      title: "Research MCP Protocol",
      description: "Research the Model Context Protocol and create a summary",
      status: "pending",
      assignedTo: "agent1",
      createdBy: "user1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      priority: "high",
      dueDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      tags: ["research", "mcp"]
    });
    
    this.addTask({
      id: "task2",
      title: "Implement MCP Client",
      description: "Create a TypeScript implementation of an MCP client",
      status: "in_progress",
      assignedTo: "agent2",
      createdBy: "user2",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      priority: "medium",
      dueDate: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
      tags: ["development", "typescript", "mcp"]
    });
    
    // Add messages
    this.addMessage({
      id: "msg1",
      taskId: "task1",
      userId: "user1",
      content: "Please start researching the MCP protocol",
      timestamp: new Date().toISOString(),
      attachments: []
    });
    
    this.addMessage({
      id: "msg2",
      taskId: "task1",
      userId: "agent1",
      content: "I'll begin researching the Model Context Protocol right away.",
      timestamp: new Date(Date.now() + 60000).toISOString(),
      attachments: []
    });
  }
  
  // Task methods
  addTask(task: Task): void {
    this.tasks.set(task.id, task);
    
    // Initialize messages array for this task if it doesn't exist
    if (!this.messages.has(task.id)) {
      this.messages.set(task.id, []);
    }
  }
  
  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }
  
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }
  
  getTasksByUser(userId: string): Task[] {
    return Array.from(this.tasks.values())
      .filter(task => task.createdBy === userId || task.assignedTo === userId);
  }
  
  updateTask(id: string, updates: Partial<Task>): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    
    const updatedTask = { ...task, ...updates, updatedAt: new Date().toISOString() };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }
  
  deleteTask(id: string): boolean {
    return this.tasks.delete(id);
  }
  
  // User methods
  addUser(user: User): void {
    this.users.set(user.id, user);
  }
  
  getUser(id: string): User | undefined {
    return this.users.get(id);
  }
  
  getUserByUsername(username: string): User | undefined {
    return Array.from(this.users.values())
      .find(user => user.username === username);
  }
  
  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }
  
  // Agent methods
  addAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    this.users.set(agent.id, agent); // Agents are also users
  }
  
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }
  
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
  
  updateAgentStatus(id: string, status: "idle" | "busy"): Agent | undefined {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    
    const updatedAgent = { 
      ...agent, 
      status, 
      lastActive: new Date().toISOString() 
    };
    
    this.agents.set(id, updatedAgent);
    return updatedAgent;
  }
  
  // Message methods
  addMessage(message: Message): void {
    const messages = this.messages.get(message.taskId) || [];
    messages.push(message);
    this.messages.set(message.taskId, messages);
  }
  
  getMessages(taskId: string): Message[] {
    return this.messages.get(taskId) || [];
  }
}

/**
 * Task Management MCP Server
 * 
 * The main server for the task management application
 */
class TaskManagementServer {
  private server: McpServer;
  private transport: HttpServerTransport | null = null;
  private httpServer: http.Server | null = null;
  private db: Database;
  private agentClients: Map<string, AgentClient> = new Map();
  
  constructor() {
    // Initialize database
    this.db = new Database();
    
    // Create MCP server
    this.server = new McpServer({
      name: "Task Management MCP Server",
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
    
    // Register handlers
    this.registerHandlers();
    
    // Initialize agent clients
    this.initializeAgentClients();
  }
  
  /**
   * Initialize agent clients
   */
  private initializeAgentClients(): void {
    const agents = this.db.getAllAgents();
    
    for (const agent of agents) {
      this.agentClients.set(agent.id, new AgentClient(
        `http://localhost:${PORT}`,
        agent.id,
        agent.capabilities
      ));
    }
  }
  
  /**
   * Register resource and action handlers
   */
  private registerHandlers(): void {
    // Register task resource
    this.server.resource(
      "task",
      "task://{taskId}",
      async (uri, { taskId }, context) => {
        console.log(`Server: Received request for task: ${taskId}`);
        
        const task = this.db.getTask(taskId);
        
        if (!task) {
          throw new Error(`Task not found: ${taskId}`);
        }
        
        // Get assigned user or agent
        let assignedTo = null;
        if (task.assignedTo) {
          assignedTo = this.db.getUser(task.assignedTo);
        }
        
        // Get creator
        const createdBy = this.db.getUser(task.createdBy);
        
        // Format task as text
        const taskText = `# ${task.title}\n\n${task.description}\n\n` +
          `**Status:** ${task.status}\n` +
          `**Priority:** ${task.priority}\n` +
          `**Created by:** ${createdBy?.displayName || "Unknown"}\n` +
          `**Assigned to:** ${assignedTo?.displayName || "Unassigned"}\n` +
          `**Due date:** ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "None"}\n` +
          `**Tags:** ${task.tags.join(", ")}\n`;
        
        return {
          contents: [{
            uri: uri.href,
            text: taskText,
            metadata: {
              ...task,
              assignedToName: assignedTo?.displayName,
              createdByName: createdBy?.displayName
            }
          }]
        };
      }
    );
    
    // Register tasks list resource
    this.server.resource(
      "tasks",
      "tasks://list",
      async (uri) => {
        console.log(`Server: Received request for tasks list`);
        
        const tasks = this.db.getAllTasks();
        
        // Format tasks as text
        const tasksText = tasks.map(task => {
          const assignedTo = task.assignedTo ? this.db.getUser(task.assignedTo) : null;
          return `- **${task.title}** (${task.status}) - Assigned to: ${assignedTo?.displayName || "Unassigned"}`;
        }).join('\n');
        
        return {
          contents: [{
            uri: uri.href,
            text: `# Tasks\n\n${tasksText}`,
            metadata: {
              count: tasks.length
            }
          }]
        };
      }
    );
    
    // Register user tasks resource
    this.server.resource(
      "user-tasks",
      "user-tasks://{userId}",
      async (uri, { userId }) => {
        console.log(`Server: Received request for user tasks: ${userId}`);
        
        const user = this.db.getUser(userId);
        
        if (!user) {
          throw new Error(`User not found: ${userId}`);
        }
        
        const tasks = this.db.getTasksByUser(userId);
        
        // Format tasks as text
        const tasksText = tasks.map(task => {
          return `- **${task.title}** (${task.status}) - Priority: ${task.priority}`;
        }).join('\n');
        
        return {
          contents: [{
            uri: uri.href,
            text: `# Tasks for ${user.displayName}\n\n${tasksText || "No tasks found."}`,
            metadata: {
              userId,
              userName: user.displayName,
              count: tasks.length
            }
          }]
        };
      }
    );
    
    // Register messages resource
    this.server.resource(
      "messages",
      "messages://{taskId}",
      async (uri, { taskId }) => {
        console.log(`Server: Received request for messages in task: ${taskId}`);
        
        const task = this.db.getTask(taskId);
        
        if (!task) {
          throw new Error(`Task not found: ${taskId}`);
        }
        
        const messages = this.db.getMessages(taskId);
        
        // Return messages as separate content blocks
        return {
          contents: messages.map(msg => {
            const user = this.db.getUser(msg.userId);
            
            return {
              uri: `message://${msg.id}`,
              text: msg.content,
              metadata: {
                ...msg,
                userName: user?.displayName || "Unknown"
              }
            };
          })
        };
      }
    );
    
    // Register create task action
    this.server.tool(
      "task.create",
      {
        title: z.string(),
        description: z.string(),
        priority: z.enum(["low", "medium", "high"]),
        assignedTo: z.string().optional(),
        dueDate: z.string().optional(),
        tags: z.array(z.string()).optional(),
        createdBy: z.string()
      },
      async ({ title, description, priority, assignedTo, dueDate, tags = [], createdBy }) => {
        console.log(`Server: Create task "${title}" by user ${createdBy}`);
        
        // Validate user
        const user = this.db.getUser(createdBy);
        if (!user) {
          throw new Error(`User not found: ${createdBy}`);
        }
        
        // Validate assigned user if provided
        if (assignedTo) {
          const assignedUser = this.db.getUser(assignedTo);
          if (!assignedUser) {
            throw new Error(`Assigned user not found: ${assignedTo}`);
          }
          
          // If assigned to an agent, update agent status
          if (assignedUser.role === "agent") {
            this.db.updateAgentStatus(assignedTo, "busy");
          }
        }
        
        // Create task
        const taskId = `task_${crypto.randomBytes(8).toString("hex")}`;
        const now = new Date().toISOString();
        
        const task: Task = {
          id: taskId,
          title,
          description,
          status: "pending",
          assignedTo,
          createdBy,
          createdAt: now,
          updatedAt: now,
          priority,
          dueDate,
          tags
        };
        
        this.db.addTask(task);
        
        // If assigned to an agent, notify the agent
        if (assignedTo && this.agentClients.has(assignedTo)) {
          const agentClient = this.agentClients.get(assignedTo)!;
          
          // Notify agent asynchronously
          agentClient.notifyNewTask(task).catch(error => {
            console.error(`Failed to notify agent ${assignedTo}:`, error);
          });
        }
        
        return {
          content: [{
            type: "text",
            text: `Task created successfully: ${title}`
          }],
          metadata: {
            taskId,
            title,
            status: "pending"
          }
        };
      }
    );
    
    // Register update task action
    this.server.tool(
      "task.update",
      {
        taskId: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["pending", "in_progress", "completed"]).optional(),
        assignedTo: z.string().nullable().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        dueDate: z.string().nullable().optional(),
        tags: z.array(z.string()).optional()
      },
      async ({ taskId, ...updates }) => {
        console.log(`Server: Update task ${taskId}`);
        
        // Get the task
        const task = this.db.getTask(taskId);
        if (!task) {
          throw new Error(`Task not found: ${taskId}`);
        }
        
        // If assignedTo is changing, handle agent status updates
        if (updates.assignedTo !== undefined && updates.assignedTo !== task.assignedTo) {
          // If previously assigned to an agent, update status to idle
          if (task.assignedTo) {
            const previousAgent = this.db.getAgent(task.assignedTo);
            if (previousAgent) {
              this.db.updateAgentStatus(task.assignedTo, "idle");
            }
          }
          
          // If newly assigned to an agent, update status to busy
          if (updates.assignedTo) {
            const newAgent = this.db.getAgent(updates.assignedTo);
            if (newAgent) {
              this.db.updateAgentStatus(updates.assignedTo, "busy");
              
              // Notify the agent
              if (this.agentClients.has(updates.assignedTo)) {
                const agentClient = this.agentClients.get(updates.assignedTo)!;
                
                // Notify agent asynchronously
                agentClient.notifyNewTask({
                  ...task,
                  ...updates,
                  assignedTo: updates.assignedTo
                }).catch(error => {
                  console.error(`Failed to notify agent ${updates.assignedTo}:`, error);
                });
              }
            }
          }
        }
        
        // Update the task
        const updatedTask = this.db.updateTask(taskId, updates);
        
        return {
          content: [{
            type: "text",
            text: `Task updated successfully: ${updatedTask?.title}`
          }],
          metadata: {
            taskId,
            title: updatedTask?.title,
            status: updatedTask?.status
          }
        };
      }
    );
    
    // Register send message action
    this.server.tool(
      "message.send",
      {
        taskId: z.string(),
        userId: z.string(),
        content: z.string(),
        attachments: z.array(z.string()).optional()
      },
      async ({ taskId, userId, content, attachments = [] }) => {
        console.log(`Server: Send message to task ${taskId} from user ${userId}`);
        
        // Validate task
        const task = this.db.getTask(taskId);
        if (!task) {
          throw new Error(`Task not found: ${taskId}`);
        }
        
        // Validate user
        const user = this.db.getUser(userId);
        if (!user) {
          throw new Error(`User not found: ${userId}`);
        }
        
        // Create message
        const messageId = `msg_${crypto.randomBytes(8).toString("hex")}`;
        
        const message: Message = {
          id: messageId,
          taskId,
          userId,
          content,
          timestamp: new Date().toISOString(),
          attachments
        };
        
        this.db.addMessage(message);
        
        // If task is assigned to an agent and message is from a user, notify the agent
        if (task.assignedTo && user.role !== "agent" && this.agentClients.has(task.assignedTo)) {
          const agentClient = this.agentClients.get(task.assignedTo)!;
          
          // Notify agent asynchronously
          agentClient.notifyNewMessage(task, message).catch(error => {
            console.error(`Failed to notify agent ${task.assignedTo}:`, error);
          });
        }
        
        return {
          content: [{
            type: "text",
            text: `Message sent successfully`
          }],
          metadata: {
            messageId,
            taskId,
            timestamp: message.timestamp
          }
        };
      }
    );
  }
  
  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Create Express app
    const app = express();
    
    // Serve static files from the 'public' directory
    app.use(express.static(path.join(__dirname, "public")));
    
    // Create HTTP server
    this.httpServer = http.createServer(app);
    
    // Create transport
    this.transport = new HttpServerTransport({ 
      server: this.httpServer,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"]
      }
    });
    
    // Connect server to transport
    await this.server.connect(this.transport);
    
    // Start HTTP server
    this.httpServer.listen(PORT, () => {
      console.log(`Task Management MCP server running on port ${PORT}`);
    });
    
    // Connect agent clients
    for (const [agentId, client] of this.agentClients.entries()) {
      try {
        await client.connect();
        console.log(`Connected agent client: ${agentId}`);
      } catch (error) {
        console.error(`Failed to connect agent client ${agentId}:`, error);
      }
    }
  }
  
  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    // Disconnect agent clients
    for (const [agentId, client] of this.agentClients.entries()) {
      try {
        await client.disconnect();
        console.log(`Disconnected agent client: ${agentId}`);
      } catch (error) {
        console.error(`Failed to disconnect agent client ${agentId}:`, error);
      }
    }
    
    // Disconnect MCP server
    if (this.transport) {
      await this.server.disconnect();
    }
    
    // Close HTTP server
    if (this.httpServer) {
      this.httpServer.close();
    }
    
    console.log("Server stopped");
  }
}

/**
 * Agent Client
 * 
 * A client for an AI agent to interact with the task management system
 */
class AgentClient {
  private client: McpClient;
  private agentId: string;
  private capabilities: string[];
  private connected: boolean = false;
  
  constructor(serverUrl: string, agentId: string, capabilities: string[]) {
    const transport = new HttpClientTransport(serverUrl);
    this.client = new McpClient(transport);
    this.agentId = agentId;
    this.capabilities = capabilities;
  }
  
  /**
   * Connect to the server
   */
  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }
  
  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
      this.connected = false;
    }
  }
  
  /**
   * Notify the agent about a new task
   */
  async notifyNewTask(task: Task): Promise<void> {
    console.log(`Notifying agent ${this.agentId} about new task: ${task.id}`);
    
    // In a real implementation, this would send a notification to the agent
    // and the agent would process the task based on its capabilities
    
    // Simulate agent processing
    await this.processTask(task);
  }
  
  /**
   * Notify the agent about a new message
   */
  async notifyNewMessage(task: Task, message: Message): Promise<void> {
    console.log(`Notifying agent ${this.agentId} about new message in task: ${task.id}`);
    
    // In a real implementation, this would send a notification to the agent
    // and the agent would process the message
    
    // Simulate agent processing
    await this.processMessage(task, message);
  }
  
  /**
   * Process a task
   */
  private async processTask(task: Task): Promise<void> {
    // Simulate agent processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update task status to in_progress
    await this.client.executeAction("task.update", {
      taskId: task.id,
      status: "in_progress"
    });
    
    // Send a message acknowledging the task
    await this.client.executeAction("message.send", {
      taskId: task.id,
      userId: this.agentId,
      content: `I've started working on this task. I'll use my ${this.capabilities.join(", ")} capabilities to complete it.`
    });
    
    // In a real implementation, the agent would actually process the task
    // based on its capabilities
    
    // For demonstration purposes, simulate completion after a delay
    setTimeout(async () => {
      try {
        // Send a message with the results
        await this.client.executeAction("message.send", {
          taskId: task.id,
          userId: this.agentId,
          content: `I've completed this task. Here are my findings: [Task results would go here]`
        });
        
        // Update task status to completed
        await this.client.executeAction("task.update", {
          taskId: task.id,
          status: "completed"
        });
      } catch (error) {
        console.error(`Error completing task ${task.id}:`, error);
      }
    }, 5000);
  }
  
  /**
   * Process a message
   */
  private async processMessage(task: Task, message: Message): Promise<void> {
    // Simulate agent processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send a response message
    await this.client.executeAction("message.send", {
      taskId: task.id,
      userId: this.agentId,
      content: `I've received your message. I'll incorporate this information into my work on the task.`
    });
    
    // In a real implementation, the agent would process the message content
    // and potentially update its approach to the task
  }
}

/**
 * User Client
 * 
 * A client for a human user to interact with the task management system
 */
class UserClient {
  private client: McpClient;
  private userId: string;
  private connected: boolean = false;
  
  constructor(serverUrl: string, userId: string) {
    const transport = new HttpClientTransport(serverUrl);
    this.client = new McpClient(transport);
    this.userId = userId;
  }
  
  /**
   * Connect to the server
   */
  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
      console.log(`User client connected: ${this.userId}`);
    }
  }
  
  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
      this.connected = false;
      console.log(`User client disconnected: ${this.userId}`);
    }
  }
  
  /**
   * Get all tasks
   */
  async getAllTasks(): Promise<any> {
    const resources = await this.client.fetchResource("tasks://list");
    return resources[0];
  }
  
  /**
   * Get user's tasks
   */
  async getUserTasks(): Promise<any> {
    const resources = await this.client.fetchResource(`user-tasks://${this.userId}`);
    return resources[0];
  }
  
  /**
   * Get a specific task
   */
  async getTask(taskId: string): Promise<any> {
    const resources = await this.client.fetchResource(`task://${taskId}`);
    return resources[0];
  }
  
  /**
   * Get messages for a task
   */
  async getTaskMessages(taskId: string): Promise<any[]> {
    return await this.client.fetchResource(`messages://${taskId}`);
  }
  
  /**
   * Create a new task
   */
  async createTask(
    title: string,
    description: string,
    priority: "low" | "medium" | "high" = "medium",
    assignedTo?: string,
    dueDate?: string,
    tags: string[] = []
  ): Promise<any> {
    return await this.client.executeAction("task.create", {
      title,
      description,
      priority,
      assignedTo,
      dueDate,
      tags,
      createdBy: this.userId
    });
  }
  
  /**
   * Update a task
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<any> {
    return await this.client.executeAction("task.update", {
      taskId,
      ...updates
    });
  }
  
  /**
   * Send a message
   */
  async sendMessage(taskId: string, content: string, attachments: string[] = []): Promise<any> {
    return await this.client.executeAction("message.send", {
      taskId,
      userId: this.userId,
      content,
      attachments
    });
  }
}

/**
 * Example usage of the Task Management System
 */
async function runExample() {
  // Create and start the server
  const server = new TaskManagementServer();
  await server.start();
  
  try {
    // Create a user client
    const userClient = new UserClient(`http://localhost:${PORT}`, "user1");
    await userClient.connect();
    
    try {
      // Get all tasks
      console.log("\nFetching all tasks...");
      const allTasks = await userClient.getAllTasks();
      console.log(allTasks.text);
      
      // Get user's tasks
      console.log("\nFetching user's tasks...");
      const userTasks = await userClient.getUserTasks();
      console.log(userTasks.text);
      
      // Get a specific task
      console.log("\nFetching specific task...");
      const task = await userClient.getTask("task1");
      console.log(task.text);
      
      // Get task messages
      console.log("\nFetching task messages...");
      const messages = await userClient.getTaskMessages("task1");
      console.log(`Received ${messages.length} messages:`);
      messages.forEach((msg, index) => {
        console.log(`${index + 1}. ${msg.metadata.userName}: ${msg.text}`);
      });
      
      // Create a new task
      console.log("\nCreating a new task...");
      const createResult = await userClient.createTask(
        "Implement MCP Server",
        "Create a TypeScript implementation of an MCP server",
        "high",
        "agent2",
        new Date(Date.now() + 259200000).toISOString(), // 3 days from now
        ["development", "typescript", "mcp"]
      );
      console.log(`Task created: ${createResult.content[0].text}`);
      
      // Send a message to a task
      console.log("\nSending a message...");
      const messageResult = await userClient.sendMessage(
        "task1",
        "How is the research going? Please provide an update."
      );
      console.log(`Message sent: ${messageResult.content[0].text}`);
      
      // Wait for agent responses
      console.log("\nWaiting for agent responses...");
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      // Get updated messages
      console.log("\nFetching updated messages...");
      const updatedMessages = await userClient.getTaskMessages("task1");
      console.log(`Received ${updatedMessages.length} messages:`);
      updatedMessages.forEach((msg, index) => {
        console.log(`${index + 1}. ${msg.metadata.userName}: ${msg.text}`);
      });
    } finally {
      // Disconnect user client
      await userClient.disconnect();
    }
  } finally {
    // Stop the server
    await server.stop();
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await runExample();
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

// Export for testing
export { 
  TaskManagementServer, 
  UserClient, 
  AgentClient,
  Database
};

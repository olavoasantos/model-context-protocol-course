/**
 * Testing and Debugging MCP Applications
 * 
 * This example demonstrates techniques for testing and debugging MCP applications,
 * including unit testing, integration testing, and common debugging strategies.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";
import { z } from "zod";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock transport for testing
class MockTransport {
  private handlers: Map<string, (params: any) => any> = new Map();
  private resources: Map<string, any> = new Map();
  
  // Register a resource handler
  registerResource(pattern: string, handler: (params: any) => any): void {
    this.handlers.set(pattern, handler);
  }
  
  // Register a static resource
  addResource(uri: string, content: any): void {
    this.resources.set(uri, content);
  }
  
  // Fetch a resource
  async fetchResource(uri: string): Promise<any> {
    // Check for static resources first
    if (this.resources.has(uri)) {
      return this.resources.get(uri);
    }
    
    // Parse the URI to extract parameters
    for (const [pattern, handler] of this.handlers.entries()) {
      const params = this.matchPattern(uri, pattern);
      if (params) {
        return await handler(params);
      }
    }
    
    throw new Error(`Resource not found: ${uri}`);
  }
  
  // Execute an action
  async executeAction(action: string, params: any): Promise<any> {
    const handler = this.handlers.get(action);
    if (!handler) {
      throw new Error(`Action not found: ${action}`);
    }
    
    return await handler(params);
  }
  
  // Match a URI against a pattern
  private matchPattern(uri: string, pattern: string): any | null {
    // Simple pattern matching for testing
    // In a real implementation, this would be more sophisticated
    
    // Convert pattern to regex
    const regexPattern = pattern.replace(/\{([^}]+)\}/g, '([^/]+)');
    const regex = new RegExp(`^${regexPattern}$`);
    
    // Extract parameter names
    const paramNames: string[] = [];
    let match;
    const paramRegex = /\{([^}]+)\}/g;
    while ((match = paramRegex.exec(pattern)) !== null) {
      paramNames.push(match[1]);
    }
    
    // Match URI against regex
    const matches = uri.match(regex);
    if (!matches) {
      return null;
    }
    
    // Extract parameter values
    const params: Record<string, string> = {};
    for (let i = 0; i < paramNames.length; i++) {
      params[paramNames[i]] = matches[i + 1];
    }
    
    return params;
  }
}

/**
 * Calculator Service
 * 
 * A simple calculator service to demonstrate testing
 */
class CalculatorService {
  add(a: number, b: number): number {
    return a + b;
  }
  
  subtract(a: number, b: number): number {
    return a - b;
  }
  
  multiply(a: number, b: number): number {
    return a * b;
  }
  
  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error("Division by zero");
    }
    return a / b;
  }
}

/**
 * Calculator MCP Server
 * 
 * A server that exposes calculator operations via MCP
 */
class CalculatorMcpServer {
  private server: McpServer;
  private calculatorService: CalculatorService;
  private transport: HttpServerTransport | null = null;
  
  constructor(calculatorService: CalculatorService) {
    this.calculatorService = calculatorService;
    
    this.server = new McpServer({
      name: "Calculator MCP Server",
      version: "1.0.0"
    });
    
    this.registerHandlers();
  }
  
  /**
   * Register resource and action handlers
   */
  private registerHandlers(): void {
    // Register calculator action
    this.server.tool(
      "calculator.calculate",
      {
        a: z.number(),
        b: z.number(),
        operation: z.enum(["add", "subtract", "multiply", "divide"])
      },
      async ({ a, b, operation }) => {
        console.log(`Server: Calculate ${a} ${operation} ${b}`);
        
        let result: number;
        
        try {
          switch (operation) {
            case "add":
              result = this.calculatorService.add(a, b);
              break;
            case "subtract":
              result = this.calculatorService.subtract(a, b);
              break;
            case "multiply":
              result = this.calculatorService.multiply(a, b);
              break;
            case "divide":
              result = this.calculatorService.divide(a, b);
              break;
          }
          
          return {
            content: [{
              type: "text",
              text: `Result: ${result}`
            }],
            metadata: {
              operation,
              a,
              b,
              result
            }
          };
        } catch (error) {
          throw new Error(`Calculation error: ${error.message}`);
        }
      }
    );
    
    // Register calculation history resource
    this.server.resource(
      "history",
      "history://list",
      async () => {
        // In a real app, this would fetch from a database
        return {
          contents: [{
            uri: "history://list",
            text: "# Calculation History\n\n- 5 + 3 = 8\n- 10 - 4 = 6\n- 7 * 2 = 14",
            metadata: {
              count: 3
            }
          }]
        };
      }
    );
  }
  
  /**
   * Start the server
   */
  async start(port: number): Promise<void> {
    this.transport = new HttpServerTransport({ port });
    await this.server.connect(this.transport);
    console.log(`Calculator MCP server running on port ${port}`);
  }
  
  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (this.transport) {
      await this.server.disconnect();
      console.log("Calculator MCP server stopped");
    }
  }
}

/**
 * Calculator MCP Client
 * 
 * A client for the calculator MCP server
 */
class CalculatorMcpClient {
  private client: McpClient;
  
  constructor(serverUrl: string) {
    const transport = new HttpClientTransport(serverUrl);
    this.client = new McpClient(transport);
  }
  
  /**
   * Connect to the server
   */
  async connect(): Promise<void> {
    await this.client.connect();
    console.log("Connected to calculator server");
  }
  
  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    await this.client.disconnect();
    console.log("Disconnected from calculator server");
  }
  
  /**
   * Perform a calculation
   */
  async calculate(a: number, b: number, operation: "add" | "subtract" | "multiply" | "divide"): Promise<number> {
    const result = await this.client.executeAction("calculator.calculate", {
      a,
      b,
      operation
    });
    
    return result.metadata.result;
  }
  
  /**
   * Get calculation history
   */
  async getHistory(): Promise<any> {
    const resources = await this.client.fetchResource("history://list");
    return resources[0];
  }
}

/**
 * Unit Tests for Calculator Service
 */
describe("CalculatorService", () => {
  let calculator: CalculatorService;
  
  beforeEach(() => {
    calculator = new CalculatorService();
  });
  
  it("should add two numbers correctly", () => {
    expect(calculator.add(2, 3)).toBe(5);
    expect(calculator.add(-1, 1)).toBe(0);
    expect(calculator.add(0, 0)).toBe(0);
  });
  
  it("should subtract two numbers correctly", () => {
    expect(calculator.subtract(5, 3)).toBe(2);
    expect(calculator.subtract(1, 1)).toBe(0);
    expect(calculator.subtract(0, 5)).toBe(-5);
  });
  
  it("should multiply two numbers correctly", () => {
    expect(calculator.multiply(2, 3)).toBe(6);
    expect(calculator.multiply(-2, 3)).toBe(-6);
    expect(calculator.multiply(0, 5)).toBe(0);
  });
  
  it("should divide two numbers correctly", () => {
    expect(calculator.divide(6, 3)).toBe(2);
    expect(calculator.divide(5, 2)).toBe(2.5);
    expect(calculator.divide(0, 5)).toBe(0);
  });
  
  it("should throw an error when dividing by zero", () => {
    expect(() => calculator.divide(5, 0)).toThrow("Division by zero");
  });
});

/**
 * Integration Tests for Calculator MCP Server and Client
 */
describe("CalculatorMcpIntegration", () => {
  let calculatorService: CalculatorService;
  let mockTransport: MockTransport;
  let client: McpClient;
  
  beforeEach(() => {
    calculatorService = new CalculatorService();
    mockTransport = new MockTransport();
    client = new McpClient(mockTransport as any);
    
    // Mock the calculator action
    mockTransport.registerResource("calculator.calculate", async (params) => {
      const { a, b, operation } = params;
      let result: number;
      
      switch (operation) {
        case "add":
          result = calculatorService.add(a, b);
          break;
        case "subtract":
          result = calculatorService.subtract(a, b);
          break;
        case "multiply":
          result = calculatorService.multiply(a, b);
          break;
        case "divide":
          result = calculatorService.divide(a, b);
          break;
      }
      
      return {
        content: [{
          type: "text",
          text: `Result: ${result}`
        }],
        metadata: {
          operation,
          a,
          b,
          result
        }
      };
    });
    
    // Mock the history resource
    mockTransport.addResource("history://list", {
      contents: [{
        uri: "history://list",
        text: "# Calculation History\n\n- 5 + 3 = 8\n- 10 - 4 = 6\n- 7 * 2 = 14",
        metadata: {
          count: 3
        }
      }]
    });
  });
  
  it("should perform calculations via MCP", async () => {
    // Connect to the mock server
    await client.connect();
    
    // Test addition
    const addResult = await client.executeAction("calculator.calculate", {
      a: 5,
      b: 3,
      operation: "add"
    });
    
    expect(addResult.metadata.result).toBe(8);
    
    // Test division
    const divideResult = await client.executeAction("calculator.calculate", {
      a: 10,
      b: 2,
      operation: "divide"
    });
    
    expect(divideResult.metadata.result).toBe(5);
    
    // Disconnect
    await client.disconnect();
  });
  
  it("should handle errors correctly", async () => {
    // Connect to the mock server
    await client.connect();
    
    // Test division by zero
    await expect(client.executeAction("calculator.calculate", {
      a: 5,
      b: 0,
      operation: "divide"
    })).rejects.toThrow();
    
    // Disconnect
    await client.disconnect();
  });
  
  it("should fetch calculation history", async () => {
    // Connect to the mock server
    await client.connect();
    
    // Fetch history
    const history = await client.fetchResource("history://list");
    
    expect(history[0].metadata.count).toBe(3);
    expect(history[0].text).toContain("Calculation History");
    
    // Disconnect
    await client.disconnect();
  });
});

/**
 * End-to-End Test for Calculator MCP
 * 
 * This would typically be run in a separate test file
 */
async function runE2ETest() {
  // Create the calculator service
  const calculatorService = new CalculatorService();
  
  // Create and start the server
  const server = new CalculatorMcpServer(calculatorService);
  await server.start(3000);
  
  try {
    // Create the client
    const client = new CalculatorMcpClient("http://localhost:3000");
    
    // Connect to the server
    await client.connect();
    
    try {
      // Perform calculations
      console.log("Testing addition...");
      const addResult = await client.calculate(5, 3, "add");
      console.log(`5 + 3 = ${addResult}`);
      
      console.log("Testing subtraction...");
      const subtractResult = await client.calculate(10, 4, "subtract");
      console.log(`10 - 4 = ${subtractResult}`);
      
      console.log("Testing multiplication...");
      const multiplyResult = await client.calculate(7, 2, "multiply");
      console.log(`7 * 2 = ${multiplyResult}`);
      
      console.log("Testing division...");
      const divideResult = await client.calculate(9, 3, "divide");
      console.log(`9 / 3 = ${divideResult}`);
      
      // Test error handling
      console.log("Testing error handling (division by zero)...");
      try {
        await client.calculate(5, 0, "divide");
        console.log("Error: Division by zero did not throw an error");
      } catch (error) {
        console.log(`Caught expected error: ${error.message}`);
      }
      
      // Get calculation history
      console.log("Fetching calculation history...");
      const history = await client.getHistory();
      console.log(history.text);
      
      console.log("E2E test completed successfully");
    } finally {
      // Disconnect the client
      await client.disconnect();
    }
  } finally {
    // Stop the server
    await server.stop();
  }
}

/**
 * Debugging Utilities
 */
class McpDebugger {
  private static instance: McpDebugger;
  private enabled: boolean = false;
  private logLevel: "error" | "warn" | "info" | "debug" = "info";
  private logEntries: any[] = [];
  
  private constructor() {}
  
  /**
   * Get the singleton instance
   */
  static getInstance(): McpDebugger {
    if (!McpDebugger.instance) {
      McpDebugger.instance = new McpDebugger();
    }
    return McpDebugger.instance;
  }
  
  /**
   * Enable or disable debugging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`MCP Debugging ${enabled ? "enabled" : "disabled"}`);
  }
  
  /**
   * Set the log level
   */
  setLogLevel(level: "error" | "warn" | "info" | "debug"): void {
    this.logLevel = level;
    console.log(`MCP Log level set to: ${level}`);
  }
  
  /**
   * Log a message
   */
  log(level: "error" | "warn" | "info" | "debug", message: string, data?: any): void {
    if (!this.enabled) return;
    
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    if (levels[level] > levels[this.logLevel]) return;
    
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    
    this.logEntries.push(entry);
    
    // Log to console
    const consoleMethod = level === "debug" ? "log" : level;
    console[consoleMethod](`[MCP ${level.toUpperCase()}] ${message}`, data || "");
  }
  
  /**
   * Clear the log
   */
  clearLog(): void {
    this.logEntries = [];
    console.log("MCP Debug log cleared");
  }
  
  /**
   * Get the log entries
   */
  getLogEntries(): any[] {
    return [...this.logEntries];
  }
  
  /**
   * Save the log to a file
   */
  saveLogToFile(filename: string): void {
    // In a real implementation, this would write to a file
    console.log(`Saving log to ${filename}`);
    console.log(JSON.stringify(this.logEntries, null, 2));
  }
}

/**
 * MCP Client with debugging
 */
class DebuggableClient extends McpClient {
  private debugger: McpDebugger;
  
  constructor(transport: any) {
    super(transport);
    this.debugger = McpDebugger.getInstance();
  }
  
  /**
   * Override fetchResource to add debugging
   */
  async fetchResource(uri: string): Promise<any> {
    this.debugger.log("debug", `Fetching resource: ${uri}`);
    
    try {
      const result = await super.fetchResource(uri);
      this.debugger.log("info", `Resource fetched: ${uri}`, { resourceCount: result.length });
      return result;
    } catch (error) {
      this.debugger.log("error", `Error fetching resource: ${uri}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Override executeAction to add debugging
   */
  async executeAction(action: string, params: any): Promise<any> {
    this.debugger.log("debug", `Executing action: ${action}`, { params });
    
    try {
      const result = await super.executeAction(action, params);
      this.debugger.log("info", `Action executed: ${action}`, { result });
      return result;
    } catch (error) {
      this.debugger.log("error", `Error executing action: ${action}`, { error: error.message });
      throw error;
    }
  }
}

/**
 * Main function to run the example
 */
async function main() {
  // Enable debugging
  const debugger = McpDebugger.getInstance();
  debugger.setEnabled(true);
  debugger.setLogLevel("debug");
  
  try {
    // Run the E2E test
    await runE2ETest();
  } catch (error) {
    console.error("Error running E2E test:", error);
  }
  
  // Save the debug log
  debugger.saveLogToFile("mcp-debug.log");
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

// Export for testing
export { 
  CalculatorService, 
  CalculatorMcpServer, 
  CalculatorMcpClient,
  MockTransport,
  McpDebugger,
  DebuggableClient
};

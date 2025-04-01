/**
 * Deployment and Production Considerations for MCP Applications
 * 
 * This example demonstrates best practices for deploying MCP applications
 * to production environments, including performance optimization and scaling.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { z } from "zod";
import * as express from "express";
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as cluster from "cluster";
import * as os from "os";

/**
 * Configuration Manager
 * 
 * Manages configuration for different environments
 */
class ConfigManager {
  private config: Record<string, any> = {};
  private environment: string;
  
  constructor(environment: string = process.env.NODE_ENV || "development") {
    this.environment = environment;
    this.loadConfig();
  }
  
  /**
   * Load configuration based on environment
   */
  private loadConfig(): void {
    // Base configuration
    const baseConfig = {
      server: {
        port: 3000,
        host: "0.0.0.0"
      },
      ssl: {
        enabled: false
      },
      clustering: {
        enabled: false
      },
      logging: {
        level: "info"
      },
      cache: {
        enabled: true,
        ttl: 60 // seconds
      },
      rateLimit: {
        enabled: true,
        maxRequests: 100,
        windowMs: 60000 // 1 minute
      }
    };
    
    // Environment-specific configuration
    const envConfigs: Record<string, any> = {
      development: {
        server: {
          port: 3000
        },
        logging: {
          level: "debug"
        },
        rateLimit: {
          enabled: false
        }
      },
      test: {
        server: {
          port: 3001
        },
        cache: {
          enabled: false
        },
        rateLimit: {
          enabled: false
        }
      },
      production: {
        server: {
          port: process.env.PORT ? parseInt(process.env.PORT) : 3000
        },
        ssl: {
          enabled: true,
          cert: process.env.SSL_CERT_PATH || "/etc/ssl/certs/server.crt",
          key: process.env.SSL_KEY_PATH || "/etc/ssl/private/server.key"
        },
        clustering: {
          enabled: true,
          workers: process.env.WORKERS ? parseInt(process.env.WORKERS) : 0 // 0 means use CPU count
        },
        logging: {
          level: "warn"
        },
        cache: {
          ttl: 300 // 5 minutes
        },
        rateLimit: {
          maxRequests: 500
        }
      }
    };
    
    // Merge configurations
    this.config = this.deepMerge(baseConfig, envConfigs[this.environment] || {});
    
    // Override with environment variables
    this.applyEnvironmentVariables();
    
    console.log(`Loaded configuration for ${this.environment} environment`);
  }
  
  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] instanceof Object && key in target) {
        result[key] = this.deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
  
  /**
   * Apply environment variables to override configuration
   */
  private applyEnvironmentVariables(): void {
    // Example: SERVER_PORT environment variable overrides config.server.port
    if (process.env.SERVER_PORT) {
      this.config.server.port = parseInt(process.env.SERVER_PORT);
    }
    
    // Add more environment variable mappings as needed
  }
  
  /**
   * Get a configuration value
   */
  get<T>(key: string, defaultValue?: T): T {
    const parts = key.split(".");
    let value: any = this.config;
    
    for (const part of parts) {
      if (value === undefined || value === null) {
        return defaultValue as T;
      }
      value = value[part];
    }
    
    return (value !== undefined && value !== null) ? value : defaultValue as T;
  }
  
  /**
   * Get the current environment
   */
  getEnvironment(): string {
    return this.environment;
  }
  
  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.environment === "production";
  }
}

/**
 * Cache Manager
 * 
 * Manages caching for MCP resources
 */
class CacheManager {
  private cache: Map<string, { data: any; expires: number }> = new Map();
  private enabled: boolean;
  private defaultTtl: number;
  
  constructor(enabled: boolean = true, defaultTtl: number = 60) {
    this.enabled = enabled;
    this.defaultTtl = defaultTtl;
    
    // Start cache cleanup interval
    setInterval(() => this.cleanup(), 60000); // Clean up every minute
  }
  
  /**
   * Set a cache item
   */
  set(key: string, data: any, ttl: number = this.defaultTtl): void {
    if (!this.enabled) return;
    
    const expires = Date.now() + (ttl * 1000);
    this.cache.set(key, { data, expires });
  }
  
  /**
   * Get a cache item
   */
  get<T>(key: string): T | null {
    if (!this.enabled) return null;
    
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    // Check if expired
    if (item.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data as T;
  }
  
  /**
   * Delete a cache item
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Clean up expired items
   */
  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (item.expires < now) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Enable or disable the cache
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * Set the default TTL
   */
  setDefaultTtl(ttl: number): void {
    this.defaultTtl = ttl;
  }
}

/**
 * Rate Limiter
 * 
 * Limits the rate of requests from clients
 */
class RateLimiter {
  private clients: Map<string, { count: number; resetTime: number }> = new Map();
  private enabled: boolean;
  private maxRequests: number;
  private windowMs: number;
  
  constructor(enabled: boolean = true, maxRequests: number = 100, windowMs: number = 60000) {
    this.enabled = enabled;
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    
    // Start cleanup interval
    setInterval(() => this.cleanup(), windowMs);
  }
  
  /**
   * Check if a client is rate limited
   */
  isRateLimited(clientId: string): boolean {
    if (!this.enabled) return false;
    
    const now = Date.now();
    const client = this.clients.get(clientId);
    
    // If client doesn't exist or window has expired, create new entry
    if (!client || client.resetTime < now) {
      this.clients.set(clientId, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return false;
    }
    
    // Increment count
    client.count++;
    
    // Check if over limit
    return client.count > this.maxRequests;
  }
  
  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    for (const [clientId, client] of this.clients.entries()) {
      if (client.resetTime < now) {
        this.clients.delete(clientId);
      }
    }
  }
  
  /**
   * Enable or disable rate limiting
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * Set the maximum requests per window
   */
  setMaxRequests(maxRequests: number): void {
    this.maxRequests = maxRequests;
  }
  
  /**
   * Set the window size in milliseconds
   */
  setWindowMs(windowMs: number): void {
    this.windowMs = windowMs;
  }
}

/**
 * Logger
 * 
 * Handles logging for the application
 */
class Logger {
  private level: string;
  private levels: Record<string, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  };
  
  constructor(level: string = "info") {
    this.level = level;
  }
  
  /**
   * Log a message
   */
  log(level: string, message: string, data?: any): void {
    if (this.levels[level] > this.levels[this.level]) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };
    
    // In a production environment, you might want to send logs to a service
    // like CloudWatch, Datadog, or ELK stack instead of console
    console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`, data || "");
    
    // Example: If in production, send to external logging service
    // if (process.env.NODE_ENV === "production") {
    //   this.sendToExternalService(logEntry);
    // }
  }
  
  /**
   * Log an error
   */
  error(message: string, data?: any): void {
    this.log("error", message, data);
  }
  
  /**
   * Log a warning
   */
  warn(message: string, data?: any): void {
    this.log("warn", message, data);
  }
  
  /**
   * Log an info message
   */
  info(message: string, data?: any): void {
    this.log("info", message, data);
  }
  
  /**
   * Log a debug message
   */
  debug(message: string, data?: any): void {
    this.log("debug", message, data);
  }
  
  /**
   * Set the log level
   */
  setLevel(level: string): void {
    if (this.levels[level] !== undefined) {
      this.level = level;
    }
  }
  
  /**
   * Send log to external service
   */
  private sendToExternalService(logEntry: any): void {
    // Implementation would depend on the service you're using
    // Example: AWS CloudWatch, Datadog, etc.
  }
}

/**
 * MCP Production Server
 * 
 * A production-ready MCP server with clustering, SSL, caching, and rate limiting
 */
class McpProductionServer {
  private server: McpServer;
  private transport: HttpServerTransport | null = null;
  private httpServer: http.Server | https.Server | null = null;
  private config: ConfigManager;
  private cache: CacheManager;
  private rateLimiter: RateLimiter;
  private logger: Logger;
  
  constructor() {
    // Initialize configuration
    this.config = new ConfigManager();
    
    // Initialize cache
    this.cache = new CacheManager(
      this.config.get("cache.enabled", true),
      this.config.get("cache.ttl", 60)
    );
    
    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(
      this.config.get("rateLimit.enabled", true),
      this.config.get("rateLimit.maxRequests", 100),
      this.config.get("rateLimit.windowMs", 60000)
    );
    
    // Initialize logger
    this.logger = new Logger(this.config.get("logging.level", "info"));
    
    // Create MCP server
    this.server = new McpServer({
      name: "MCP Production Server",
      version: "1.0.0",
      
      // Error handling
      onError: (error, context) => {
        this.logger.error(`MCP server error: ${error.message}`, {
          code: error.code,
          details: error.details,
          connectionId: context?.connectionId
        });
      }
    });
    
    // Register handlers
    this.registerHandlers();
  }
  
  /**
   * Register resource and action handlers
   */
  private registerHandlers(): void {
    // Example resource with caching
    this.server.resource(
      "data",
      "data://{id}",
      async (uri, { id }, context) => {
        this.logger.debug(`Resource request: data ${id} from ${context.connectionId}`);
        
        // Check rate limiting
        if (this.rateLimiter.isRateLimited(context.connectionId)) {
          throw new Error("Rate limit exceeded");
        }
        
        // Check cache
        const cacheKey = `data:${id}`;
        const cachedData = this.cache.get(cacheKey);
        
        if (cachedData) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cachedData;
        }
        
        // Simulate fetching data
        this.logger.debug(`Cache miss for ${cacheKey}`);
        
        // In a real app, this would fetch from a database
        const data = {
          id,
          name: `Item ${id}`,
          description: `This is item ${id}`,
          createdAt: new Date().toISOString()
        };
        
        const response = {
          contents: [{
            uri: uri.href,
            text: `# ${data.name}\n\n${data.description}`,
            metadata: data
          }]
        };
        
        // Cache the response
        this.cache.set(cacheKey, response);
        
        return response;
      }
    );
    
    // Example action
    this.server.tool(
      "data.update",
      {
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional()
      },
      async ({ id, name, description }, context) => {
        this.logger.debug(`Action request: data.update for ${id} from ${context.connectionId}`);
        
        // Check rate limiting
        if (this.rateLimiter.isRateLimited(context.connectionId)) {
          throw new Error("Rate limit exceeded");
        }
        
        // In a real app, this would update a database
        
        // Invalidate cache
        this.cache.delete(`data:${id}`);
        
        return {
          content: [{
            type: "text",
            text: `Data updated successfully: ${id}`
          }]
        };
      }
    );
  }
  
  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Check if clustering is enabled
    if (this.config.get("clustering.enabled", false) && cluster.isPrimary) {
      this.startCluster();
      return;
    }
    
    // Create HTTP server
    this.createHttpServer();
    
    // Create transport
    this.transport = new HttpServerTransport({ 
      server: this.httpServer,
      cors: {
        origin: "*", // In production, restrict to your domain
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"]
      }
    });
    
    // Connect server to transport
    await this.server.connect(this.transport);
    
    const port = this.config.get("server.port", 3000);
    const host = this.config.get("server.host", "0.0.0.0");
    
    // Start HTTP server
    this.httpServer?.listen(port, host, () => {
      this.logger.info(`MCP server running on ${host}:${port} (${this.config.getEnvironment()} mode)`);
      
      if (cluster.isWorker) {
        this.logger.info(`Worker ${process.pid} started`);
      }
    });
  }
  
  /**
   * Create HTTP server with or without SSL
   */
  private createHttpServer(): void {
    const app = express();
    
    // Add middleware
    this.addMiddleware(app);
    
    // Create HTTP or HTTPS server
    if (this.config.get("ssl.enabled", false)) {
      const sslOptions = {
        cert: fs.readFileSync(this.config.get("ssl.cert", "")),
        key: fs.readFileSync(this.config.get("ssl.key", ""))
      };
      
      this.httpServer = https.createServer(sslOptions, app);
      this.logger.info("Created HTTPS server with SSL");
    } else {
      this.httpServer = http.createServer(app);
      this.logger.info("Created HTTP server");
    }
  }
  
  /**
   * Add middleware to Express app
   */
  private addMiddleware(app: express.Application): void {
    // Add your middleware here
    // Examples: compression, body-parser, etc.
    
    // Health check endpoint
    app.get("/health", (req, res) => {
      res.status(200).json({ status: "ok" });
    });
  }
  
  /**
   * Start cluster mode
   */
  private startCluster(): void {
    const numWorkers = this.config.get("clustering.workers", 0) || os.cpus().length;
    
    this.logger.info(`Starting cluster with ${numWorkers} workers`);
    
    // Fork workers
    for (let i = 0; i < numWorkers; i++) {
      cluster.fork();
    }
    
    // Handle worker events
    cluster.on("exit", (worker, code, signal) => {
      this.logger.warn(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
      
      // Replace the dead worker
      this.logger.info("Starting a new worker");
      cluster.fork();
    });
  }
  
  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (this.transport) {
      await this.server.disconnect();
    }
    
    if (this.httpServer) {
      this.httpServer.close();
    }
    
    this.logger.info("Server stopped");
  }
}

/**
 * Main function
 */
async function main() {
  // Set environment
  process.env.NODE_ENV = process.env.NODE_ENV || "development";
  
  // Create and start the server
  const server = new McpProductionServer();
  
  try {
    await server.start();
    
    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\nReceived SIGINT. Shutting down gracefully...");
      await server.stop();
      process.exit(0);
    });
    
    process.on("SIGTERM", async () => {
      console.log("\nReceived SIGTERM. Shutting down gracefully...");
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Run the server
if (require.main === module) {
  main().catch(console.error);
}

// Export for testing
export { 
  ConfigManager, 
  CacheManager, 
  RateLimiter,
  Logger,
  McpProductionServer
};

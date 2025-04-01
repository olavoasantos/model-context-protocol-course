const n=`/**
 * Basic MCP Example
 * 
 * This example demonstrates the fundamental concepts of Model Context Protocol
 * by creating a simple client and server interaction.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { HttpClientTransport } from "@modelcontextprotocol/sdk/client/http.js";

// Define the port for our MCP server
const PORT = 3000;

/**
 * Start the MCP server
 */
async function startServer() {
  // Create a new MCP server
  const server = new McpServer({
    name: "Basic MCP Server",
    version: "1.0.0"
  });

  // Register a simple resource
  server.resource(
    "greeting",
    "greeting://{name}",
    async (uri, { name }) => {
      console.log(\`Server: Received request for greeting with name: \${name}\`);
      
      return {
        contents: [{
          uri: uri.href,
          text: \`Hello, \${name}! Welcome to MCP.\`,
          metadata: {
            timestamp: new Date().toISOString()
          }
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
 * Create and use an MCP client
 */
async function runClient() {
  // Create a transport for the client
  const transport = new HttpClientTransport(\`http://localhost:\${PORT}\`);
  
  // Create a new MCP client
  const client = new McpClient(transport);
  
  // Connect the client
  await client.connect();
  console.log("Client: Connected to MCP server");
  
  try {
    // Fetch a resource using the client
    const name = "Alice";
    console.log(\`Client: Requesting greeting for \${name}\`);
    
    const resources = await client.fetchResource(\`greeting://\${name}\`);
    
    // Process the response
    console.log("Client: Received response:");
    resources.forEach(resource => {
      console.log(\`- URI: \${resource.uri}\`);
      console.log(\`- Text: \${resource.text}\`);
      console.log(\`- Metadata: \${JSON.stringify(resource.metadata)}\`);
    });
  } finally {
    // Disconnect the client
    await client.disconnect();
    console.log("Client: Disconnected from MCP server");
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
`;export{n as default};

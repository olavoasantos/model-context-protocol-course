const n=`# Section 6: Advanced MCP Features

## Implementing Action Handlers

Action handlers are a powerful feature of MCP that allow clients to execute code on the server. In this section, we'll explore advanced techniques for implementing robust and flexible action handlers.

### Custom Action Types

While basic action handlers are sufficient for many use cases, custom action types can provide more specialized functionality:

\`\`\`typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "Advanced Actions Server",
  version: "1.0.0"
});

// Define a custom action result type
interface DataQueryResult {
  rows: Record<string, unknown>[];
  metadata: {
    totalRows: number;
    queryTime: number;
    columns: string[];
  };
}

// Implement a data query action
server.tool(
  "data.query",
  {
    query: z.string(),
    limit: z.number().int().positive().default(100),
    offset: z.number().int().min(0).default(0),
    format: z.enum(["table", "json", "csv"]).default("table")
  },
  async ({ query, limit, offset, format }) => {
    // Validate the query (simplified example)
    if (!isValidQuery(query)) {
      throw new Error("Invalid query syntax");
    }
    
    // Execute the query (simplified example)
    const startTime = Date.now();
    const result = await executeQuery(query, limit, offset);
    const queryTime = Date.now() - startTime;
    
    // Format the result based on the requested format
    const formattedResult: DataQueryResult = {
      rows: result.rows,
      metadata: {
        totalRows: result.totalCount,
        queryTime,
        columns: Object.keys(result.rows[0] || {})
      }
    };
    
    // Return the result in the requested format
    switch (format) {
      case "table":
        return {
          content: [formatAsTable(formattedResult)]
        };
      case "json":
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(formattedResult, null, 2) 
          }]
        };
      case "csv":
        return {
          content: [{ 
            type: "text", 
            text: formatAsCSV(formattedResult) 
          }]
        };
    }
  }
);

// Helper function to format result as a table
function formatAsTable(result: DataQueryResult): any {
  return {
    type: "table",
    headers: result.metadata.columns,
    rows: result.rows.map(row => 
      result.metadata.columns.map(col => row[col])
    )
  };
}

// Helper function to format result as CSV
function formatAsCSV(result: DataQueryResult): string {
  const headers = result.metadata.columns.join(",");
  const rows = result.rows.map(row => 
    result.metadata.columns.map(col => 
      // Handle values with commas by quoting
      typeof row[col] === "string" && row[col].includes(",") 
        ? \`"\${row[col]}"\` 
        : row[col]
    ).join(",")
  ).join("\\n");
  
  return \`\${headers}\\n\${rows}\`;
}
\`\`\`

### Parameter Validation with Zod

Zod provides powerful validation capabilities that go beyond simple type checking:

\`\`\`typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "Advanced Validation Server",
  version: "1.0.0"
});

// Define a complex schema with nested validation
const userSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username cannot exceed 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  
  email: z.string()
    .email("Invalid email address")
    .refine(email => !email.endsWith("example.com"), {
      message: "example.com emails are not allowed"
    }),
  
  age: z.number()
    .int("Age must be an integer")
    .min(18, "Must be at least 18 years old")
    .optional(),
  
  preferences: z.object({
    theme: z.enum(["light", "dark", "system"]).default("system"),
    notifications: z.boolean().default(true),
    language: z.string().default("en-US")
  }).optional()
});

// Use the schema in an action
server.tool(
  "user.create",
  userSchema.shape, // Extract the shape for the SDK
  async (params) => {
    // params is fully typed based on the schema
    const { username, email, age, preferences } = params;
    
    // Create the user (simplified example)
    const user = await createUser({
      username,
      email,
      age,
      preferences: preferences || {
        theme: "system",
        notifications: true,
        language: "en-US"
      }
    });
    
    return {
      content: [{ 
        type: "text", 
        text: \`User \${username} created successfully with ID \${user.id}\` 
      }]
    };
  }
);

// Validation with transformations
const dateRangeSchema = z.object({
  startDate: z.string()
    .regex(/^\\d{4}-\\d{2}-\\d{2}$/, "Date must be in YYYY-MM-DD format")
    .transform(date => new Date(date)), // Transform string to Date
  
  endDate: z.string()
    .regex(/^\\d{4}-\\d{2}-\\d{2}$/, "Date must be in YYYY-MM-DD format")
    .transform(date => new Date(date)), // Transform string to Date
  
  format: z.enum(["detailed", "summary"]).default("detailed")
}).refine(data => data.startDate <= data.endDate, {
  message: "End date must be after start date",
  path: ["endDate"] // Highlight which field has the error
});

// Use the schema with transformations
server.tool(
  "reports.generate",
  dateRangeSchema.shape,
  async (params) => {
    // startDate and endDate are now Date objects
    const { startDate, endDate, format } = params;
    
    // Generate the report
    const report = await generateReport(startDate, endDate, format);
    
    return {
      content: [{ 
        type: "text", 
        text: report 
      }]
    };
  }
);
\`\`\`

### Complex Action Flows

Some actions may involve multiple steps or complex workflows:

\`\`\`typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "Workflow Server",
  version: "1.0.0"
});

// Action with a multi-step workflow
server.tool(
  "document.process",
  {
    documentId: z.string(),
    operations: z.array(
      z.object({
        type: z.enum(["extract", "summarize", "translate", "analyze"]),
        options: z.record(z.unknown()).optional()
      })
    )
  },
  async ({ documentId, operations }) => {
    // Fetch the document
    const document = await fetchDocument(documentId);
    if (!document) {
      throw new Error(\`Document not found: \${documentId}\`);
    }
    
    // Process each operation in sequence
    let currentContent = document.content;
    const processingSteps: string[] = [];
    
    for (const operation of operations) {
      processingSteps.push(\`Starting operation: \${operation.type}\`);
      
      try {
        // Process based on operation type
        switch (operation.type) {
          case "extract":
            currentContent = await extractContent(currentContent, operation.options);
            break;
          case "summarize":
            currentContent = await summarizeContent(currentContent, operation.options);
            break;
          case "translate":
            currentContent = await translateContent(currentContent, operation.options);
            break;
          case "analyze":
            currentContent = await analyzeContent(currentContent, operation.options);
            break;
        }
        
        processingSteps.push(\`Completed operation: \${operation.type}\`);
      } catch (error) {
        processingSteps.push(\`Failed operation: \${operation.type} - \${error.message}\`);
        throw new Error(\`Processing failed at step '\${operation.type}': \${error.message}\`);
      }
    }
    
    // Return the processed content and processing log
    return {
      content: [
        { 
          type: "text", 
          text: currentContent 
        },
        {
          type: "text",
          text: \`Processing log:\\n\${processingSteps.join('\\n')}\`
        }
      ]
    };
  }
);

// Implement a stateful workflow with progress tracking
class WorkflowManager {
  private workflows: Map<string, Workflow> = new Map();
  
  createWorkflow(id: string, steps: WorkflowStep[]): string {
    const workflowId = id || generateId();
    
    this.workflows.set(workflowId, {
      id: workflowId,
      steps,
      currentStep: 0,
      status: "pending",
      results: [],
      startTime: Date.now(),
      lastUpdated: Date.now()
    });
    
    return workflowId;
  }
  
  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }
  
  async advanceWorkflow(id: string): Promise<Workflow> {
    const workflow = this.getWorkflow(id);
    if (!workflow) {
      throw new Error(\`Workflow not found: \${id}\`);
    }
    
    if (workflow.status === "completed" || workflow.status === "failed") {
      return workflow;
    }
    
    const currentStep = workflow.steps[workflow.currentStep];
    
    try {
      // Update status
      workflow.status = "processing";
      workflow.lastUpdated = Date.now();
      
      // Execute the current step
      const result = await currentStep.execute();
      
      // Store the result
      workflow.results.push(result);
      
      // Move to the next step
      workflow.currentStep++;
      
      // Check if workflow is complete
      if (workflow.currentStep >= workflow.steps.length) {
        workflow.status = "completed";
      } else {
        workflow.status = "pending";
      }
    } catch (error) {
      workflow.status = "failed";
      workflow.error = error.message;
    }
    
    workflow.lastUpdated = Date.now();
    return workflow;
  }
}

interface Workflow {
  id: string;
  steps: WorkflowStep[];
  currentStep: number;
  status: "pending" | "processing" | "completed" | "failed";
  results: any[];
  startTime: number;
  lastUpdated: number;
  error?: string;
}

interface WorkflowStep {
  name: string;
  execute: () => Promise<any>;
}

// Create a workflow manager instance
const workflowManager = new WorkflowManager();

// Implement workflow actions
server.tool(
  "workflow.create",
  {
    name: z.string(),
    steps: z.array(
      z.object({
        type: z.string(),
        parameters: z.record(z.unknown()).optional()
      })
    )
  },
  async ({ name, steps }) => {
    // Convert step definitions to executable steps
    const executableSteps: WorkflowStep[] = steps.map(step => ({
      name: step.type,
      execute: async () => {
        // Execute the step based on type
        switch (step.type) {
          case "fetch":
            return await fetchData(step.parameters);
          case "process":
            return await processData(step.parameters);
          case "store":
            return await storeData(step.parameters);
          default:
            throw new Error(\`Unknown step type: \${step.type}\`);
        }
      }
    }));
    
    // Create the workflow
    const workflowId = workflowManager.createWorkflow(
      \`\${name}-\${Date.now()}\`,
      executableSteps
    );
    
    return {
      content: [{ 
        type: "text", 
        text: \`Workflow created with ID: \${workflowId}\` 
      }]
    };
  }
);

server.tool(
  "workflow.advance",
  {
    workflowId: z.string()
  },
  async ({ workflowId }) => {
    // Advance the workflow by one step
    const workflow = await workflowManager.advanceWorkflow(workflowId);
    
    // Return the current status
    return {
      content: [{ 
        type: "text", 
        text: \`Workflow \${workflowId} status: \${workflow.status}\\n\` +
              \`Completed steps: \${workflow.currentStep} of \${workflow.steps.length}\\n\` +
              (workflow.error ? \`Error: \${workflow.error}\` : '')
      }]
    };
  }
);

server.tool(
  "workflow.status",
  {
    workflowId: z.string()
  },
  async ({ workflowId }) => {
    // Get the workflow status
    const workflow = workflowManager.getWorkflow(workflowId);
    
    if (!workflow) {
      throw new Error(\`Workflow not found: \${workflowId}\`);
    }
    
    // Calculate duration
    const duration = workflow.lastUpdated - workflow.startTime;
    
    // Return detailed status
    return {
      content: [{ 
        type: "text", 
        text: \`Workflow: \${workflowId}\\n\` +
              \`Status: \${workflow.status}\\n\` +
              \`Progress: \${workflow.currentStep} of \${workflow.steps.length} steps\\n\` +
              \`Duration: \${formatDuration(duration)}\\n\` +
              \`Results: \${JSON.stringify(workflow.results, null, 2)}\\n\` +
              (workflow.error ? \`Error: \${workflow.error}\` : '')
      }]
    };
  }
);

// Helper function to format duration
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  return \`\${hours}h \${minutes % 60}m \${seconds % 60}s\`;
}
\`\`\`

## Content Block Management

Content blocks are the primary way that MCP servers return information to clients. Advanced content block management techniques can enhance the user experience.

### Working with Different Content Types

MCP supports various content types beyond simple text:

\`\`\`typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "Content Types Server",
  version: "1.0.0"
});

// Text content
server.tool(
  "content.text",
  { message: z.string() },
  async ({ message }) => ({
    content: [{ 
      type: "text", 
      text: message 
    }]
  })
);

// Table content
server.tool(
  "content.table",
  {
    headers: z.array(z.string()),
    rows: z.array(z.array(z.unknown()))
  },
  async ({ headers, rows }) => ({
    content: [{ 
      type: "table", 
      headers,
      rows
    }]
  })
);

// Image content (URL reference)
server.tool(
  "content.image",
  {
    url: z.string().url(),
    altText: z.string().optional()
  },
  async ({ url, altText }) => ({
    content: [{ 
      type: "image", 
      url,
      altText: altText || "Image"
    }]
  })
);

// Code content with syntax highlighting
server.tool(
  "content.code",
  {
    code: z.string(),
    language: z.string().default("typescript")
  },
  async ({ code, language }) => ({
    content: [{ 
      type: "code", 
      code,
      language
    }]
  })
);

// Mixed content types
server.tool(
  "content.mixed",
  { query: z.string() },
  async ({ query }) => {
    // Generate different content types based on the query
    const results = await generateMixedContent(query);
    
    return {
      content: [
        { 
          type: "text", 
          text: \`Results for query: \${query}\` 
        },
        ...results
      ]
    };
  }
);

// Helper function to generate mixed content
async function generateMixedContent(query: string): Promise<any[]> {
  // This is a simplified example
  const content = [];
  
  // Add text content
  content.push({
    type: "text",
    text: \`Here's information about \${query}\`
  });
  
  // Add table content if applicable
  if (query.includes("data") || query.includes("stats")) {
    content.push({
      type: "table",
      headers: ["Category", "Value", "Change"],
      rows: [
        ["Revenue", "$1.2M", "+15%"],
        ["Costs", "$800K", "-5%"],
        ["Profit", "$400K", "+25%"]
      ]
    });
  }
  
  // Add code example if applicable
  if (query.includes("code") || query.includes("example")) {
    content.push({
      type: "code",
      code: \`function example() {\\n  console.log("Hello, \${query}");\\n}\`,
      language: "javascript"
    });
  }
  
  // Add image if applicable
  if (query.includes("image") || query.includes("picture")) {
    content.push({
      type: "image",
      url: "https://example.com/images/sample.jpg",
      altText: \`Sample image for \${query}\`
    });
  }
  
  return content;
}
\`\`\`

### Content Transformation

Sometimes content needs to be transformed before being sent to the client:

\`\`\`typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { marked } from "marked"; // Markdown parser

const server = new McpServer({
  name: "Content Transformation Server",
  version: "1.0.0"
});

// Markdown to HTML transformation
server.tool(
  "transform.markdown",
  { markdown: z.string() },
  async ({ markdown }) => {
    // Convert markdown to HTML
    const html = marked(markdown);
    
    return {
      content: [
        { 
          type: "text", 
          text: html 
        },
        {
          type: "metadata",
          format: "html"
        }
      ]
    };
  }
);

// JSON to table transformation
server.tool(
  "transform.jsonToTable",
  { 
    json: z.string(),
    keyField: z.string().optional()
  },
  async ({ json, keyField }) => {
    try {
      // Parse the JSON
      const data = JSON.parse(json);
      
      // Handle array of objects
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
        // Extract headers from the first object
        const headers = Object.keys(data[0]);
        
        // Create rows
        const rows = data.map(item => headers.map(header => item[header]));
        
        return {
          content: [{ 
            type: "table", 
            headers,
            rows
          }]
        };
      }
      
      // Handle object with nested objects
      if (!Array.isArray(data) && typeof data === "object") {
        // Use keyField as the first column if provided
        const keyHeader = keyField || "Key";
        const valueHeader = "Value";
        const headers = [keyHeader, valueHeader];
        
        // Create rows
        const rows = Object.entries(data).map(([key, value]) => [
          key,
          typeof value === "object" ? JSON.stringify(value) : value
        ]);
        
        return {
          content: [{ 
            type: "table", 
            headers,
            rows
          }]
        };
      }
      
      // Fallback for other JSON structures
      return {
        content: [{ 
          type: "text", 
          text: \`Unable to convert to table: \${json}\` 
        }]
      };
    } catch (error) {
      throw new Error(\`Invalid JSON: \${error.message}\`);
    }
  }
);

// CSV to table transformation
server.tool(
  "transform.csvToTable",
  { csv: z.string() },
  async ({ csv }) => {
    try {
      // Parse CSV (simple implementation)
      const lines = csv.split("\\n").map(line => line.trim()).filter(Boolean);
      
      if (lines.length === 0) {
        throw new Error("Empty CSV");
      }
      
      // Extract headers from the first line
      const headers = parseCSVLine(lines[0]);
      
      // Parse data rows
      const rows = lines.slice(1).map(line => parseCSVLine(line));
      
      return {
        content: [{ 
          type: "table", 
          headers,
          rows
        }]
      };
    } catch (error) {
      throw new Error(\`CSV parsing error: \${error.message}\`);
    }
  }
);

// Helper function to parse a CSV line
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current);
  
  return result;
}
\`\`\`

### Efficient Content Delivery

For large content, efficient delivery strategies are important:

\`\`\`typescript
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "Efficient Content Server",
  version: "1.0.0"
});

// Chunked content delivery
server.resource(
  "large-document",
  new ResourceTemplate("docs://{documentId}"),
  async (uri, { documentId }, context) => {
    // Get pagination parameters
    const url = new URL(uri.href);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "1000", 10);
    
    // Fetch the document
    const document = await fetchLargeDocument(documentId);
    
    // Split into chunks
    const chunks = chunkContent(document.content, pageSize);
    
    // Calculate pagination
    const totalPages = chunks.length;
    const currentPage = Math.min(page, totalPages);
    const chunk = chunks[currentPage - 1] || "";
    
    // Create nextPage URI if needed
    let nextPage: string | undefined;
    if (currentPage < totalPages) {
      const nextPageUrl = new URL(uri.href);
      nextPageUrl.searchParams.set("page", String(currentPage + 1));
      nextPage = nextPageUrl.href;
    }
    
    return {
      contents: [{
        uri: \`\${uri.href}?page=\${currentPage}\`,
        text: chunk,
        metadata: {
          documentId,
          title: document.title,
          page: currentPage,
          totalPages,
          chunkSize: pageSize
        }
      }],
      nextPage
    };
  }
);

// Streaming content delivery
server.streamingResource(
  "live-feed",
  new ResourceTemplate("feed://{topic}"),
  async (uri, { topic }, stream) => {
    // Subscribe to the feed
    const subscription = await subscribeTopic(topic);
    
    // Send initial state
    const initialState = await getTopicState(topic);
    await stream.send([{
      uri: \`feed://\${topic}/initial\`,
      text: JSON.stringify(initialState),
      metadata: {
        topic,
        timestamp: Date.now(),
        type: "initial"
      }
    }]);
    
    // Set up event handler for new items
    subscription.on("update", async (update) => {
      await stream.send([{
        uri: \`feed://\${topic}/update/\${update.id}\`,
        text: JSON.stringify(update),
        metadata: {
          topic,
          timestamp: update.timestamp,
          type: "update",
          id: update.id
        }
      }]);
    });
    
    // Clean up when the stream is closed
    stream.onClose(() => {
      subscription.unsubscribe();
    });
  }
);

// Lazy-loaded content
server.resource(
  "lazy-content",
  new ResourceTemplate("lazy://{section}"),
  async (uri, { section }) => {
    // Get the depth parameter
    const url = new URL(uri.href);
    const depth = parseInt(url.searchParams.get("depth") || "1", 10);
    const maxDepth = 3;
    
    // Fetch the content for this section
    const content = await fetchSectionContent(section, depth);
    
    // Generate URIs for deeper content if not at max depth
    let text = content.text;
    
    if (depth < maxDepth) {
      // Add references to deeper content
      const subsections = await getSubsections(section);
      
      if (subsections.length > 0) {
        text += "\\n\\nSubsections:\\n";
        
        for (const subsection of subsections) {
          const subsectionUri = \`lazy://\${subsection}?depth=\${depth + 1}\`;
          text += \`- \${subsection}: \${subsectionUri}\\n\`;
        }
      }
    }
    
    return {
      contents: [{
        uri: uri.href,
        text,
        metadata: {
          section,
          depth,
          hasMore: depth < maxDepth
        }
      }]
    };
  }
);
\`\`\`

## Context Window Optimization

Optimizing context window usage is crucial for effective LLM applications.

### Strategies for Context Reduction

Several strategies can help reduce context size:

\`\`\`typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "Context Optimization Server",
  version: "1.0.0"
});

// Content summarization
server.tool(
  "context.summarize",
  {
    text: z.string(),
    maxLength: z.number().int().positive().default(200)
  },
  async ({ text, maxLength }) => {
    // Simple extractive summarization (in a real implementation, 
    // you might use an LLM or a dedicated summarization algorithm)
    const summary = extractiveSummarize(text, maxLength);
    
    return {
      content: [{ 
        type: "text", 
        text: summary 
      }]
    };
  }
);

// Helper function for extractive summarization
function extractiveSummarize(text: string, maxLength: number): string {
  // Split into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  
  if (sentences.length === 0) {
    return text.substring(0, maxLength);
  }
  
  // Score sentences by importance (simple heuristic)
  const scores = sentences.map(sentence => {
    // Score based on length and position
    const lengthScore = Math.min(sentence.length / 20, 1);
    const positionScore = 1 - (sentences.indexOf(sentence) / sentences.length);
    
    return lengthScore * 0.5 + positionScore * 0.5;
  });
  
  // Sort sentences by score
  const rankedSentences = sentences
    .map((sentence, index) => ({ sentence, score: scores[index] }))
    .sort((a, b) => b.score - a.score);
  
  // Take top sentences until we reach maxLength
  let summary = "";
  let currentLength = 0;
  
  for (const { sentence } of rankedSentences) {
    if (currentLength + sentence.length <= maxLength) {
      summary += sentence;
      currentLength += sentence.length;
    } else {
      break;
    }
  }
  
  return summary;
}

// Content filtering
server.tool(
  "context.filter",
  {
    text: z.string(),
    keywords: z.array(z.string()),
    contextBefore: z.number().int().min(0).default(1),
    contextAfter: z.number().int().min(0).default(1)
  },
  async ({ text, keywords, contextBefore, contextAfter }) => {
    // Split text into paragraphs
    const paragraphs = text.split(/\\n\\s*\\n/);
    
    // Find paragraphs containing keywords
    const matches: number[] = [];
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].toLowerCase();
      
      if (keywords.some(keyword => paragraph.includes(keyword.toLowerCase()))) {
        matches.push(i);
      }
    }
    
    // Extract matching paragraphs with context
    const filteredParagraphs: string[] = [];
    const included = new Set<number>();
    
    for (const match of matches) {
      // Add context before
      for (let i = Math.max(0, match - contextBefore); i < match; i++) {
        if (!included.has(i)) {
          filteredParagraphs.push(paragraphs[i]);
          included.add(i);
        }
      }
      
      // Add matching paragraph
      if (!included.has(match)) {
        filteredParagraphs.push(paragraphs[match]);
        included.add(match);
      }
      
      // Add context after
      for (let i = match + 1; i <= Math.min(paragraphs.length - 1, match + contextAfter); i++) {
        if (!included.has(i)) {
          filteredParagraphs.push(paragraphs[i]);
          included.add(i);
        }
      }
    }
    
    // Join filtered paragraphs
    const filteredText = filteredParagraphs.join("\\n\\n");
    
    return {
      content: [{ 
        type: "text", 
        text: filteredText 
      }]
    };
  }
);

// Content truncation with indicators
server.tool(
  "context.truncate",
  {
    text: z.string(),
    maxTokens: z.number().int().positive(),
    strategy: z.enum(["start", "end", "middle", "both"]).default("end")
  },
  async ({ text, maxTokens, strategy }) => {
    // Estimate tokens (simplified)
    const estimatedTokens = Math.ceil(text.length / 4);
    
    if (estimatedTokens <= maxTokens) {
      return {
        content: [{ type: "text", text }]
      };
    }
    
    // Calculate how much to keep
    const keepRatio = maxTokens / estimatedTokens;
    const keepChars = Math.floor(text.length * keepRatio);
    
    let truncatedText: string;
    
    switch (strategy) {
      case "start":
        // Keep the start, truncate the end
        truncatedText = text.substring(0, keepChars) + "... [truncated]";
        break;
      case "end":
        // Keep the end, truncate the start
        truncatedText = "[truncated] ... " + text.substring(text.length - keepChars);
        break;
      case "middle":
        // Keep the start and end, truncate the middle
        const halfKeep = Math.floor(keepChars / 2);
        truncatedText = text.substring(0, halfKeep) + 
                        " ... [truncated] ... " + 
                        text.substring(text.length - halfKeep);
        break;
      case "both":
        // Truncate both start and end
        const middleStart = Math.floor((text.length - keepChars) / 2);
        truncatedText = "[truncated] ... " + 
                        text.substring(middleStart, middleStart + keepChars) + 
                        " ... [truncated]";
        break;
    }
    
    return {
      content: [{ 
        type: "text", 
        text: truncatedText 
      }]
    };
  }
);
\`\`\`

### Priority-based Context Management

Not all content is equally important. Priority-based management helps focus on what matters:

\`\`\`typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Context item with priority
interface PrioritizedContent {
  text: string;
  priority: number;
  metadata?: Record<string, unknown>;
}

class PriorityContextManager {
  private items: PrioritizedContent[] = [];
  private maxTokens: number;
  
  constructor(maxTokens: number = 8000) {
    this.maxTokens = maxTokens;
  }
  
  // Add content with priority
  addContent(text: string, priority: number, metadata?: Record<string, unknown>): void {
    this.items.push({ text, priority, metadata });
    this.optimize();
  }
  
  // Get optimized context
  getContext(): string {
    return this.items.map(item => item.text).join("\\n\\n");
  }
  
  // Optimize context to fit within token limit
  private optimize(): void {
    // Estimate total tokens
    const totalTokens = this.estimateTokens(this.getContext());
    
    if (totalTokens <= this.maxTokens) {
      return; // No optimization needed
    }
    
    // Sort by priority (highest first)
    this.items.sort((a, b) => b.priority - a.priority);
    
    // Keep removing lowest priority items until we fit
    while (this.estimateTokens(this.getContext()) > this.maxTokens && this.items.length > 0) {
      // Remove the lowest priority item (last item after sorting)
      this.items.pop();
    }
  }
  
  // Estimate tokens in text
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

const server = new McpServer({
  name: "Priority Context Server",
  version: "1.0.0"
});

// Session-based context manager
const sessionContexts = new Map<string, PriorityContextManager>();

// Add content to context
server.tool(
  "context.add",
  {
    text: z.string(),
    priority: z.number().min(1).max(10).default(5),
    metadata: z.record(z.unknown()).optional()
  },
  async ({ text, priority, metadata }, context) => {
    const sessionId = context.connectionId;
    
    // Create context manager if it doesn't exist
    if (!sessionContexts.has(sessionId)) {
      sessionContexts.set(sessionId, new PriorityContextManager());
    }
    
    // Add content
    const contextManager = sessionContexts.get(sessionId)!;
    contextManager.addContent(text, priority, metadata);
    
    return {
      content: [{ 
        type: "text", 
        text: "Content added to context" 
      }]
    };
  }
);

// Get current context
server.tool(
  "context.get",
  {},
  async (_, context) => {
    const sessionId = context.connectionId;
    const contextManager = sessionContexts.get(sessionId);
    
    if (!contextManager) {
      return {
        content: [{ 
          type: "text", 
          text: "No context available" 
        }]
      };
    }
    
    return {
      content: [{ 
        type: "text", 
        text: contextManager.getContext() 
      }]
    };
  }
);

// Clear context
server.tool(
  "context.clear",
  {},
  async (_, context) => {
    const sessionId = context.connectionId;
    sessionContexts.delete(sessionId);
    
    return {
      content: [{ 
        type: "text", 
        text: "Context cleared" 
      }]
    };
  }
);
\`\`\`

### Context Compression Techniques

Compression techniques can help fit more information into limited context windows:

\`\`\`typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "Context Compression Server",
  version: "1.0.0"
});

// Semantic compression
server.tool(
  "compress.semantic",
  {
    text: z.string(),
    compressionLevel: z.enum(["low", "medium", "high"]).default("medium")
  },
  async ({ text, compressionLevel }) => {
    // Apply semantic compression (in a real implementation, 
    // you might use an LLM or specialized algorithms)
    const compressed = semanticCompress(text, compressionLevel);
    
    return {
      content: [{ 
        type: "text", 
        text: compressed 
      }]
    };
  }
);

// Helper function for semantic compression
function semanticCompress(text: string, level: string): string {
  // Split into paragraphs
  const paragraphs = text.split(/\\n\\s*\\n/);
  
  // Apply different compression levels
  switch (level) {
    case "low":
      // Remove redundant sentences within paragraphs
      return paragraphs.map(removeRedundantSentences).join("\\n\\n");
    
    case "medium":
      // Summarize each paragraph
      return paragraphs.map(summarizeParagraph).join("\\n\\n");
    
    case "high":
      // Extract key information only
      return extractKeyInformation(paragraphs);
  }
}

// Remove redundant sentences
function removeRedundantSentences(paragraph: string): string {
  // Split into sentences
  const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [];
  
  if (sentences.length <= 2) {
    return paragraph; // Too short to compress
  }
  
  // Simple redundancy detection (in a real implementation, use more sophisticated methods)
  const uniqueSentences: string[] = [];
  const seenConcepts = new Set<string>();
  
  for (const sentence of sentences) {
    // Extract key concepts (simplified as words)
    const words = sentence.toLowerCase().match(/\\b\\w{5,}\\b/g) || [];
    
    // Check if this sentence adds new concepts
    const newConcepts = words.filter(word => !seenConcepts.has(word));
    
    if (newConcepts.length > 0 || uniqueSentences.length === 0) {
      uniqueSentences.push(sentence);
      newConcepts.forEach(concept => seenConcepts.add(concept));
    }
  }
  
  return uniqueSentences.join(" ");
}

// Summarize a paragraph
function summarizeParagraph(paragraph: string): string {
  // Split into sentences
  const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [];
  
  if (sentences.length <= 1) {
    return paragraph; // Too short to summarize
  }
  
  // Simple summarization: first sentence + last sentence if different
  if (sentences.length === 2) {
    return sentences.join(" ");
  }
  
  const firstSentence = sentences[0];
  const lastSentence = sentences[sentences.length - 1];
  
  // Check if first and last sentences are significantly different
  const firstWords = new Set(firstSentence.toLowerCase().match(/\\b\\w{5,}\\b/g) || []);
  const lastWords = new Set(lastSentence.toLowerCase().match(/\\b\\w{5,}\\b/g) || []);
  
  // Count unique words in last sentence
  let uniqueCount = 0;
  for (const word of lastWords) {
    if (!firstWords.has(word)) {
      uniqueCount++;
    }
  }
  
  // If last sentence adds new information, include it
  if (uniqueCount >= 2) {
    return \`\${firstSentence} \${lastSentence}\`;
  }
  
  return firstSentence;
}

// Extract key information
function extractKeyInformation(paragraphs: string[]): string {
  // Take first paragraph (usually contains key information)
  const firstParagraph = paragraphs[0];
  
  // Extract key sentences from other paragraphs
  const keyPoints: string[] = [];
  
  for (let i = 1; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [];
    
    // Look for sentences with key indicators
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      
      // Check for key information indicators
      if (
        lower.includes("important") ||
        lower.includes("significant") ||
        lower.includes("key") ||
        lower.includes("critical") ||
        lower.includes("essential") ||
        lower.includes("notably") ||
        lower.includes("specifically") ||
        lower.match(/\\b(first|second|third|finally)\\b/)
      ) {
        keyPoints.push(sentence);
        break; // One key point per paragraph
      }
    }
    
    // If no key indicators, take the first sentence
    if (keyPoints.length <= i - 1 && sentences.length > 0) {
      keyPoints.push(sentences[0]);
    }
  }
  
  // Combine first paragraph with key points
  return firstParagraph + "\\n\\nKey points:\\n- " + keyPoints.join("\\n- ");
}

// Information density optimization
server.tool(
  "compress.density",
  {
    text: z.string()
  },
  async ({ text }) => {
    // Apply information density optimization
    const optimized = optimizeInformationDensity(text);
    
    return {
      content: [{ 
        type: "text", 
        text: optimized 
      }]
    };
  }
);

// Helper function for information density optimization
function optimizeInformationDensity(text: string): string {
  // Replace common phrases with shorter equivalents
  const replacements: [RegExp, string][] = [
    [/in order to/g, "to"],
    [/due to the fact that/g, "because"],
    [/at this point in time/g, "now"],
    [/in the event that/g, "if"],
    [/on the grounds that/g, "because"],
    [/in the near future/g, "soon"],
    [/a large number of/g, "many"],
    [/the vast majority of/g, "most"],
    [/in spite of the fact that/g, "although"],
    [/with regard to/g, "about"],
    [/it should be noted that/g, "note that"],
    [/for the purpose of/g, "for"],
    [/in the process of/g, "while"],
    [/in close proximity to/g, "near"],
    [/in a timely manner/g, "promptly"],
    [/at the present time/g, "now"],
    [/in the absence of/g, "without"],
    [/in the vicinity of/g, "near"],
    [/in the course of/g, "during"],
    [/in the aftermath of/g, "after"]
  ];
  
  let result = text;
  
  // Apply all replacements
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  
  // Remove redundant adverbs
  result = result.replace(/\\b(very|extremely|really|quite|basically|actually|literally)\\s+/g, "");
  
  // Replace "be able to" with "can"
  result = result.replace(/\\b(is|are|was|were) able to\\b/g, "can");
  
  // Use contractions
  result = result
    .replace(/\\b(it is)\\b/g, "it's")
    .replace(/\\b(that is)\\b/g, "that's")
    .replace(/\\b(there is)\\b/g, "there's")
    .replace(/\\b(he is)\\b/g, "he's")
    .replace(/\\b(she is)\\b/g, "she's")
    .replace(/\\b(they are)\\b/g, "they're")
    .replace(/\\b(we are)\\b/g, "we're")
    .replace(/\\b(you are)\\b/g, "you're")
    .replace(/\\b(do not)\\b/g, "don't")
    .replace(/\\b(does not)\\b/g, "doesn't")
    .replace(/\\b(did not)\\b/g, "didn't")
    .replace(/\\b(is not)\\b/g, "isn't")
    .replace(/\\b(are not)\\b/g, "aren't")
    .replace(/\\b(would not)\\b/g, "wouldn't")
    .replace(/\\b(could not)\\b/g, "couldn't")
    .replace(/\\b(should not)\\b/g, "shouldn't")
    .replace(/\\b(will not)\\b/g, "won't")
    .replace(/\\b(have not)\\b/g, "haven't")
    .replace(/\\b(has not)\\b/g, "hasn't");
  
  return result;
}
\`\`\`

## Error Handling and Recovery

Robust error handling is essential for reliable MCP applications.

### Robust Error Management

Comprehensive error handling improves reliability:

\`\`\`typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { McpError } from "@modelcontextprotocol/sdk/shared";

// Custom error classes
class ResourceNotFoundError extends McpError {
  constructor(resourceUri: string) {
    super(
      \`Resource not found: \${resourceUri}\`,
      "resource_not_found",
      { uri: resourceUri }
    );
    this.name = "ResourceNotFoundError";
  }
}

class ActionFailedError extends McpError {
  constructor(action: string, reason: string, details?: unknown) {
    super(
      \`Action '\${action}' failed: \${reason}\`,
      "action_failed",
      { action, reason, details }
    );
    this.name = "ActionFailedError";
  }
}

class ValidationError extends McpError {
  constructor(message: string, details?: unknown) {
    super(
      \`Validation error: \${message}\`,
      "validation_error",
      details
    );
    this.name = "ValidationError";
  }
}

class DatabaseError extends McpError {
  constructor(operation: string, error: Error) {
    super(
      \`Database error during \${operation}: \${error.message}\`,
      "database_error",
      { originalError: error.message }
    );
    this.name = "DatabaseError";
  }
}

// Error handling middleware
function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  return operation().catch(error => {
    // Log the error
    console.error(\`Error in \${context}:\`, error);
    
    // Transform known errors
    if (error instanceof McpError) {
      // Pass through MCP errors
      throw error;
    } else if (error.code === "ECONNREFUSED") {
      // Database connection errors
      throw new DatabaseError("connection", error);
    } else if (error.name === "ZodError") {
      // Validation errors
      throw new ValidationError(error.message, error.errors);
    } else {
      // Unknown errors
      throw new McpError(
        \`Unexpected error in \${context}: \${error.message}\`,
        "unexpected_error",
        { stack: error.stack }
      );
    }
  });
}

const server = new McpServer({
  name: "Error Handling Server",
  version: "1.0.0",
  
  // Global error handler
  onError: (error, context) => {
    // Log all errors
    console.error(\`MCP Error:\`, {
      error,
      connectionId: context?.connectionId,
      timestamp: new Date().toISOString()
    });
    
    // Report severe errors
    if (error.code === "unexpected_error" || error.code === "database_error") {
      reportErrorToMonitoring(error, context);
    }
  }
});

// Resource with error handling
server.resource(
  "document",
  "docs://{documentId}",
  async (uri, { documentId }) => {
    return withErrorHandling(async () => {
      // Attempt to fetch the document
      const document = await fetchDocument(documentId);
      
      if (!document) {
        throw new ResourceNotFoundError(uri.href);
      }
      
      return {
        contents: [{
          uri: uri.href,
          text: document.content,
          metadata: {
            title: document.title,
            author: document.author,
            lastUpdated: document.lastUpdated
          }
        }]
      };
    }, \`fetchDocument(\${documentId})\`);
  }
);

// Action with error handling
server.tool(
  "user.update",
  {
    userId: z.string(),
    updates: z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      settings: z.record(z.unknown()).optional()
    })
  },
  async ({ userId, updates }) => {
    return withErrorHandling(async () => {
      // Validate user exists
      const user = await getUser(userId);
      
      if (!user) {
        throw new ValidationError(\`User not found: \${userId}\`);
      }
      
      // Validate email is not taken
      if (updates.email && updates.email !== user.email) {
        const emailExists = await checkEmailExists(updates.email);
        
        if (emailExists) {
          throw new ValidationError(\`Email already in use: \${updates.email}\`);
        }
      }
      
      // Perform the update
      try {
        const updatedUser = await updateUser(userId, updates);
        
        return {
          content: [{ 
            type: "text", 
            text: \`User \${updatedUser.name} updated successfully\` 
          }]
        };
      } catch (error) {
        throw new ActionFailedError("user.update", error.message, { userId });
      }
    }, \`updateUser(\${userId})\`);
  }
);

// Helper function to report errors to monitoring service
function reportErrorToMonitoring(error: McpError, context?: any): void {
  // In a real implementation, this would send the error to a monitoring service
  console.error("CRITICAL ERROR REPORTED:", {
    name: error.name,
    message: error.message,
    code: error.code,
    details: error.details,
    context,
    timestamp: new Date().toISOString()
  });
}
\`\`\`

### Graceful Degradation

When errors occur, graceful degradation helps maintain functionality:

\`\`\`typescript
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "Graceful Degradation Server",
  version: "1.0.0"
});

// Fallback content for when primary content is unavailable
server.resource(
  "article",
  new ResourceTemplate("articles://{articleId}"),
  async (uri, { articleId }) => {
    try {
      // Try to fetch the full article
      const article = await fetchArticle(articleId);
      
      return {
        contents: [{
          uri: uri.href,
          text: article.content,
          metadata: {
            title: article.title,
            author: article.author,
            published: article.publishedDate
          }
        }]
      };
    } catch (error) {
      console.error(\`Error fetching article \${articleId}:\`, error);
      
      try {
        // Fall back to cached summary
        const summary = await fetchArticleSummary(articleId);
        
        return {
          contents: [{
            uri: uri.href,
            text: \`[SUMMARY ONLY] \${summary}\`,
            metadata: {
              isSummary: true,
              reason: "Full article unavailable"
            }
          }]
        };
      } catch (summaryError) {
        console.error(\`Error fetching summary for \${articleId}:\`, summaryError);
        
        // Ultimate fallback: return minimal information
        return {
          contents: [{
            uri: uri.href,
            text: \`Article \${articleId} is currently unavailable. Please try again later.\`,
            metadata: {
              isUnavailable: true,
              articleId
            }
          }]
        };
      }
    }
  }
);

// Tiered action execution with fallbacks
server.tool(
  "search",
  {
    query: z.string(),
    maxResults: z.number().int().positive().default(5)
  },
  async ({ query, maxResults }) => {
    try {
      // Try primary search service
      const results = await primarySearch(query, maxResults);
      
      return {
        content: [{ 
          type: "text", 
          text: formatSearchResults(results, "primary") 
        }]
      };
    } catch (primaryError) {
      console.error(\`Primary search failed:\`, primaryError);
      
      try {
        // Fall back to secondary search service
        const results = await secondarySearch(query, maxResults);
        
        return {
          content: [{ 
            type: "text", 
            text: formatSearchResults(results, "secondary") 
          }]
        };
      } catch (secondaryError) {
        console.error(\`Secondary search failed:\`, secondaryError);
        
        try {
          // Fall back to cached results
          const results = await cachedSearch(query, maxResults);
          
          return {
            content: [{ 
              type: "text", 
              text: formatSearchResults(results, "cached") 
            }]
          };
        } catch (cacheError) {
          console.error(\`Cached search failed:\`, cacheError);
          
          // Ultimate fallback: return empty results with explanation
          return {
            content: [{ 
              type: "text", 
              text: \`Search is currently unavailable. Please try again later.\\n\\nYour query was: \${query}\` 
            }]
          };
        }
      }
    }
  }
);

// Helper function to format search results
function formatSearchResults(results: any[], source: string): string {
  if (results.length === 0) {
    return \`No results found (using \${source} search)\`;
  }
  
  const header = \`Search results (using \${source} search):\\n\\n\`;
  
  const formattedResults = results.map((result, index) => 
    \`\${index + 1}. \${result.title}\\n   \${result.url}\\n   \${result.snippet}\`
  ).join('\\n\\n');
  
  return header + formattedResults;
}
\`\`\`

### Recovery Strategies

When failures occur, recovery strategies help restore normal operation:

\`\`\`typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Circuit breaker pattern
class CircuitBreaker {
  private failures: number = 0;
  private lastFailure: number = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 30000,
    private halfOpenTimeout: number = 5000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === "open") {
      // Check if timeout has elapsed
      const now = Date.now();
      if (now - this.lastFailure > this.timeout) {
        this.state = "half-open";
      } else {
        throw new Error("Circuit is open");
      }
    }
    
    try {
      // Execute the operation
      const result = await operation();
      
      // Reset on success
      if (this.state === "half-open") {
        this.reset();
      }
      
      return result;
    } catch (error) {
      // Record failure
      this.failures++;
      this.lastFailure = Date.now();
      
      // Check if threshold is reached
      if (this.state === "closed" && this.failures >= this.threshold) {
        this.state = "open";
      } else if (this.state === "half-open") {
        this.state = "open";
      }
      
      throw error;
    }
  }
  
  reset(): void {
    this.failures = 0;
    this.state = "closed";
  }
  
  getState(): string {
    return this.state;
  }
}

// Create circuit breakers for different services
const databaseCircuitBreaker = new CircuitBreaker(3, 60000);
const searchCircuitBreaker = new CircuitBreaker(5, 30000);
const authCircuitBreaker = new CircuitBreaker(2, 120000);

const server = new McpServer({
  name: "Recovery Server",
  version: "1.0.0"
});

// Database operation with circuit breaker
server.tool(
  "database.query",
  {
    query: z.string()
  },
  async ({ query }) => {
    try {
      // Execute with circuit breaker
      const results = await databaseCircuitBreaker.execute(async () => {
        return await executeQuery(query);
      });
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify(results, null, 2) 
        }]
      };
    } catch (error) {
      if (error.message === "Circuit is open") {
        // Circuit is open, return cached or fallback results
        return {
          content: [{ 
            type: "text", 
            text: "Database service is currently unavailable. Using cached results (may be outdated)." 
          }]
        };
      }
      
      throw error;
    }
  }
);

// Retry pattern
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  backoff: number = 2
): Promise<T> {
  let lastError: Error;
  let currentDelay = delay;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt >= maxRetries || !isRetryable(error)) {
        throw error;
      }
      
      // Wait before retrying
      await sleep(currentDelay);
      currentDelay *= backoff; // Exponential backoff
    }
  }
  
  throw lastError!;
}

// Helper function to check if an error is retryable
function isRetryable(error: any): boolean {
  // Network errors are usually retryable
  if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
    return true;
  }
  
  // Rate limiting errors are retryable
  if (error.status === 429 || error.statusCode === 429) {
    return true;
  }
  
  // Server errors might be retryable
  if (error.status >= 500 || error.statusCode >= 500) {
    return true;
  }
  
  return false;
}

// Helper function to sleep
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Action with retry pattern
server.tool(
  "api.fetch",
  {
    endpoint: z.string(),
    parameters: z.record(z.unknown()).optional()
  },
  async ({ endpoint, parameters }) => {
    try {
      // Execute with retry
      const result = await withRetry(
        async () => await fetchFromApi(endpoint, parameters),
        3, // Max retries
        1000, // Initial delay
        2 // Backoff factor
      );
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify(result, null, 2) 
        }]
      };
    } catch (error) {
      console.error(\`API fetch failed after retries:\`, error);
      
      return {
        content: [{ 
          type: "text", 
          text: \`Failed to fetch data from \${endpoint}: \${error.message}\` 
        }]
      };
    }
  }
);

// Health check and self-healing
let isHealthy = true;
let lastHealthCheck = Date.now();
const healthCheckInterval = 60000; // 1 minute

// Periodic health check
setInterval(async () => {
  try {
    // Perform health checks
    await checkDatabaseConnection();
    await checkExternalServices();
    
    // Update health status
    isHealthy = true;
    lastHealthCheck = Date.now();
  } catch (error) {
    console.error("Health check failed:", error);
    
    isHealthy = false;
    
    // Attempt recovery
    try {
      await performRecovery();
    } catch (recoveryError) {
      console.error("Recovery failed:", recoveryError);
    }
  }
}, healthCheckInterval);

// Health check action
server.tool(
  "system.health",
  {},
  async () => {
    const now = Date.now();
    const timeSinceLastCheck = now - lastHealthCheck;
    
    return {
      content: [{ 
        type: "text", 
        text: \`System health: \${isHealthy ? "Healthy" : "Unhealthy"}\\n\` +
              \`Last checked: \${new Date(lastHealthCheck).toISOString()} (\${Math.floor(timeSinceLastCheck / 1000)}s ago)\\n\` +
              \`Circuit breakers:\\n\` +
              \`- Database: \${databaseCircuitBreaker.getState()}\\n\` +
              \`- Search: \${searchCircuitBreaker.getState()}\\n\` +
              \`- Auth: \${authCircuitBreaker.getState()}\`
      }]
    };
  }
);

// Helper function for recovery
async function performRecovery(): Promise<void> {
  console.log("Attempting system recovery...");
  
  // Reset circuit breakers if appropriate
  if (databaseCircuitBreaker.getState() === "open") {
    try {
      // Test database connection
      await checkDatabaseConnection();
      databaseCircuitBreaker.reset();
      console.log("Database circuit breaker reset");
    } catch (error) {
      console.error("Database still unavailable:", error);
    }
  }
  
  if (searchCircuitBreaker.getState() === "open") {
    try {
      // Test search service
      await checkSearchService();
      searchCircuitBreaker.reset();
      console.log("Search circuit breaker reset");
    } catch (error) {
      console.error("Search service still unavailable:", error);
    }
  }
  
  if (authCircuitBreaker.getState() === "open") {
    try {
      // Test auth service
      await checkAuthService();
      authCircuitBreaker.reset();
      console.log("Auth circuit breaker reset");
    } catch (error) {
      console.error("Auth service still unavailable:", error);
    }
  }
  
  console.log("Recovery attempt completed");
}
\`\`\`

This section has covered advanced MCP features, including implementing action handlers, content block management, context window optimization, and error handling and recovery. These techniques will help you build more robust and efficient MCP applications. In the next section, we'll explore real-world applications of MCP.
`;export{n as default};

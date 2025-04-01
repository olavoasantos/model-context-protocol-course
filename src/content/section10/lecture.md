# Section 10: Final Project

In this final section, we'll build a comprehensive full-stack application that demonstrates the practical use of Model Context Protocol (MCP). Our project will be a collaborative knowledge management system that allows multiple users to create, share, and interact with knowledge bases using AI agents.

## Project Overview: Collaborative Knowledge Hub

The Collaborative Knowledge Hub is a platform where users can:

1. Create and manage knowledge bases
2. Share knowledge with other users
3. Query knowledge using natural language
4. Collaborate with AI agents that use MCP for context management
5. Track changes and contributions

This project will demonstrate the power of MCP in managing context for AI interactions while providing a practical, real-world application.

## Project Architecture

Our application will use a modern full-stack architecture:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Frontend │────►│  MCP Server     │────►│  Database       │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  MCP Client     │     │  AI Integration │     │  Authentication │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Project Setup

Let's start by setting up our project structure:

```bash
mkdir knowledge-hub
cd knowledge-hub
pnpm init

# Create project structure
mkdir -p packages/client packages/server packages/shared

# Initialize packages
cd packages/client
pnpm init
cd ../server
pnpm init
cd ../shared
pnpm init
cd ../../

# Create root package.json for workspace
cat > package.json << EOF
{
  "name": "knowledge-hub",
  "version": "1.0.0",
  "description": "Collaborative Knowledge Hub using MCP",
  "private": true,
  "scripts": {
    "dev": "pnpm -r run dev",
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint"
  },
  "keywords": ["mcp", "knowledge", "collaboration"],
  "author": "",
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Create pnpm workspace
cat > pnpm-workspace.yaml << EOF
packages:
  - 'packages/*'
EOF
```

## Building the Server

Let's start by building the server component of our application.

### Server Setup

First, let's set up the server package:

```bash
cd packages/server

# Install dependencies
pnpm add express @modelcontextprotocol/sdk zod cors dotenv mongoose jsonwebtoken bcrypt
pnpm add -D typescript ts-node @types/express @types/node @types/cors @types/jsonwebtoken @types/bcrypt tsx vitest

# Initialize TypeScript
npx tsc --init
```

Create a TypeScript configuration file:

```typescript
// packages/server/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "sourceMap": true,
    "declaration": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

Update the package.json:

```json
// packages/server/package.json
{
  "name": "@knowledge-hub/server",
  "version": "1.0.0",
  "description": "Server for Knowledge Hub",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["mcp", "server"],
  "author": "",
  "license": "MIT"
}
```

### Database Models

Let's define our database models:

```typescript
// packages/server/src/models/User.ts
import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  displayName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', UserSchema);
```

```typescript
// packages/server/src/models/KnowledgeBase.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IKnowledgeBase extends Document {
  title: string;
  description: string;
  owner: mongoose.Types.ObjectId;
  collaborators: mongoose.Types.ObjectId[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeBaseSchema = new Schema<IKnowledgeBase>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  collaborators: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const KnowledgeBase = mongoose.model<IKnowledgeBase>('KnowledgeBase', KnowledgeBaseSchema);
```

```typescript
// packages/server/src/models/Document.ts
import mongoose, { Schema, Document as MongoDocument } from 'mongoose';

export interface IDocument extends MongoDocument {
  title: string;
  content: string;
  knowledgeBase: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  lastUpdatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>({
  title: { type: String, required: true },
  content: { type: String, required: true },
  knowledgeBase: { type: Schema.Types.ObjectId, ref: 'KnowledgeBase', required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lastUpdatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add text index for search
DocumentSchema.index({ title: 'text', content: 'text' });

export const Document = mongoose.model<IDocument>('Document', DocumentSchema);
```

### Authentication

Let's implement authentication:

```typescript
// packages/server/src/utils/auth.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models/User.js';

// JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Generate JWT token
export const generateToken = (user: IUser): string => {
  return jwt.sign(
    { 
      id: user._id, 
      username: user.username,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Verify JWT token
export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

// Authentication middleware
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    // Find user
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Add user to request object
    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Authentication failed' });
  }
};
```

### MCP Server Implementation

Now, let's implement the MCP server:

```typescript
// packages/server/src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { z } from "zod";
import { KnowledgeBase } from "../models/KnowledgeBase.js";
import { Document } from "../models/Document.js";
import { User } from "../models/User.js";
import mongoose from "mongoose";

export async function createMcpServer(port: number = 3001) {
  // Create MCP server
  const server = new McpServer({
    name: "Knowledge Hub MCP Server",
    version: "1.0.0"
  });
  
  // Register resources
  registerResources(server);
  
  // Register actions
  registerActions(server);
  
  // Start the server
  const transport = new HttpServerTransport({ port });
  await server.connect(transport);
  
  console.log(`MCP server running on port ${port}`);
  
  return server;
}

function registerResources(server: McpServer) {
  // Knowledge base resource
  server.resource(
    "knowledge-base",
    "kb://{knowledgeBaseId}",
    async (uri, { knowledgeBaseId }, context) => {
      try {
        // Check if knowledge base exists
        const kb = await KnowledgeBase.findById(knowledgeBaseId)
          .populate('owner', 'username displayName')
          .populate('collaborators', 'username displayName');
        
        if (!kb) {
          throw new Error(`Knowledge base not found: ${knowledgeBaseId}`);
        }
        
        // Check if user has access
        const userId = context.metadata?.userId;
        
        if (!kb.isPublic && userId) {
          const isOwner = kb.owner._id.toString() === userId;
          const isCollaborator = kb.collaborators.some(
            c => c._id.toString() === userId
          );
          
          if (!isOwner && !isCollaborator) {
            throw new Error('Access denied');
          }
        } else if (!kb.isPublic && !userId) {
          throw new Error('Authentication required');
        }
        
        // Return knowledge base info
        return {
          contents: [{
            uri: uri.href,
            text: `# ${kb.title}\n\n${kb.description}`,
            metadata: {
              id: kb._id.toString(),
              title: kb.title,
              owner: {
                id: (kb.owner as any)._id.toString(),
                username: (kb.owner as any).username,
                displayName: (kb.owner as any).displayName
              },
              isPublic: kb.isPublic,
              createdAt: kb.createdAt,
              updatedAt: kb.updatedAt
            }
          }]
        };
      } catch (error) {
        console.error('Knowledge base resource error:', error);
        throw error;
      }
    }
  );
  
  // Document resource
  server.resource(
    "document",
    "doc://{documentId}",
    async (uri, { documentId }, context) => {
      try {
        // Find document
        const doc = await Document.findById(documentId)
          .populate('knowledgeBase')
          .populate('createdBy', 'username displayName')
          .populate('lastUpdatedBy', 'username displayName');
        
        if (!doc) {
          throw new Error(`Document not found: ${documentId}`);
        }
        
        // Check if user has access to the knowledge base
        const kb = doc.knowledgeBase as any;
        const userId = context.metadata?.userId;
        
        if (!kb.isPublic && userId) {
          const isOwner = kb.owner.toString() === userId;
          const isCollaborator = kb.collaborators.some(
            c => c.toString() === userId
          );
          
          if (!isOwner && !isCollaborator) {
            throw new Error('Access denied');
          }
        } else if (!kb.isPublic && !userId) {
          throw new Error('Authentication required');
        }
        
        // Return document content
        return {
          contents: [{
            uri: uri.href,
            text: doc.content,
            metadata: {
              id: doc._id.toString(),
              title: doc.title,
              knowledgeBase: {
                id: kb._id.toString(),
                title: kb.title
              },
              createdBy: {
                id: (doc.createdBy as any)._id.toString(),
                username: (doc.createdBy as any).username,
                displayName: (doc.createdBy as any).displayName
              },
              lastUpdatedBy: {
                id: (doc.lastUpdatedBy as any)._id.toString(),
                username: (doc.lastUpdatedBy as any).username,
                displayName: (doc.lastUpdatedBy as any).displayName
              },
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt
            }
          }]
        };
      } catch (error) {
        console.error('Document resource error:', error);
        throw error;
      }
    }
  );
  
  // Search resource
  server.resource(
    "search",
    "search://{query}",
    async (uri, { query }, context) => {
      try {
        // Get user ID from context
        const userId = context.metadata?.userId;
        
        // Find documents matching the query
        let documentsQuery = Document.find(
          { $text: { $search: query } },
          { score: { $meta: "textScore" } }
        )
        .sort({ score: { $meta: "textScore" } })
        .populate('knowledgeBase')
        .limit(10);
        
        const documents = await documentsQuery.exec();
        
        // Filter documents based on access
        const accessibleDocuments = documents.filter(doc => {
          const kb = doc.knowledgeBase as any;
          
          if (kb.isPublic) {
            return true;
          }
          
          if (!userId) {
            return false;
          }
          
          const isOwner = kb.owner.toString() === userId;
          const isCollaborator = kb.collaborators.some(
            c => c.toString() === userId
          );
          
          return isOwner || isCollaborator;
        });
        
        // Format results
        const results = accessibleDocuments.map(doc => {
          const kb = doc.knowledgeBase as any;
          
          // Extract a snippet from the content
          const contentPreview = doc.content.length > 200
            ? doc.content.substring(0, 200) + '...'
            : doc.content;
          
          return {
            uri: `doc://${doc._id}`,
            text: `# ${doc.title}\n\n${contentPreview}`,
            metadata: {
              id: doc._id.toString(),
              title: doc.title,
              knowledgeBase: {
                id: kb._id.toString(),
                title: kb.title
              }
            }
          };
        });
        
        return {
          contents: results
        };
      } catch (error) {
        console.error('Search resource error:', error);
        throw error;
      }
    }
  );
}

function registerActions(server: McpServer) {
  // Create document action
  server.tool(
    "document.create",
    {
      title: z.string(),
      content: z.string(),
      knowledgeBaseId: z.string()
    },
    async ({ title, content, knowledgeBaseId }, context) => {
      try {
        // Check authentication
        const userId = context.metadata?.userId;
        
        if (!userId) {
          throw new Error('Authentication required');
        }
        
        // Check if knowledge base exists and user has access
        const kb = await KnowledgeBase.findById(knowledgeBaseId);
        
        if (!kb) {
          throw new Error(`Knowledge base not found: ${knowledgeBaseId}`);
        }
        
        const isOwner = kb.owner.toString() === userId;
        const isCollaborator = kb.collaborators.some(
          c => c.toString() === userId
        );
        
        if (!isOwner && !isCollaborator) {
          throw new Error('Access denied');
        }
        
        // Create document
        const doc = new Document({
          title,
          content,
          knowledgeBase: kb._id,
          createdBy: userId,
          lastUpdatedBy: userId
        });
        
        await doc.save();
        
        return {
          content: [{ 
            type: "text", 
            text: `Document created successfully: ${doc._id}` 
          }]
        };
      } catch (error) {
        console.error('Create document action error:', error);
        throw error;
      }
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
      try {
        // Check authentication
        const userId = context.metadata?.userId;
        
        if (!userId) {
          throw new Error('Authentication required');
        }
        
        // Find document
        const doc = await Document.findById(documentId)
          .populate('knowledgeBase');
        
        if (!doc) {
          throw new Error(`Document not found: ${documentId}`);
        }
        
        // Check if user has access
        const kb = doc.knowledgeBase as any;
        const isOwner = kb.owner.toString() === userId;
        const isCollaborator = kb.collaborators.some(
          c => c.toString() === userId
        );
        
        if (!isOwner && !isCollaborator) {
          throw new Error('Access denied');
        }
        
        // Update document
        if (title) doc.title = title;
        if (content) doc.content = content;
        doc.lastUpdatedBy = new mongoose.Types.ObjectId(userId);
        doc.updatedAt = new Date();
        
        await doc.save();
        
        return {
          content: [{ 
            type: "text", 
            text: `Document updated successfully: ${doc._id}` 
          }]
        };
      } catch (error) {
        console.error('Update document action error:', error);
        throw error;
      }
    }
  );
  
  // Create knowledge base action
  server.tool(
    "knowledgeBase.create",
    {
      title: z.string(),
      description: z.string(),
      isPublic: z.boolean().default(false)
    },
    async ({ title, description, isPublic }, context) => {
      try {
        // Check authentication
        const userId = context.metadata?.userId;
        
        if (!userId) {
          throw new Error('Authentication required');
        }
        
        // Create knowledge base
        const kb = new KnowledgeBase({
          title,
          description,
          owner: userId,
          isPublic
        });
        
        await kb.save();
        
        return {
          content: [{ 
            type: "text", 
            text: `Knowledge base created successfully: ${kb._id}` 
          }]
        };
      } catch (error) {
        console.error('Create knowledge base action error:', error);
        throw error;
      }
    }
  );
  
  // Add collaborator action
  server.tool(
    "knowledgeBase.addCollaborator",
    {
      knowledgeBaseId: z.string(),
      username: z.string()
    },
    async ({ knowledgeBaseId, username }, context) => {
      try {
        // Check authentication
        const userId = context.metadata?.userId;
        
        if (!userId) {
          throw new Error('Authentication required');
        }
        
        // Find knowledge base
        const kb = await KnowledgeBase.findById(knowledgeBaseId);
        
        if (!kb) {
          throw new Error(`Knowledge base not found: ${knowledgeBaseId}`);
        }
        
        // Check if user is the owner
        if (kb.owner.toString() !== userId) {
          throw new Error('Only the owner can add collaborators');
        }
        
        // Find user to add as collaborator
        const user = await User.findOne({ username });
        
        if (!user) {
          throw new Error(`User not found: ${username}`);
        }
        
        // Check if user is already a collaborator
        if (kb.collaborators.some(c => c.toString() === user._id.toString())) {
          throw new Error(`User ${username} is already a collaborator`);
        }
        
        // Add collaborator
        kb.collaborators.push(user._id);
        await kb.save();
        
        return {
          content: [{ 
            type: "text", 
            text: `Added ${username} as a collaborator to knowledge base: ${kb.title}` 
          }]
        };
      } catch (error) {
        console.error('Add collaborator action error:', error);
        throw error;
      }
    }
  );
}
```

### Express Server

Let's create the Express server to handle HTTP requests and integrate with the MCP server:

```typescript
// packages/server/src/index.ts
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createMcpServer } from './mcp/server.js';
import { authenticate } from './utils/auth.js';
import authRoutes from './routes/auth.js';
import knowledgeBaseRoutes from './routes/knowledgeBase.js';
import documentRoutes from './routes/document.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/knowledge-hub';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Create Express app
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const MCP_PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/knowledge-bases', authenticate, knowledgeBaseRoutes);
app.use('/api/documents', authenticate, documentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start MCP server
createMcpServer(MCP_PORT)
  .then(() => {
    // Start Express server
    app.listen(PORT, () => {
      console.log(`Express server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to start MCP server:', err);
    process.exit(1);
  });
```

Let's implement the routes:

```typescript
// packages/server/src/routes/auth.ts
import express from 'express';
import { User } from '../models/User.js';
import { generateToken } from '../utils/auth.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already in use' });
    }
    
    // Create new user
    const user = new User({
      username,
      email,
      password,
      displayName
    });
    
    await user.save();
    
    // Generate token
    const token = generateToken(user);
    
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Generate token
    const token = generateToken(user);
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
```

```typescript
// packages/server/src/routes/knowledgeBase.ts
import express from 'express';
import { KnowledgeBase } from '../models/KnowledgeBase.js';
import { User } from '../models/User.js';

const router = express.Router();

// Get all knowledge bases for the user
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).user._id;
    
    // Find knowledge bases where user is owner or collaborator
    const knowledgeBases = await KnowledgeBase.find({
      $or: [
        { owner: userId },
        { collaborators: userId },
        { isPublic: true }
      ]
    }).populate('owner', 'username displayName')
      .populate('collaborators', 'username displayName')
      .sort({ updatedAt: -1 });
    
    res.json(knowledgeBases);
  } catch (error) {
    console.error('Get knowledge bases error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get knowledge base by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = (req as any).user._id;
    const knowledgeBaseId = req.params.id;
    
    // Find knowledge base
    const knowledgeBase = await KnowledgeBase.findById(knowledgeBaseId)
      .populate('owner', 'username displayName')
      .populate('collaborators', 'username displayName');
    
    if (!knowledgeBase) {
      return res.status(404).json({ message: 'Knowledge base not found' });
    }
    
    // Check if user has access
    const isOwner = knowledgeBase.owner._id.toString() === userId.toString();
    const isCollaborator = knowledgeBase.collaborators.some(
      c => c._id.toString() === userId.toString()
    );
    
    if (!isOwner && !isCollaborator && !knowledgeBase.isPublic) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(knowledgeBase);
  } catch (error) {
    console.error('Get knowledge base error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create knowledge base
router.post('/', async (req, res) => {
  try {
    const userId = (req as any).user._id;
    const { title, description, isPublic } = req.body;
    
    // Create knowledge base
    const knowledgeBase = new KnowledgeBase({
      title,
      description,
      owner: userId,
      isPublic: isPublic || false
    });
    
    await knowledgeBase.save();
    
    res.status(201).json(knowledgeBase);
  } catch (error) {
    console.error('Create knowledge base error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update knowledge base
router.put('/:id', async (req, res) => {
  try {
    const userId = (req as any).user._id;
    const knowledgeBaseId = req.params.id;
    const { title, description, isPublic } = req.body;
    
    // Find knowledge base
    const knowledgeBase = await KnowledgeBase.findById(knowledgeBaseId);
    
    if (!knowledgeBase) {
      return res.status(404).json({ message: 'Knowledge base not found' });
    }
    
    // Check if user is the owner
    if (knowledgeBase.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the owner can update the knowledge base' });
    }
    
    // Update knowledge base
    if (title) knowledgeBase.title = title;
    if (description) knowledgeBase.description = description;
    if (isPublic !== undefined) knowledgeBase.isPublic = isPublic;
    knowledgeBase.updatedAt = new Date();
    
    await knowledgeBase.save();
    
    res.json(knowledgeBase);
  } catch (error) {
    console.error('Update knowledge base error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add collaborator
router.post('/:id/collaborators', async (req, res) => {
  try {
    const userId = (req as any).user._id;
    const knowledgeBaseId = req.params.id;
    const { username } = req.body;
    
    // Find knowledge base
    const knowledgeBase = await KnowledgeBase.findById(knowledgeBaseId);
    
    if (!knowledgeBase) {
      return res.status(404).json({ message: 'Knowledge base not found' });
    }
    
    // Check if user is the owner
    if (knowledgeBase.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the owner can add collaborators' });
    }
    
    // Find user to add as collaborator
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is already a collaborator
    if (knowledgeBase.collaborators.some(c => c.toString() === user._id.toString())) {
      return res.status(400).json({ message: 'User is already a collaborator' });
    }
    
    // Add collaborator
    knowledgeBase.collaborators.push(user._id);
    knowledgeBase.updatedAt = new Date();
    
    await knowledgeBase.save();
    
    // Populate collaborator info
    await knowledgeBase.populate('collaborators', 'username displayName');
    
    res.json(knowledgeBase);
  } catch (error) {
    console.error('Add collaborator error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove collaborator
router.delete('/:id/collaborators/:userId', async (req, res) => {
  try {
    const ownerId = (req as any).user._id;
    const knowledgeBaseId = req.params.id;
    const collaboratorId = req.params.userId;
    
    // Find knowledge base
    const knowledgeBase = await KnowledgeBase.findById(knowledgeBaseId);
    
    if (!knowledgeBase) {
      return res.status(404).json({ message: 'Knowledge base not found' });
    }
    
    // Check if user is the owner
    if (knowledgeBase.owner.toString() !== ownerId.toString()) {
      return res.status(403).json({ message: 'Only the owner can remove collaborators' });
    }
    
    // Remove collaborator
    knowledgeBase.collaborators = knowledgeBase.collaborators.filter(
      c => c.toString() !== collaboratorId
    );
    knowledgeBase.updatedAt = new Date();
    
    await knowledgeBase.save();
    
    res.json(knowledgeBase);
  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
```

```typescript
// packages/server/src/routes/document.ts
import express from 'express';
import { Document } from '../models/Document.js';
import { KnowledgeBase } from '../models/KnowledgeBase.js';

const router = express.Router();

// Get all documents for a knowledge base
router.get('/kb/:knowledgeBaseId', async (req, res) => {
  try {
    const userId = (req as any).user._id;
    const knowledgeBaseId = req.params.knowledgeBaseId;
    
    // Find knowledge base
    const knowledgeBase = await KnowledgeBase.findById(knowledgeBaseId);
    
    if (!knowledgeBase) {
      return res.status(404).json({ message: 'Knowledge base not found' });
    }
    
    // Check if user has access
    const isOwner = knowledgeBase.owner.toString() === userId.toString();
    const isCollaborator = knowledgeBase.collaborators.some(
      c => c.toString() === userId.toString()
    );
    
    if (!isOwner && !isCollaborator && !knowledgeBase.isPublic) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Find documents
    const documents = await Document.find({ knowledgeBase: knowledgeBaseId })
      .populate('createdBy', 'username displayName')
      .populate('lastUpdatedBy', 'username displayName')
      .sort({ updatedAt: -1 });
    
    res.json(documents);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get document by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = (req as any).user._id;
    const documentId = req.params.id;
    
    // Find document
    const document = await Document.findById(documentId)
      .populate('knowledgeBase')
      .populate('createdBy', 'username displayName')
      .populate('lastUpdatedBy', 'username displayName');
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Check if user has access to the knowledge base
    const kb = document.knowledgeBase as any;
    const isOwner = kb.owner.toString() === userId.toString();
    const isCollaborator = kb.collaborators.some(
      c => c.toString() === userId.toString()
    );
    
    if (!isOwner && !isCollaborator && !kb.isPublic) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(document);
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create document
router.post('/', async (req, res) => {
  try {
    const userId = (req as any).user._id;
    const { title, content, knowledgeBaseId } = req.body;
    
    // Check if knowledge base exists and user has access
    const knowledgeBase = await KnowledgeBase.findById(knowledgeBaseId);
    
    if (!knowledgeBase) {
      return res.status(404).json({ message: 'Knowledge base not found' });
    }
    
    const isOwner = knowledgeBase.owner.toString() === userId.toString();
    const isCollaborator = knowledgeBase.collaborators.some(
      c => c.toString() === userId.toString()
    );
    
    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Create document
    const document = new Document({
      title,
      content,
      knowledgeBase: knowledgeBaseId,
      createdBy: userId,
      lastUpdatedBy: userId
    });
    
    await document.save();
    
    // Populate references
    await document.populate('createdBy', 'username displayName');
    await document.populate('lastUpdatedBy', 'username displayName');
    
    res.status(201).json(document);
  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update document
router.put('/:id', async (req, res) => {
  try {
    const userId = (req as any).user._id;
    const documentId = req.params.id;
    const { title, content } = req.body;
    
    // Find document
    const document = await Document.findById(documentId)
      .populate('knowledgeBase');
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Check if user has access to the knowledge base
    const kb = document.knowledgeBase as any;
    const isOwner = kb.owner.toString() === userId.toString();
    const isCollaborator = kb.collaborators.some(
      c => c.toString() === userId.toString()
    );
    
    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Update document
    if (title) document.title = title;
    if (content) document.content = content;
    document.lastUpdatedBy = userId;
    document.updatedAt = new Date();
    
    await document.save();
    
    // Populate references
    await document.populate('createdBy', 'username displayName');
    await document.populate('lastUpdatedBy', 'username displayName');
    
    res.json(document);
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete document
router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).user._id;
    const documentId = req.params.id;
    
    // Find document
    const document = await Document.findById(documentId)
      .populate('knowledgeBase');
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Check if user has access to the knowledge base
    const kb = document.knowledgeBase as any;
    const isOwner = kb.owner.toString() === userId.toString();
    
    if (!isOwner) {
      return res.status(403).json({ message: 'Only the knowledge base owner can delete documents' });
    }
    
    // Delete document
    await document.deleteOne();
    
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search documents
router.get('/search/:query', async (req, res) => {
  try {
    const userId = (req as any).user._id;
    const query = req.params.query;
    
    // Find documents matching the query
    const documents = await Document.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" } }
    )
    .sort({ score: { $meta: "textScore" } })
    .populate('knowledgeBase')
    .populate('createdBy', 'username displayName')
    .populate('lastUpdatedBy', 'username displayName')
    .limit(10);
    
    // Filter documents based on access
    const accessibleDocuments = documents.filter(doc => {
      const kb = doc.knowledgeBase as any;
      
      if (kb.isPublic) {
        return true;
      }
      
      const isOwner = kb.owner.toString() === userId.toString();
      const isCollaborator = kb.collaborators.some(
        c => c.toString() === userId.toString()
      );
      
      return isOwner || isCollaborator;
    });
    
    res.json(accessibleDocuments);
  } catch (error) {
    console.error('Search documents error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
```

## Building the Client

Now, let's build the client component of our application.

### Client Setup

First, let's set up the client package:

```bash
cd packages/client

# Install dependencies
pnpm add react react-dom react-router-dom @modelcontextprotocol/sdk axios marked react-markdown react-icons @chakra-ui/react @emotion/react @emotion/styled framer-motion
pnpm add -D typescript vite @types/react @types/react-dom @types/marked vitest @testing-library/react @testing-library/jest-dom

# Initialize Vite
npx vite init
```

Update the package.json:

```json
// packages/client/package.json
{
  "name": "@knowledge-hub/client",
  "version": "1.0.0",
  "description": "Client for Knowledge Hub",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["mcp", "client"],
  "author": "",
  "license": "MIT"
}
```

### Client Components

Let's create the main components for our client application:

```typescript
// packages/client/src/App.tsx
import React from 'react';
import { ChakraProvider, Box, CSSReset } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { McpProvider } from './contexts/McpContext';
import Header from './components/Header';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import KnowledgeBaseList from './pages/KnowledgeBaseList';
import KnowledgeBaseDetail from './pages/KnowledgeBaseDetail';
import DocumentDetail from './pages/DocumentDetail';
import DocumentEdit from './pages/DocumentEdit';
import PrivateRoute from './components/PrivateRoute';

const App: React.FC = () => {
  return (
    <ChakraProvider>
      <CSSReset />
      <AuthProvider>
        <McpProvider>
          <Router>
            <Box minH="100vh">
              <Header />
              <Box p={4}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route 
                    path="/knowledge-bases" 
                    element={
                      <PrivateRoute>
                        <KnowledgeBaseList />
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/knowledge-bases/:id" 
                    element={
                      <PrivateRoute>
                        <KnowledgeBaseDetail />
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/documents/:id" 
                    element={
                      <PrivateRoute>
                        <DocumentDetail />
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/documents/:id/edit" 
                    element={
                      <PrivateRoute>
                        <DocumentEdit />
                      </PrivateRoute>
                    } 
                  />
                </Routes>
              </Box>
            </Box>
          </Router>
        </McpProvider>
      </AuthProvider>
    </ChakraProvider>
  );
};

export default App;
```

Let's create the context providers:

```typescript
// packages/client/src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      
      // Set default Authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }
    
    setLoading(false);
  }, []);

  // Login function
  const login = async (username: string, password: string) => {
    try {
      const response = await axios.post('/api/auth/login', { username, password });
      const { token, user } = response.data;
      
      // Save to state
      setToken(token);
      setUser(user);
      
      // Save to localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Set default Authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Register function
  const register = async (username: string, email: string, password: string, displayName: string) => {
    try {
      const response = await axios.post('/api/auth/register', {
        username,
        email,
        password,
        displayName
      });
      
      const { token, user } = response.data;
      
      // Save to state
      setToken(token);
      setUser(user);
      
      // Save to localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Set default Authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    // Clear state
    setToken(null);
    setUser(null);
    
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Clear Authorization header
    delete axios.defaults.headers.common['Authorization'];
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token,
    loading,
    login,
    register,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

```typescript
// packages/client/src/contexts/McpContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp.js';
import { HttpClientTransport } from '@modelcontextprotocol/sdk/client/http.js';
import { useAuth } from './AuthContext';

interface McpContextType {
  client: McpClient | null;
  connected: boolean;
  fetchResource: (uri: string) => Promise<any[]>;
  executeAction: (action: string, params: any) => Promise<any>;
  searchResources: (query: string) => Promise<any[]>;
}

const McpContext = createContext<McpContextType | undefined>(undefined);

export const useMcp = () => {
  const context = useContext(McpContext);
  if (!context) {
    throw new Error('useMcp must be used within a McpProvider');
  }
  return context;
};

export const McpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [client, setClient] = useState<McpClient | null>(null);
  const [connected, setConnected] = useState(false);

  // Initialize MCP client
  useEffect(() => {
    const initClient = async () => {
      try {
        // Create transport with auth token
        const transport = new HttpClientTransport(
          'http://localhost:3001', // MCP server URL
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          }
        );
        
        // Create client
        const mcpClient = new McpClient(transport);
        
        // Connect
        await mcpClient.connect();
        
        setClient(mcpClient);
        setConnected(true);
        
        console.log('Connected to MCP server');
      } catch (error) {
        console.error('MCP connection error:', error);
        setConnected(false);
      }
    };
    
    initClient();
    
    // Cleanup on unmount
    return () => {
      if (client) {
        client.disconnect().catch(console.error);
      }
    };
  }, [token]);

  // Fetch resource wrapper
  const fetchResource = async (uri: string) => {
    if (!client || !connected) {
      throw new Error('MCP client not connected');
    }
    
    try {
      return await client.fetchResource(uri);
    } catch (error) {
      console.error('Fetch resource error:', error);
      throw error;
    }
  };

  // Execute action wrapper
  const executeAction = async (action: string, params: any) => {
    if (!client || !connected) {
      throw new Error('MCP client not connected');
    }
    
    try {
      return await client.executeAction(action, params);
    } catch (error) {
      console.error('Execute action error:', error);
      throw error;
    }
  };

  // Search resources
  const searchResources = async (query: string) => {
    if (!client || !connected) {
      throw new Error('MCP client not connected');
    }
    
    try {
      return await client.fetchResource(`search://${query}`);
    } catch (error) {
      console.error('Search resources error:', error);
      throw error;
    }
  };

  const value = {
    client,
    connected,
    fetchResource,
    executeAction,
    searchResources
  };

  return <McpContext.Provider value={value}>{children}</McpContext.Provider>;
};
```

Let's create the main pages:

```typescript
// packages/client/src/pages/Home.tsx
import React from 'react';
import { Box, Heading, Text, Button, Container, Stack, Image } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Home: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Container maxW="container.xl">
      <Box textAlign="center" py={10}>
        <Heading as="h1" size="2xl" mb={4}>
          Collaborative Knowledge Hub
        </Heading>
        <Text fontSize="xl" mb={8}>
          Create, share, and collaborate on knowledge bases with AI assistance
        </Text>
        
        {isAuthenticated ? (
          <Button
            as={RouterLink}
            to="/knowledge-bases"
            colorScheme="blue"
            size="lg"
          >
            View Your Knowledge Bases
          </Button>
        ) : (
          <Stack direction={{ base: 'column', md: 'row' }} spacing={4} justify="center">
            <Button
              as={RouterLink}
              to="/login"
              colorScheme="blue"
              size="lg"
            >
              Log In
            </Button>
            <Button
              as={RouterLink}
              to="/register"
              colorScheme="green"
              size="lg"
            >
              Sign Up
            </Button>
          </Stack>
        )}
      </Box>
      
      <Box py={10}>
        <Heading as="h2" size="xl" mb={6} textAlign="center">
          Features
        </Heading>
        
        <Stack spacing={10} direction={{ base: 'column', lg: 'row' }}>
          <Box flex={1} p={5} boxShadow="md" borderRadius="md">
            <Heading as="h3" size="md" mb={4}>
              Create Knowledge Bases
            </Heading>
            <Text>
              Organize your knowledge into structured bases with documents, categories, and tags.
            </Text>
          </Box>
          
          <Box flex={1} p={5} boxShadow="md" borderRadius="md">
            <Heading as="h3" size="md" mb={4}>
              Collaborate with Others
            </Heading>
            <Text>
              Share your knowledge bases with team members and collaborate in real-time.
            </Text>
          </Box>
          
          <Box flex={1} p={5} boxShadow="md" borderRadius="md">
            <Heading as="h3" size="md" mb={4}>
              AI-Powered Assistance
            </Heading>
            <Text>
              Leverage AI agents with context awareness through MCP to help organize and retrieve information.
            </Text>
          </Box>
        </Stack>
      </Box>
    </Container>
  );
};

export default Home;
```

```typescript
// packages/client/src/pages/Login.tsx
import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  FormControl, 
  FormLabel, 
  Input, 
  Heading, 
  Text, 
  Link, 
  useToast, 
  Container 
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
      return;
    }
    
    setLoading(true);
    
    try {
      await login(username, password);
      
      toast({
        title: 'Success',
        description: 'You have been logged in',
        status: 'success',
        duration: 3000,
        isClosable: true
      });
      
      navigate('/knowledge-bases');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Invalid credentials',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxW="md">
      <Box p={8} boxShadow="lg" borderRadius="md" bg="white">
        <Heading as="h1" size="xl" textAlign="center" mb={6}>
          Log In
        </Heading>
        
        <form onSubmit={handleSubmit}>
          <FormControl id="username" mb={4}>
            <FormLabel>Username</FormLabel>
            <Input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
            />
          </FormControl>
          
          <FormControl id="password" mb={6}>
            <FormLabel>Password</FormLabel>
            <Input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </FormControl>
          
          <Button 
            colorScheme="blue" 
            width="full" 
            type="submit" 
            isLoading={loading}
          >
            Log In
          </Button>
        </form>
        
        <Text mt={4} textAlign="center">
          Don't have an account?{' '}
          <Link as={RouterLink} to="/register" color="blue.500">
            Sign Up
          </Link>
        </Text>
      </Box>
    </Container>
  );
};

export default Login;
```

```typescript
// packages/client/src/pages/Register.tsx
import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  FormControl, 
  FormLabel, 
  Input, 
  Heading, 
  Text, 
  Link, 
  useToast, 
  Container 
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !email || !password || !displayName) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
      return;
    }
    
    setLoading(true);
    
    try {
      await register(username, email, password, displayName);
      
      toast({
        title: 'Success',
        description: 'Your account has been created',
        status: 'success',
        duration: 3000,
        isClosable: true
      });
      
      navigate('/knowledge-bases');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create account',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxW="md">
      <Box p={8} boxShadow="lg" borderRadius="md" bg="white">
        <Heading as="h1" size="xl" textAlign="center" mb={6}>
          Sign Up
        </Heading>
        
        <form onSubmit={handleSubmit}>
          <FormControl id="username" mb={4}>
            <FormLabel>Username</FormLabel>
            <Input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
            />
          </FormControl>
          
          <FormControl id="email" mb={4}>
            <FormLabel>Email</FormLabel>
            <Input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </FormControl>
          
          <FormControl id="displayName" mb={4}>
            <FormLabel>Display Name</FormLabel>
            <Input 
              type="text" 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)} 
            />
          </FormControl>
          
          <FormControl id="password" mb={6}>
            <FormLabel>Password</FormLabel>
            <Input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </FormControl>
          
          <Button 
            colorScheme="green" 
            width="full" 
            type="submit" 
            isLoading={loading}
          >
            Sign Up
          </Button>
        </form>
        
        <Text mt={4} textAlign="center">
          Already have an account?{' '}
          <Link as={RouterLink} to="/login" color="blue.500">
            Log In
          </Link>
        </Text>
      </Box>
    </Container>
  );
};

export default Register;
```

```typescript
// packages/client/src/pages/KnowledgeBaseList.tsx
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Heading, 
  Button, 
  SimpleGrid, 
  useDisclosure, 
  Modal, 
  ModalOverlay, 
  ModalContent, 
  ModalHeader, 
  ModalFooter, 
  ModalBody, 
  ModalCloseButton, 
  FormControl, 
  FormLabel, 
  Input, 
  Textarea, 
  Switch, 
  useToast, 
  Spinner, 
  Text 
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import KnowledgeBaseCard from '../components/KnowledgeBaseCard';

interface KnowledgeBase {
  _id: string;
  title: string;
  description: string;
  isPublic: boolean;
  owner: {
    _id: string;
    username: string;
    displayName: string;
  };
  collaborators: Array<{
    _id: string;
    username: string;
    displayName: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const KnowledgeBaseList: React.FC = () => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Fetch knowledge bases
  useEffect(() => {
    const fetchKnowledgeBases = async () => {
      try {
        const response = await axios.get('/api/knowledge-bases');
        setKnowledgeBases(response.data);
        setError(null);
      } catch (error) {
        console.error('Error fetching knowledge bases:', error);
        setError('Failed to load knowledge bases');
      } finally {
        setLoading(false);
      }
    };
    
    fetchKnowledgeBases();
  }, []);

  // Create knowledge base
  const handleCreateKnowledgeBase = async () => {
    if (!title || !description) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
      return;
    }
    
    setCreating(true);
    
    try {
      const response = await axios.post('/api/knowledge-bases', {
        title,
        description,
        isPublic
      });
      
      setKnowledgeBases([...knowledgeBases, response.data]);
      
      toast({
        title: 'Success',
        description: 'Knowledge base created',
        status: 'success',
        duration: 3000,
        isClosable: true
      });
      
      // Reset form
      setTitle('');
      setDescription('');
      setIsPublic(false);
      onClose();
    } catch (error) {
      console.error('Error creating knowledge base:', error);
      toast({
        title: 'Error',
        description: 'Failed to create knowledge base',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
        <Text mt={4}>Loading knowledge bases...</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={6}>
        <Heading as="h1" size="xl">
          Knowledge Bases
        </Heading>
        <Button colorScheme="blue" onClick={onOpen}>
          Create New
        </Button>
      </Box>
      
      {error && (
        <Box bg="red.100" p={4} borderRadius="md" mb={6}>
          <Text color="red.800">{error}</Text>
        </Box>
      )}
      
      {knowledgeBases.length === 0 ? (
        <Box textAlign="center" py={10} bg="gray.50" borderRadius="md">
          <Text fontSize="lg" mb={4}>
            You don't have any knowledge bases yet
          </Text>
          <Button colorScheme="blue" onClick={onOpen}>
            Create Your First Knowledge Base
          </Button>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {knowledgeBases.map((kb) => (
            <KnowledgeBaseCard key={kb._id} knowledgeBase={kb} />
          ))}
        </SimpleGrid>
      )}
      
      {/* Create Knowledge Base Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create Knowledge Base</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl id="title" mb={4}>
              <FormLabel>Title</FormLabel>
              <Input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
              />
            </FormControl>
            
            <FormControl id="description" mb={4}>
              <FormLabel>Description</FormLabel>
              <Textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
              />
            </FormControl>
            
            <FormControl id="isPublic" display="flex" alignItems="center">
              <FormLabel mb={0}>Make Public</FormLabel>
              <Switch 
                isChecked={isPublic} 
                onChange={(e) => setIsPublic(e.target.checked)} 
              />
            </FormControl>
          </ModalBody>
          
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={handleCreateKnowledgeBase}
              isLoading={creating}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default KnowledgeBaseList;
```

Let's create some components:

```typescript
// packages/client/src/components/Header.tsx
import React from 'react';
import { 
  Box, 
  Flex, 
  Text, 
  Button, 
  Stack, 
  Link, 
  Menu, 
  MenuButton, 
  MenuList, 
  MenuItem, 
  IconButton, 
  useDisclosure 
} from '@chakra-ui/react';
import { HamburgerIcon, CloseIcon } from '@chakra-ui/icons';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Header: React.FC = () => {
  const { isOpen, onToggle } = useDisclosure();
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <Box as="header" bg="blue.600" px={4} boxShadow="md">
      <Flex h={16} alignItems="center" justifyContent="space-between">
        <IconButton
          display={{ base: 'flex', md: 'none' }}
          onClick={onToggle}
          icon={isOpen ? <CloseIcon w={3} h={3} /> : <HamburgerIcon w={5} h={5} />}
          variant="ghost"
          color="white"
          aria-label="Toggle Navigation"
        />
        
        <Text
          as={RouterLink}
          to="/"
          fontWeight="bold"
          fontSize="xl"
          color="white"
        >
          Knowledge Hub
        </Text>
        
        <Flex display={{ base: 'none', md: 'flex' }}>
          <Stack direction="row" spacing={4} align="center">
            <Link as={RouterLink} to="/" color="white" fontWeight="medium">
              Home
            </Link>
            
            {isAuthenticated && (
              <Link as={RouterLink} to="/knowledge-bases" color="white" fontWeight="medium">
                Knowledge Bases
              </Link>
            )}
          </Stack>
        </Flex>
        
        <Stack direction="row" spacing={4}>
          {isAuthenticated ? (
            <Menu>
              <MenuButton as={Button} colorScheme="whiteAlpha">
                {user?.displayName || user?.username}
              </MenuButton>
              <MenuList>
                <MenuItem onClick={logout}>Logout</MenuItem>
              </MenuList>
            </Menu>
          ) : (
            <>
              <Button
                as={RouterLink}
                to="/login"
                variant="ghost"
                color="white"
                _hover={{ bg: 'blue.500' }}
                display={{ base: 'none', md: 'inline-flex' }}
              >
                Log In
              </Button>
              <Button
                as={RouterLink}
                to="/register"
                colorScheme="whiteAlpha"
                display={{ base: 'none', md: 'inline-flex' }}
              >
                Sign Up
              </Button>
            </>
          )}
        </Stack>
      </Flex>
      
      {/* Mobile menu */}
      <Box
        display={{ base: isOpen ? 'block' : 'none', md: 'none' }}
        pb={4}
      >
        <Stack as="nav" spacing={4}>
          <Link as={RouterLink} to="/" color="white" fontWeight="medium">
            Home
          </Link>
          
          {isAuthenticated && (
            <Link as={RouterLink} to="/knowledge-bases" color="white" fontWeight="medium">
              Knowledge Bases
            </Link>
          )}
          
          {!isAuthenticated && (
            <>
              <Link as={RouterLink} to="/login" color="white" fontWeight="medium">
                Log In
              </Link>
              <Link as={RouterLink} to="/register" color="white" fontWeight="medium">
                Sign Up
              </Link>
            </>
          )}
        </Stack>
      </Box>
    </Box>
  );
};

export default Header;
```

```typescript
// packages/client/src/components/KnowledgeBaseCard.tsx
import React from 'react';
import { 
  Box, 
  Heading, 
  Text, 
  Badge, 
  Flex, 
  Avatar, 
  Stack 
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface KnowledgeBaseProps {
  knowledgeBase: {
    _id: string;
    title: string;
    description: string;
    isPublic: boolean;
    owner: {
      _id: string;
      username: string;
      displayName: string;
    };
    collaborators: Array<{
      _id: string;
      username: string;
      displayName: string;
    }>;
    createdAt: string;
    updatedAt: string;
  };
}

const KnowledgeBaseCard: React.FC<KnowledgeBaseProps> = ({ knowledgeBase }) => {
  const { user } = useAuth();
  const isOwner = user?.id === knowledgeBase.owner._id;
  
  return (
    <Box
      as={RouterLink}
      to={`/knowledge-bases/${knowledgeBase._id}`}
      p={5}
      borderWidth="1px"
      borderRadius="lg"
      boxShadow="md"
      transition="all 0.2s"
      _hover={{ transform: 'translateY(-4px)', boxShadow: 'lg' }}
    >
      <Flex justify="space-between" align="center" mb={2}>
        <Badge colorScheme={knowledgeBase.isPublic ? 'green' : 'blue'}>
          {knowledgeBase.isPublic ? 'Public' : 'Private'}
        </Badge>
        {isOwner && (
          <Badge colorScheme="purple">Owner</Badge>
        )}
      </Flex>
      
      <Heading as="h3" size="md" mb={2}>
        {knowledgeBase.title}
      </Heading>
      
      <Text noOfLines={3} mb={4} color="gray.600">
        {knowledgeBase.description}
      </Text>
      
      <Flex align="center" mt={4}>
        <Avatar 
          size="sm" 
          name={knowledgeBase.owner.displayName} 
          mr={2} 
        />
        <Box>
          <Text fontSize="sm" fontWeight="bold">
            {knowledgeBase.owner.displayName}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {new Date(knowledgeBase.updatedAt).toLocaleDateString()}
          </Text>
        </Box>
      </Flex>
      
      {knowledgeBase.collaborators.length > 0 && (
        <Stack direction="row" mt={3} align="center">
          <Text fontSize="xs" color="gray.500">
            Collaborators:
          </Text>
          <Flex>
            {knowledgeBase.collaborators.slice(0, 3).map((collaborator) => (
              <Avatar 
                key={collaborator._id}
                size="xs" 
                name={collaborator.displayName} 
                ml={-1} 
                border="2px solid white" 
              />
            ))}
            {knowledgeBase.collaborators.length > 3 && (
              <Box 
                ml={-1} 
                borderRadius="full" 
                bg="gray.200" 
                w="20px" 
                h="20px" 
                fontSize="xs" 
                display="flex" 
                alignItems="center" 
                justifyContent="center"
                border="2px solid white"
              >
                +{knowledgeBase.collaborators.length - 3}
              </Box>
            )}
          </Flex>
        </Stack>
      )}
    </Box>
  );
};

export default KnowledgeBaseCard;
```

```typescript
// packages/client/src/components/PrivateRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, Spinner, Text } from '@chakra-ui/react';

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
        <Text mt={4}>Loading...</Text>
      </Box>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return <>{children}</>;
};

export default PrivateRoute;
```

## AI Integration

Let's integrate AI capabilities into our application using MCP:

```typescript
// packages/server/src/ai/agent.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Document } from "../models/Document.js";
import { KnowledgeBase } from "../models/KnowledgeBase.js";

export function registerAiActions(server: McpServer) {
  // AI-powered document summarization
  server.tool(
    "ai.summarizeDocument",
    {
      documentId: z.string()
    },
    async ({ documentId }, context) => {
      try {
        // Check authentication
        const userId = context.metadata?.userId;
        
        if (!userId) {
          throw new Error('Authentication required');
        }
        
        // Find document
        const document = await Document.findById(documentId)
          .populate('knowledgeBase');
        
        if (!document) {
          throw new Error(`Document not found: ${documentId}`);
        }
        
        // Check if user has access to the knowledge base
        const kb = document.knowledgeBase as any;
        const isOwner = kb.owner.toString() === userId;
        const isCollaborator = kb.collaborators.some(
          c => c.toString() === userId
        );
        
        if (!isOwner && !isCollaborator && !kb.isPublic) {
          throw new Error('Access denied');
        }
        
        // Generate summary
        // In a real application, this would call an AI service
        const summary = generateSummary(document.content);
        
        return {
          content: [{ 
            type: "text", 
            text: summary
          }]
        };
      } catch (error) {
        console.error('Summarize document error:', error);
        throw error;
      }
    }
  );
  
  // AI-powered knowledge base analysis
  server.tool(
    "ai.analyzeKnowledgeBase",
    {
      knowledgeBaseId: z.string()
    },
    async ({ knowledgeBaseId }, context) => {
      try {
        // Check authentication
        const userId = context.metadata?.userId;
        
        if (!userId) {
          throw new Error('Authentication required');
        }
        
        // Find knowledge base
        const knowledgeBase = await KnowledgeBase.findById(knowledgeBaseId);
        
        if (!knowledgeBase) {
          throw new Error(`Knowledge base not found: ${knowledgeBaseId}`);
        }
        
        // Check if user has access
        const isOwner = knowledgeBase.owner.toString() === userId;
        const isCollaborator = knowledgeBase.collaborators.some(
          c => c.toString() === userId
        );
        
        if (!isOwner && !isCollaborator && !knowledgeBase.isPublic) {
          throw new Error('Access denied');
        }
        
        // Find all documents in the knowledge base
        const documents = await Document.find({ knowledgeBase: knowledgeBaseId });
        
        // Generate analysis
        // In a real application, this would call an AI service
        const analysis = generateKnowledgeBaseAnalysis(knowledgeBase, documents);
        
        return {
          content: [{ 
            type: "text", 
            text: analysis
          }]
        };
      } catch (error) {
        console.error('Analyze knowledge base error:', error);
        throw error;
      }
    }
  );
  
  // AI-powered question answering
  server.tool(
    "ai.answerQuestion",
    {
      knowledgeBaseId: z.string(),
      question: z.string()
    },
    async ({ knowledgeBaseId, question }, context) => {
      try {
        // Check authentication
        const userId = context.metadata?.userId;
        
        if (!userId) {
          throw new Error('Authentication required');
        }
        
        // Find knowledge base
        const knowledgeBase = await KnowledgeBase.findById(knowledgeBaseId);
        
        if (!knowledgeBase) {
          throw new Error(`Knowledge base not found: ${knowledgeBaseId}`);
        }
        
        // Check if user has access
        const isOwner = knowledgeBase.owner.toString() === userId;
        const isCollaborator = knowledgeBase.collaborators.some(
          c => c.toString() === userId
        );
        
        if (!isOwner && !isCollaborator && !knowledgeBase.isPublic) {
          throw new Error('Access denied');
        }
        
        // Find all documents in the knowledge base
        const documents = await Document.find({ knowledgeBase: knowledgeBaseId });
        
        // Generate answer
        // In a real application, this would call an AI service
        const answer = generateAnswer(question, documents);
        
        return {
          content: [{ 
            type: "text", 
            text: answer
          }]
        };
      } catch (error) {
        console.error('Answer question error:', error);
        throw error;
      }
    }
  );
}

// Helper functions for AI simulation
function generateSummary(content: string): string {
  // In a real application, this would use an AI model
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const wordCount = content.split(/\s+/).length;
  
  let summary = '';
  
  if (sentences.length > 3) {
    // Take first and last sentence, and a middle one
    summary = `${sentences[0]}. `;
    
    if (sentences.length > 5) {
      summary += `${sentences[Math.floor(sentences.length / 2)]}. `;
    }
    
    summary += `${sentences[sentences.length - 1]}.`;
  } else {
    summary = content;
  }
  
  summary += `\n\nThis document contains approximately ${wordCount} words.`;
  
  return summary;
}

function generateKnowledgeBaseAnalysis(knowledgeBase: any, documents: any[]): string {
  // In a real application, this would use an AI model
  const totalDocuments = documents.length;
  const totalWords = documents.reduce((sum, doc) => {
    return sum + doc.content.split(/\s+/).length;
  }, 0);
  
  const topics = new Set<string>();
  documents.forEach(doc => {
    const words = doc.content.toLowerCase().split(/\s+/);
    const potentialTopics = words.filter(w => w.length > 5);
    
    // Add some random words as "topics"
    for (let i = 0; i < Math.min(3, potentialTopics.length); i++) {
      const randomIndex = Math.floor(Math.random() * potentialTopics.length);
      topics.add(potentialTopics[randomIndex]);
    }
  });
  
  return `# Knowledge Base Analysis: ${knowledgeBase.title}

## Overview
This knowledge base contains ${totalDocuments} documents with approximately ${totalWords} words in total.

## Content Topics
The main topics in this knowledge base appear to be:
${Array.from(topics).map(topic => `- ${topic}`).join('\n')}

## Recommendations
- Consider adding more documents to expand the knowledge base
- Organize documents into categories for better navigation
- Add tags to documents to improve searchability
`;
}

function generateAnswer(question: string, documents: any[]): string {
  // In a real application, this would use an AI model
  const lowerQuestion = question.toLowerCase();
  
  // Simple keyword matching
  const relevantDocuments = documents.filter(doc => {
    const lowerContent = doc.content.toLowerCase();
    const words = lowerQuestion.split(/\s+/);
    
    // Check if any important words from the question appear in the document
    return words.some(word => {
      return word.length > 3 && lowerContent.includes(word);
    });
  });
  
  if (relevantDocuments.length === 0) {
    return `I couldn't find information related to your question in the knowledge base. Please try rephrasing your question or adding more content to the knowledge base.`;
  }
  
  // Extract a relevant sentence from the most relevant document
  const mostRelevant = relevantDocuments[0];
  const sentences = mostRelevant.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Find the most relevant sentence
  let bestSentence = sentences[0];
  let bestScore = 0;
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    const words = lowerQuestion.split(/\s+/);
    
    let score = 0;
    for (const word of words) {
      if (word.length > 3 && lowerSentence.includes(word)) {
        score++;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
  }
  
  return `Based on the information in the knowledge base, I found this answer:

${bestSentence}.

This information comes from the document "${mostRelevant.title}".`;
}
```

## Deployment

Let's set up the deployment configuration:

```typescript
// packages/server/src/config/production.ts
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  mcpPort: process.env.MCP_PORT || 3001,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/knowledge-hub',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  environment: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  corsOrigin: process.env.CORS_ORIGIN || '*'
};
```

Create a Docker Compose file for deployment:

```yaml
# docker-compose.yml
version: '3'

services:
  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

  server:
    build:
      context: .
      dockerfile: packages/server/Dockerfile
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - PORT=3000
      - MCP_PORT=3001
      - MONGODB_URI=mongodb://mongodb:27017/knowledge-hub
      - JWT_SECRET=your-secret-key
      - NODE_ENV=production
      - CLIENT_URL=http://localhost:5173
      - CORS_ORIGIN=*
    depends_on:
      - mongodb
    restart: unless-stopped

  client:
    build:
      context: .
      dockerfile: packages/client/Dockerfile
    ports:
      - "5173:80"
    depends_on:
      - server
    restart: unless-stopped

volumes:
  mongodb_data:
```

Create Dockerfiles for the server and client:

```dockerfile
# packages/server/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package.json files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json ./packages/server/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY packages/server ./packages/server
COPY packages/shared ./packages/shared

# Build the application
RUN pnpm --filter @knowledge-hub/server build

# Expose ports
EXPOSE 3000
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production

# Start the server
CMD ["node", "packages/server/dist/index.js"]
```

```dockerfile
# packages/client/Dockerfile
FROM node:20-alpine as build

WORKDIR /app

# Copy package.json files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/client/package.json ./packages/client/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY packages/client ./packages/client
COPY packages/shared ./packages/shared

# Build the application
RUN pnpm --filter @knowledge-hub/client build

# Production stage
FROM nginx:alpine

# Copy built files from build stage
COPY --from=build /app/packages/client/dist /usr/share/nginx/html

# Copy nginx configuration
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

Create an Nginx configuration for the client:

```
# packages/client/nginx.conf
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to the server
    location /api {
        proxy_pass http://server:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy MCP requests to the MCP server
    location /mcp {
        proxy_pass http://server:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Running the Application

To run the application locally:

```bash
# Start the server
cd packages/server
pnpm dev

# In another terminal, start the client
cd packages/client
pnpm dev
```

To deploy the application using Docker Compose:

```bash
docker-compose up -d
```

## Summary

In this final project, we've built a comprehensive full-stack application that demonstrates the practical use of Model Context Protocol (MCP). The Collaborative Knowledge Hub allows users to create, share, and interact with knowledge bases using AI agents.

Key features of the application include:

1. **User Authentication**: Secure user registration and login system.
2. **Knowledge Base Management**: Create, update, and share knowledge bases with collaborators.
3. **Document Management**: Create and edit documents within knowledge bases.
4. **MCP Integration**: Use MCP for context-aware interactions with AI agents.
5. **AI Features**: Document summarization, knowledge base analysis, and question answering.
6. **Responsive UI**: Modern, responsive user interface built with React and Chakra UI.
7. **Deployment**: Docker-based deployment for easy setup in production environments.

This project demonstrates how MCP can be used to build practical applications that leverage context-aware AI interactions. By managing context effectively, the application provides a seamless experience for users working with knowledge bases and AI agents.

## Next Steps

To further enhance this application, consider the following:

1. **Real AI Integration**: Replace the simulated AI functions with actual AI models.
2. **Streaming Responses**: Implement streaming for AI responses using MCP's streaming capabilities.
3. **Advanced Context Management**: Implement more sophisticated context management strategies.
4. **Collaborative Editing**: Add real-time collaborative editing features.
5. **Version History**: Implement document version history and change tracking.
6. **Enhanced Search**: Improve search capabilities with semantic search.
7. **Mobile App**: Develop a mobile application using the same MCP backend.

By building on this foundation, you can create even more powerful applications that leverage the capabilities of MCP for context-aware AI interactions.

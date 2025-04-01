/**
 * TypeScript Fundamentals for MCP
 * 
 * This example demonstrates essential TypeScript concepts needed for MCP implementation.
 */

// Type definitions
type ResourceContent = {
  uri: string;
  text: string;
  metadata?: Record<string, any>;
};

type ResourceResponse = {
  contents: ResourceContent[];
};

type ActionContent = {
  type: string;
  text: string;
};

type ActionResponse = {
  content: ActionContent[];
};

// Interface for a resource handler
interface ResourceHandler {
  (uri: URL, params: Record<string, string>): Promise<ResourceResponse>;
}

// Interface for an action handler
interface ActionHandler<T> {
  (params: T): Promise<ActionResponse>;
}

// Generic function to validate parameters
function validateParams<T>(params: any, validator: (p: any) => p is T): T {
  if (!validator(params)) {
    throw new Error('Invalid parameters');
  }
  return params;
}

// Example resource handler
const greetingResourceHandler: ResourceHandler = async (uri, params) => {
  const { name } = params;
  
  return {
    contents: [{
      uri: uri.href,
      text: `Hello, ${name}! Welcome to MCP.`,
      metadata: {
        timestamp: new Date().toISOString()
      }
    }]
  };
};

// Parameter type for calculator action
interface CalculatorParams {
  a: number;
  b: number;
  operation: 'add' | 'subtract' | 'multiply' | 'divide';
}

// Validator function for calculator parameters
function isCalculatorParams(params: any): params is CalculatorParams {
  return (
    typeof params === 'object' &&
    typeof params.a === 'number' &&
    typeof params.b === 'number' &&
    ['add', 'subtract', 'multiply', 'divide'].includes(params.operation)
  );
}

// Example action handler
const calculatorActionHandler: ActionHandler<CalculatorParams> = async (params) => {
  // Validate parameters
  const validParams = validateParams(params, isCalculatorParams);
  
  // Perform calculation
  let result: number;
  switch (validParams.operation) {
    case 'add':
      result = validParams.a + validParams.b;
      break;
    case 'subtract':
      result = validParams.a - validParams.b;
      break;
    case 'multiply':
      result = validParams.a * validParams.b;
      break;
    case 'divide':
      if (validParams.b === 0) {
        throw new Error('Division by zero');
      }
      result = validParams.a / validParams.b;
      break;
  }
  
  return {
    content: [{
      type: 'text',
      text: `Result: ${result}`
    }]
  };
};

// Example usage
async function demonstrateTypescriptConcepts() {
  // Using the resource handler
  const resourceUri = new URL('greeting://Alice');
  const resourceParams = { name: 'Alice' };
  const resourceResult = await greetingResourceHandler(resourceUri, resourceParams);
  console.log('Resource Result:', resourceResult);
  
  // Using the action handler
  const actionParams: CalculatorParams = {
    a: 10,
    b: 5,
    operation: 'add'
  };
  const actionResult = await calculatorActionHandler(actionParams);
  console.log('Action Result:', actionResult);
  
  // This would cause a type error at compile time
  // const invalidParams: CalculatorParams = {
  //   a: 10,
  //   b: 5,
  //   operation: 'power' // Error: Type '"power"' is not assignable to type...
  // };
  
  // This would throw a runtime error
  try {
    const invalidParams = {
      a: 10,
      b: 0,
      operation: 'divide'
    };
    const result = await calculatorActionHandler(invalidParams);
    console.log('This should not be reached');
  } catch (error) {
    console.log('Caught error:', error.message);
  }
}

// Run the demonstration
demonstrateTypescriptConcepts().catch(console.error);

// Utility class example with generics
class ResourceCache<T> {
  private cache: Map<string, { data: T; timestamp: number }> = new Map();
  private readonly ttl: number;
  
  constructor(ttlMs: number = 60000) {
    this.ttl = ttlMs;
  }
  
  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Example usage of the cache
const resourceCache = new ResourceCache<ResourceResponse>(30000);
resourceCache.set('greeting://Alice', {
  contents: [{
    uri: 'greeting://Alice',
    text: 'Hello, Alice! Welcome to MCP.',
    metadata: {
      timestamp: new Date().toISOString()
    }
  }]
});

const cachedResponse = resourceCache.get('greeting://Alice');
console.log('Cached Response:', cachedResponse);

import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  VStack,
  Divider,
  useColorModeValue,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  HStack,
  Icon,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import {ChevronRightIcon} from '@chakra-ui/icons';
import {Link as RouterLink} from 'react-router-dom';
import {useState, useEffect} from 'react';
import CodeBlock from '../components/CodeBlock';
import {FiCode, FiFileText, FiPlay} from 'react-icons/fi';

const CodeExamplesPage = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setSelectedSection] = useState(1);
  const [codeExamples, setCodeExamples] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const cardBg = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => {
    const fetchCodeExamples = async () => {
      try {
        setLoading(true);
        // In a real application, this would fetch from an API
        // For this example, we'll simulate loading the code examples

        // Simulated code examples for each section
        const examples: Record<string, string> = {};

        // In a real app, these would be fetched from the server
        examples['section1'] = `/**
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
}`;

        examples['section2'] = `/**
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
}`;

        setCodeExamples(examples);
      } catch (error) {
        console.error('Error loading code examples:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCodeExamples();
  }, []);

  const sectionTitles = [
    'Introduction to MCP',
    'TypeScript Fundamentals for MCP',
    'MCP Core Concepts',
    'Building an MCP Server in TypeScript',
    'Building an MCP Client in TypeScript',
    'Advanced MCP Features',
    'Real-world Applications',
    'Testing and Debugging MCP Applications',
    'Deployment and Production Considerations',
    'Final Project',
  ];

  return (
    <Box>
      <Breadcrumb
        spacing="8px"
        separator={<ChevronRightIcon color="gray.500" />}
        mb={4}
      >
        <BreadcrumbItem>
          <BreadcrumbLink as={RouterLink} to="/">
            Home
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>Code Examples</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      <Box
        p={6}
        borderWidth="1px"
        borderRadius="lg"
        borderColor={borderColor}
        bg={bgColor}
        boxShadow="md"
        mb={6}
      >
        <Heading as="h1" size="xl" mb={2}>
          Code Examples
        </Heading>
        <Text mb={4}>
          Explore practical code examples for each section of the MCP course.
          These examples demonstrate the concepts covered in the course and
          provide a starting point for your own MCP implementations.
        </Text>
        <Divider my={4} />

        <Tabs
          variant="enclosed"
          colorScheme="blue"
          onChange={(index) => setSelectedSection(index + 1)}
        >
          <TabList
            overflowX="auto"
            flexWrap="nowrap"
            sx={{scrollbarWidth: 'thin'}}
          >
            {sectionTitles.map((title, idx) => (
              <Tab key={idx} whiteSpace="nowrap">
                {idx + 1}. {title}
              </Tab>
            ))}
          </TabList>
          <TabPanels>
            {sectionTitles.map((title, idx) => (
              <TabPanel key={idx}>
                <VStack align="stretch" spacing={4}>
                  <Heading as="h2" size="lg">
                    {title} Examples
                  </Heading>

                  {loading ? (
                    <Text>Loading code examples...</Text>
                  ) : codeExamples[`section${idx + 1}`] ? (
                    <Box>
                      <HStack mb={2} spacing={4}>
                        <Icon as={FiCode} color="blue.500" />
                        <Text fontWeight="bold">Example Code</Text>
                      </HStack>
                      <CodeBlock
                        code={codeExamples[`section${idx + 1}`]}
                        language="typescript"
                      />

                      <HStack mt={4} spacing={4}>
                        <Button
                          leftIcon={<FiFileText />}
                          colorScheme="blue"
                          variant="outline"
                          as={RouterLink}
                          to={`/section/${idx + 1}`}
                        >
                          View Section Content
                        </Button>
                        <Button leftIcon={<FiPlay />} colorScheme="green">
                          Run Example
                        </Button>
                      </HStack>
                    </Box>
                  ) : (
                    <Text>
                      No code examples available for this section yet.
                    </Text>
                  )}
                </VStack>
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      </Box>

      <Box
        p={6}
        borderWidth="1px"
        borderRadius="lg"
        borderColor={borderColor}
        bg={bgColor}
        boxShadow="md"
      >
        <Heading as="h2" size="lg" mb={4}>
          Practical Exercises
        </Heading>
        <Text mb={4}>
          Test your understanding with these practical exercises. Each exercise
          is designed to reinforce the concepts covered in the course sections.
        </Text>

        <SimpleGrid columns={{base: 1, md: 2}} spacing={6}>
          {sectionTitles.map((title, idx) => (
            <Box
              key={idx}
              p={4}
              borderWidth="1px"
              borderRadius="md"
              borderColor={borderColor}
              bg={cardBg}
            >
              <Heading as="h3" size="md" mb={2}>
                Exercise {idx + 1}: {title}
              </Heading>
              <Text mb={3}>
                Complete the practical exercise for this section to test your
                understanding.
              </Text>
              <Button
                size="sm"
                colorScheme="blue"
                as={RouterLink}
                to={`/exercises/${idx + 1}`}
              >
                Start Exercise
              </Button>
            </Box>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
};

export default CodeExamplesPage;

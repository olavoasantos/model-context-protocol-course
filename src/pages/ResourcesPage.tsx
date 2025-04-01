import {
  Box,
  Heading,
  Text,
  VStack,
  Divider,
  useColorModeValue,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  SimpleGrid,
  Link,
  Icon,
  Button,
  HStack,
} from '@chakra-ui/react';
import {ChevronRightIcon, ExternalLinkIcon} from '@chakra-ui/icons';
import {Link as RouterLink} from 'react-router-dom';
import {FiBook, FiGithub, FiFileText, FiPackage} from 'react-icons/fi';

const ResourcesPage = () => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const cardBg = useColorModeValue('gray.50', 'gray.700');

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
          <BreadcrumbLink>Resources</BreadcrumbLink>
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
          MCP Resources
        </Heading>
        <Text mb={4}>
          Explore these additional resources to deepen your understanding of the
          Model Context Protocol.
        </Text>
        <Divider my={4} />

        <VStack spacing={8} align="stretch">
          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Official Documentation
            </Heading>
            <SimpleGrid columns={{base: 1, md: 2}} spacing={6}>
              <ResourceCard
                title="MCP Specification"
                description="The official Model Context Protocol specification document."
                icon={FiFileText}
                link="https://spec.modelcontextprotocol.io/specification/"
              />
              <ResourceCard
                title="TypeScript SDK Documentation"
                description="Documentation for the official TypeScript SDK for MCP."
                icon={FiBook}
                link="https://github.com/modelcontextprotocol/typescript-sdk"
              />
            </SimpleGrid>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              GitHub Repositories
            </Heading>
            <SimpleGrid columns={{base: 1, md: 2}} spacing={6}>
              <ResourceCard
                title="MCP Specification Repository"
                description="The GitHub repository containing the MCP specification."
                icon={FiGithub}
                link="https://github.com/modelcontextprotocol/specification"
              />
              <ResourceCard
                title="TypeScript SDK Repository"
                description="The official TypeScript SDK for implementing MCP."
                icon={FiGithub}
                link="https://github.com/modelcontextprotocol/typescript-sdk"
              />
              <ResourceCard
                title="MCP Documentation Repository"
                description="The repository for MCP documentation."
                icon={FiGithub}
                link="https://github.com/modelcontextprotocol/docs"
              />
              <ResourceCard
                title="Example Projects"
                description="Example projects demonstrating MCP implementation."
                icon={FiGithub}
                link="https://github.com/modelcontextprotocol/examples"
              />
            </SimpleGrid>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Development Tools
            </Heading>
            <SimpleGrid columns={{base: 1, md: 2}} spacing={6}>
              <ResourceCard
                title="Vite"
                description="Next Generation Frontend Tooling used in our course examples."
                icon={FiPackage}
                link="https://github.com/vitejs/vite"
              />
              <ResourceCard
                title="Vitest"
                description="A Vite-native testing framework used for testing MCP applications."
                icon={FiPackage}
                link="https://github.com/vitest-dev/vitest"
              />
              <ResourceCard
                title="tsx"
                description="TypeScript Execute: Node.js enhanced to run TypeScript & ESM."
                icon={FiPackage}
                link="https://github.com/privatenumber/tsx"
              />
              <ResourceCard
                title="pnpm"
                description="Fast, disk space efficient package manager used in our examples."
                icon={FiPackage}
                link="https://github.com/pnpm/pnpm"
              />
            </SimpleGrid>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Community Resources
            </Heading>
            <SimpleGrid columns={{base: 1, md: 2}} spacing={6}>
              <ResourceCard
                title="MCP Discord Community"
                description="Join the MCP Discord community to connect with other developers."
                icon={FiBook}
                link="#"
              />
              <ResourceCard
                title="MCP Twitter"
                description="Follow MCP on Twitter for the latest updates."
                icon={FiBook}
                link="#"
              />
            </SimpleGrid>
          </Box>
        </VStack>
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
          Additional Learning Materials
        </Heading>
        <Text mb={4}>
          Explore these additional learning materials to enhance your MCP
          knowledge.
        </Text>

        <SimpleGrid columns={{base: 1, md: 2}} spacing={6}>
          <Box
            p={4}
            borderWidth="1px"
            borderRadius="md"
            borderColor={borderColor}
            bg={cardBg}
          >
            <Heading as="h3" size="md" mb={2}>
              TypeScript Advanced Concepts
            </Heading>
            <Text mb={3}>
              Deepen your TypeScript knowledge with advanced concepts relevant
              to MCP.
            </Text>
            <Button
              size="sm"
              colorScheme="blue"
              rightIcon={<ExternalLinkIcon />}
              as="a"
              href="https://www.typescriptlang.org/docs/"
              target="_blank"
            >
              Learn More
            </Button>
          </Box>

          <Box
            p={4}
            borderWidth="1px"
            borderRadius="md"
            borderColor={borderColor}
            bg={cardBg}
          >
            <Heading as="h3" size="md" mb={2}>
              Context Management Patterns
            </Heading>
            <Text mb={3}>
              Learn about different patterns for managing context in
              applications.
            </Text>
            <Button
              size="sm"
              colorScheme="blue"
              rightIcon={<ExternalLinkIcon />}
              as="a"
              href="#"
              target="_blank"
            >
              Learn More
            </Button>
          </Box>
        </SimpleGrid>
      </Box>
    </Box>
  );
};

interface ResourceCardProps {
  title: string;
  description: string;
  icon: any;
  link: string;
}

const ResourceCard = ({title, description, icon, link}: ResourceCardProps) => {
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const cardBg = useColorModeValue('gray.50', 'gray.700');

  return (
    <Box
      p={4}
      borderWidth="1px"
      borderRadius="md"
      borderColor={borderColor}
      bg={cardBg}
      transition="all 0.3s"
      _hover={{transform: 'translateY(-2px)', boxShadow: 'md'}}
    >
      <HStack mb={2}>
        <Icon as={icon} color="blue.500" boxSize={5} />
        <Heading as="h3" size="md">
          {title}
        </Heading>
      </HStack>
      <Text mb={3}>{description}</Text>
      <Link
        href={link}
        isExternal
        color="blue.500"
        display="flex"
        alignItems="center"
      >
        Visit Resource <ExternalLinkIcon mx="2px" />
      </Link>
    </Box>
  );
};

export default ResourcesPage;

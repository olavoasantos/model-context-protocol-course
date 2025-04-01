import {
  Box,
  Heading,
  Text,
  VStack,
  Button,
  Container,
  SimpleGrid,
  Icon,
  useColorModeValue,
} from '@chakra-ui/react';
import {FiBook, FiCode, FiServer, FiUsers} from 'react-icons/fi';
import {Link as RouterLink} from 'react-router-dom';
import { sectionsContent } from '../content';

const HomePage = () => {
  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        {/* Hero Section */}
        <Box
          p={10}
          borderRadius="lg"
          bg={useColorModeValue('blue.50', 'blue.900')}
          textAlign="center"
        >
          <Heading as="h1" size="2xl" mb={4}>
            Model Context Protocol (MCP) Course
          </Heading>
          <Text fontSize="xl" mb={6}>
            A comprehensive learning course on implementing MCP in TypeScript
          </Text>
          <Button as={RouterLink} to="/section/1" colorScheme="blue" size="lg">
            Start Learning
          </Button>
        </Box>

        {/* Course Overview */}
        <Box>
          <Heading as="h2" size="xl" mb={6}>
            Course Overview
          </Heading>
          <Text fontSize="lg" mb={6}>
            This comprehensive course teaches you how to implement the Model
            Context Protocol (MCP) using TypeScript. You'll learn both client
            and server implementations with practical applications, from basic
            concepts to advanced features and real-world deployment.
          </Text>

          <SimpleGrid columns={{base: 1, md: 2, lg: 4}} spacing={6} mt={8}>
            <FeatureCard
              icon={FiBook}
              title="MCP Fundamentals"
              description="Learn the core concepts of Model Context Protocol and how it enables effective AI agent interactions."
            />
            <FeatureCard
              icon={FiCode}
              title="TypeScript Implementation"
              description="Implement MCP in TypeScript with step-by-step guidance and best practices."
            />
            <FeatureCard
              icon={FiServer}
              title="Client & Server Development"
              description="Build both client and server components with practical exercises and examples."
            />
            <FeatureCard
              icon={FiUsers}
              title="Multi-Agent Communication"
              description="Create systems where multiple agents communicate effectively using MCP."
            />
          </SimpleGrid>
        </Box>

        {/* Course Structure */}
        <Box mt={8}>
          <Heading as="h2" size="xl" mb={6}>
            Course Structure
          </Heading>
          <Text fontSize="lg" mb={6}>
            The course is divided into 10 comprehensive sections, each building
            on the previous one:
          </Text>

          <VStack spacing={4} align="stretch">
            {sectionsContent.map((section, index) => (
              <SectionLink key={`section-${section.title}`} number={index + 1} title={section.title} />
            ))}
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
};

const FeatureCard = ({icon, title, description}: any) => {
  const cardBg = useColorModeValue('white', 'gray.700');
  const cardBorder = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box
      p={6}
      borderWidth="1px"
      borderRadius="lg"
      borderColor={cardBorder}
      bg={cardBg}
      boxShadow="md"
    >
      <Icon as={icon} w={10} h={10} color="blue.500" mb={4} />
      <Heading as="h3" size="md" mb={2}>
        {title}
      </Heading>
      <Text color={useColorModeValue('gray.600', 'gray.300')}>
        {description}
      </Text>
    </Box>
  );
};

const SectionLink = ({number, title}: any) => {
  const bg = useColorModeValue('gray.50', 'gray.800');
  const hoverBg = useColorModeValue('blue.50', 'blue.900');

  return (
    <Button
      as={RouterLink}
      to={`/section/${number}`}
      variant="outline"
      justifyContent="flex-start"
      width="100%"
      p={4}
      bg={bg}
      _hover={{bg: hoverBg, borderColor: 'blue.500'}}
      leftIcon={<Text fontWeight="bold">{number}.</Text>}
    >
      {title}
    </Button>
  );
};

export default HomePage;

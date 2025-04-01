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

import {sectionsContent} from '../content';

const CodeExamplesPage = () => {
  const [selectedSection, setSelectedSection] = useState(1);
  const [codeExamples, setCodeExamples] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  useEffect(() => {
    const fetchCodeExamples = async () => {
      if (codeExamples[`section${selectedSection}`]) return;
      try {
        setLoading(true);

        const section = sectionsContent[selectedSection - 1];
        const response = await section.codeExample();
        if (response.default) {
          setCodeExamples((examples) => ({
            ...examples,
            [`section${selectedSection}`]: response.default,
          }));
        }
      } catch (error) {
        console.error('Error loading code examples:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCodeExamples();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSection]);

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
            {sectionsContent.map((section, idx) => (
              <Tab key={idx} whiteSpace="nowrap">
                {idx + 1}. {section.title}
              </Tab>
            ))}
          </TabList>
          <TabPanels>
            {sectionsContent.map((section, idx) => (
              <TabPanel key={idx}>
                <VStack align="stretch" spacing={4}>
                  <Heading as="h2" size="lg">
                    {section.title} Examples
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
                        <Button
                          leftIcon={<FiPlay />}
                          colorScheme="green"
                          disabled
                        >
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
    </Box>
  );
};

export default CodeExamplesPage;

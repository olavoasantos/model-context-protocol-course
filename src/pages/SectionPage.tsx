import {useParams} from 'react-router-dom';
import {
  Box,
  Text,
  VStack,
  useColorModeValue,
  Button,
  HStack,
  Flex,
  Breadcrumb as ChakraBreadcrumb,
  BreadcrumbItem as ChakraBreadcrumbItem,
  BreadcrumbLink as ChakraBreadcrumbLink,
} from '@chakra-ui/react';
import {
  ChevronRightIcon,
  ArrowBackIcon,
  ArrowForwardIcon,
} from '@chakra-ui/icons';
import {Link as RouterLink} from 'react-router-dom';
import {useEffect, useState} from 'react';
import ReactMarkdown from 'react-markdown';
import ChakraUIRenderer from 'chakra-ui-markdown-renderer';
import {sectionsContent} from '../content';

const unknownSection = {
  title: 'Unknown Section',
  import: async () => ({default: '# Unknown Section'}),
};

const SectionPage = () => {
  const {sectionId} = useParams();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const sectionNumber = parseInt(sectionId || '1');
  const sectionTitle = sectionsContent[sectionNumber - 1] || unknownSection;

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        const response = await sectionTitle.lecture();
        if (!response.default) {
          throw new Error(
            `Failed to load content for section ${sectionNumber}`,
          );
        }
        setContent(response.default);
        setError(null);
      } catch (err) {
        console.error('Error loading section content:', err);
        setError('Failed to load section content. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionNumber]);

  const prevSection = sectionNumber > 1 ? sectionNumber - 1 : null;
  const nextSection = sectionNumber < 10 ? sectionNumber + 1 : null;

  return (
    <Box>
      <Flex mb={4}>
        <ChakraBreadcrumb
          spacing="8px"
          separator={<ChevronRightIcon color="gray.500" />}
        >
          <ChakraBreadcrumbItem>
            <ChakraBreadcrumbLink as={RouterLink} to="/">
              Home
            </ChakraBreadcrumbLink>
          </ChakraBreadcrumbItem>
          <ChakraBreadcrumbItem>
            <ChakraBreadcrumbLink as={RouterLink} to="/section">
              Sections
            </ChakraBreadcrumbLink>
          </ChakraBreadcrumbItem>
          <ChakraBreadcrumbItem>
            <ChakraBreadcrumbLink>
              {sectionNumber}. {sectionTitle.title}
            </ChakraBreadcrumbLink>
          </ChakraBreadcrumbItem>
        </ChakraBreadcrumb>
      </Flex>

      <Box
        p={6}
        borderWidth="1px"
        borderRadius="lg"
        borderColor={borderColor}
        bg={bgColor}
        boxShadow="md"
        mb={6}
      >
        {loading ? (
          <Text>Loading section content...</Text>
        ) : error ? (
          <Text color="red.500">{error}</Text>
        ) : (
          <VStack align="stretch" spacing="4">
            <ReactMarkdown children={content} components={ChakraUIRenderer()} />
          </VStack>
        )}
      </Box>

      <HStack justifyContent="space-between" mt={8}>
        {prevSection ? (
          <Button
            as={RouterLink}
            to={`/section/${prevSection}`}
            leftIcon={<ArrowBackIcon />}
            colorScheme="blue"
            variant="outline"
          >
            Previous: {sectionsContent[prevSection - 1].title}
          </Button>
        ) : (
          <Box /> // Empty box for spacing
        )}

        {nextSection ? (
          <Button
            as={RouterLink}
            to={`/section/${nextSection}`}
            rightIcon={<ArrowForwardIcon />}
            colorScheme="blue"
          >
            Next: {sectionsContent[nextSection - 1].title}
          </Button>
        ) : (
          <Button
            as={RouterLink}
            to="/code-examples"
            rightIcon={<ArrowForwardIcon />}
            colorScheme="green"
          >
            View Code Examples
          </Button>
        )}
      </HStack>
    </Box>
  );
};

export default SectionPage;

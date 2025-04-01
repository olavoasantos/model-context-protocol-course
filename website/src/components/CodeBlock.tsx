import {Prism as SyntaxHighlighter} from 'react-syntax-highlighter';
import {tomorrow} from 'react-syntax-highlighter/dist/esm/styles/prism';
import {Box, useColorModeValue, Button, useClipboard} from '@chakra-ui/react';
import {FiCopy, FiCheck} from 'react-icons/fi';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  fileName?: string;
}

const CodeBlock = ({
  code,
  language = 'typescript',
  showLineNumbers = true,
  fileName,
}: CodeBlockProps) => {
  const {hasCopied, onCopy} = useClipboard(code);
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const boxBg = useColorModeValue('gray.100', 'gray.700');
  const boxColor = useColorModeValue('gray.600', 'gray.300');

  return (
    <Box position="relative" my={4}>
      {fileName && (
        <Box
          bg={boxBg}
          color={boxColor}
          px={4}
          py={1}
          borderTopRadius="md"
          borderWidth="1px"
          borderBottomWidth="0"
          borderColor={borderColor}
          fontSize="sm"
          fontFamily="mono"
        >
          {fileName}
        </Box>
      )}

      <Box position="relative">
        <Button
          position="absolute"
          top={2}
          right={2}
          size="sm"
          onClick={onCopy}
          zIndex={1}
          colorScheme={hasCopied ? 'green' : 'blue'}
          leftIcon={hasCopied ? <FiCheck /> : <FiCopy />}
        >
          {hasCopied ? 'Copied' : 'Copy'}
        </Button>

        <Box
          borderWidth="1px"
          borderColor={borderColor}
          borderRadius={fileName ? '0 0 md md' : 'md'}
          overflow="hidden"
        >
          <SyntaxHighlighter
            language={language}
            style={tomorrow}
            showLineNumbers={showLineNumbers}
            customStyle={{
              margin: 0,
              borderRadius: fileName ? '0 0 0.375rem 0.375rem' : '0.375rem',
              fontSize: '0.9rem',
            }}
          >
            {code}
          </SyntaxHighlighter>
        </Box>
      </Box>
    </Box>
  );
};

export default CodeBlock;

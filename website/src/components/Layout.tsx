import {Box, Container, Flex, useColorModeValue} from '@chakra-ui/react';
import {Outlet} from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Layout = () => {
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box minH="100vh" bg={bgColor}>
      <Navbar />
      <Flex>
        <Sidebar />
        <Box
          flex="1"
          p={4}
          ml={{base: 0, md: 60}}
          transition=".3s ease"
          borderLeftWidth={{base: 0, md: '1px'}}
          borderColor={borderColor}
        >
          <Container maxW="container.xl" py={6}>
            <Outlet />
          </Container>
        </Box>
      </Flex>
    </Box>
  );
};

export default Layout;

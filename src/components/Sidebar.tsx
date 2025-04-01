import {
  Box,
  Flex,
  Icon,
  useColorModeValue,
  Link,
  FlexProps,
} from '@chakra-ui/react';
import {
  FiHome,
  FiBook,
  FiCode,
  FiServer,
  FiTerminal,
  FiSettings,
  FiGlobe,
  FiCheckSquare,
  FiCloud,
  FiPackage,
  FiLink,
} from 'react-icons/fi';
import {IconType} from 'react-icons';
import {Link as RouterLink} from 'react-router-dom';

interface LinkItemProps {
  name: string;
  icon: IconType;
  path: string;
  children?: Array<{name: string; path: string}>;
}

const LinkItems: Array<LinkItemProps> = [
  {name: 'Home', icon: FiHome, path: '/'},
  {
    name: '1. Introduction to MCP',
    icon: FiBook,
    path: '/section/1',
  },
  {
    name: '2. TypeScript Fundamentals',
    icon: FiCode,
    path: '/section/2',
  },
  {
    name: '3. MCP Core Concepts',
    icon: FiLink,
    path: '/section/3',
  },
  {
    name: '4. Building an MCP Server',
    icon: FiServer,
    path: '/section/4',
  },
  {
    name: '5. Building an MCP Client',
    icon: FiTerminal,
    path: '/section/5',
  },
  {
    name: '6. Advanced MCP Features',
    icon: FiSettings,
    path: '/section/6',
  },
  {
    name: '7. Real-world Applications',
    icon: FiGlobe,
    path: '/section/7',
  },
  {
    name: '8. Testing and Debugging',
    icon: FiCheckSquare,
    path: '/section/8',
  },
  {
    name: '9. Deployment and Production',
    icon: FiCloud,
    path: '/section/9',
  },
  {
    name: '10. Final Project',
    icon: FiPackage,
    path: '/section/10',
  },
];

const Sidebar = () => {
  return (
    <Box
      display={{base: 'none', md: 'block'}}
      bg={useColorModeValue('white', 'gray.900')}
      borderRight="1px"
      borderRightColor={useColorModeValue('gray.200', 'gray.700')}
      w={{base: 'full', md: 60}}
      pos="fixed"
      h="full"
      overflowY="auto"
      paddingBlockStart="4"
    >
      {LinkItems.map((link) => (
        <NavItem key={link.name} icon={link.icon} path={link.path}>
          {link.name}
        </NavItem>
      ))}
    </Box>
  );
};

interface NavItemProps extends FlexProps {
  icon: IconType;
  path: string;
  children: React.ReactNode;
}

const NavItem = ({icon, path, children, ...rest}: NavItemProps) => {
  return (
    <Link as={RouterLink} to={path} style={{textDecoration: 'none'}}>
      <Flex
        align="center"
        p="4"
        mx="4"
        borderRadius="lg"
        role="group"
        cursor="pointer"
        _hover={{
          bg: 'blue.400',
          color: 'white',
        }}
        {...rest}
      >
        {icon && (
          <Icon
            mr="4"
            fontSize="16"
            _groupHover={{
              color: 'white',
            }}
            as={icon}
          />
        )}
        {children}
      </Flex>
    </Link>
  );
};

export default Sidebar;

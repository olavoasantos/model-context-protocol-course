import {ChakraProvider, extendTheme} from '@chakra-ui/react';
import {createHashRouter, RouterProvider} from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import SectionPage from './pages/SectionPage';
import CodeExamplesPage from './pages/CodeExamplesPage';
import ResourcesPage from './pages/ResourcesPage';

// Create a custom theme with proper type support
const theme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: true,
  },
});

// Create router with proper configuration
const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'section/:sectionId',
        element: <SectionPage />,
      },
      {
        path: 'code-examples',
        element: <CodeExamplesPage />,
      },
      {
        path: 'resources',
        element: <ResourcesPage />,
      },
      {
        path: '*',
        element: <HomePage />,
      },
    ],
  },
]);

function App() {
  return (
    <ChakraProvider theme={theme}>
      <RouterProvider router={router} />
    </ChakraProvider>
  );
}

export default App;

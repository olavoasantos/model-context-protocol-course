export const sectionsContent = [
  {
    title: 'Introduction to MCP',
    lecture: () => import('./section1/lecture.md?raw'),
    codeExample: () => import('./section1/code-example.ts?raw'),
  },
  {
    title: 'TypeScript Fundamentals for MCP',
    lecture: () => import('./section2/lecture.md?raw'),
    codeExample: () => import('./section2/code-example.ts?raw'),
  },
  {
    title: 'MCP Core Concepts',
    lecture: () => import('./section3/lecture.md?raw'),
    codeExample: () => import('./section3/code-example.ts?raw'),
  },
  {
    title: 'Building an MCP Server in TypeScript',
    lecture: () => import('./section4/lecture.md?raw'),
    codeExample: () => import('./section4/code-example.ts?raw'),
  },
  {
    title: 'Building an MCP Client in TypeScript',
    lecture: () => import('./section5/lecture.md?raw'),
    codeExample: () => import('./section5/code-example.ts?raw'),
  },
  {
    title: 'Advanced MCP Features',
    lecture: () => import('./section6/lecture.md?raw'),
    codeExample: () => import('./section6/code-example.ts?raw'),
  },
  {
    title: 'Real-world Applications',
    lecture: () => import('./section7/lecture.md?raw'),
    codeExample: () => import('./section7/code-example.ts?raw'),
  },
  {
    title: 'Testing and Debugging MCP Applications',
    lecture: () => import('./section8/lecture.md?raw'),
    codeExample: () => import('./section8/code-example.ts?raw'),
  },
  {
    title: 'Deployment and Production Considerations',
    lecture: () => import('./section9/lecture.md?raw'),
    codeExample: () => import('./section9/code-example.ts?raw'),
  },
  {
    title: 'Final Project',
    lecture: () => import('./section10/lecture.md?raw'),
    codeExample: () => import('./section10/code-example.ts?raw'),
  },
];

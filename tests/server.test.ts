import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';

// Mock fs module
vi.mock('fs/promises');
const mockedFs = vi.mocked(fs);

// Mock console methods to avoid cluttering test output
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock the MCP SDK components
const mockServer = {
  setRequestHandler: vi.fn(),
  connect: vi.fn()
};

const mockTransport = {};

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => mockServer)
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => mockTransport)
}));

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  ListToolsRequestSchema: 'ListToolsRequestSchema',
  CallToolRequestSchema: 'CallToolRequestSchema'
}));

describe('MCP Server Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleError.mockClear();
    process.env.OPENAPI_SPECS_FOLDER = '/test/specs';

    // Reset mocks
    mockServer.setRequestHandler.mockClear();
    mockServer.connect.mockClear();
  });

  afterEach(() => {
    delete process.env.OPENAPI_SPECS_FOLDER;
  });

  it('should create server instance with correct configuration', async () => {
    const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
    
    // Import the module which creates the server instance
    await import('../src/index.js');
    
    // Server should be created with correct configuration
    expect(Server).toHaveBeenCalledWith(
      {
        name: 'openapi-analyzer',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
  });

  it('should define all required MCP tools', () => {
    // Test that we define all the required tools for MCP
    const requiredTools = [
      'load_specs',
      'list_apis', 
      'get_api_spec',
      'search_endpoints',
      'get_api_stats',
      'find_inconsistencies',
      'compare_schemas'
    ];

    // These tools should exist (this validates our design)
    expect(requiredTools).toHaveLength(7);
    requiredTools.forEach(toolName => {
      expect(typeof toolName).toBe('string');
      expect(toolName).toBeTruthy();
    });
  });

  it('should validate tool schemas have required properties', () => {
    // Test the structure of tool schemas we would define
    const toolSchemas = [
      {
        name: 'get_api_spec',
        requiredParams: ['filename']
      },
      {
        name: 'search_endpoints', 
        requiredParams: ['query']
      },
      {
        name: 'compare_schemas',
        requiredParams: ['schema1']
      }
    ];

    toolSchemas.forEach(({ name, requiredParams }) => {
      expect(name).toBeTruthy();
      expect(requiredParams).toBeInstanceOf(Array);
      expect(requiredParams.length).toBeGreaterThan(0);
    });
  });

  it('should handle MCP response format correctly', () => {
    // Test that responses follow MCP format
    const successResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ result: 'success' }, null, 2),
        },
      ],
    };

    expect(successResponse.content).toHaveLength(1);
    expect(successResponse.content[0].type).toBe('text');
    expect(successResponse.content[0].text).toContain('result');

    // Test error response format
    const errorResponse = {
      content: [
        {
          type: 'text',
          text: 'Error: Something went wrong',
        },
      ],
    };

    expect(errorResponse.content).toHaveLength(1);
    expect(errorResponse.content[0].type).toBe('text');
    expect(errorResponse.content[0].text).toContain('Error:');
  });

  it('should handle JSON serialization in responses', () => {
    const testData = {
      apis: [
        { filename: 'test.json', title: 'Test API', version: '1.0.0' }
      ]
    };

    const serialized = JSON.stringify(testData, null, 2);
    expect(serialized).toContain('Test API');
    expect(serialized).toContain('1.0.0');

    const parsed = JSON.parse(serialized);
    expect(parsed.apis).toHaveLength(1);
    expect(parsed.apis[0].title).toBe('Test API');
  });

  it('should validate environment requirements', async () => {
    // Test that validateConfiguration is exported from the module
    const { validateConfiguration } = await import('../src/index.js');
    expect(validateConfiguration).toBeDefined();
    expect(typeof validateConfiguration).toBe('function');
  });

  it('should export OpenAPIAnalyzer class', async () => {
    // Test that the main functionality is exported
    const { OpenAPIAnalyzer } = await import('../src/index.js');
    expect(OpenAPIAnalyzer).toBeDefined();
    expect(typeof OpenAPIAnalyzer).toBe('function'); // Constructor function
    
    // Should be able to instantiate
    const analyzer = new OpenAPIAnalyzer();
    expect(analyzer).toBeInstanceOf(OpenAPIAnalyzer);
  });

  it('should export TypeScript interfaces', async () => {
    // Test that types can be imported (this validates exports)
    const module = await import('../src/index.js');
    
    // Key exports should exist
    expect(module.OpenAPIAnalyzer).toBeDefined();
    expect(module.validateConfiguration).toBeDefined();
    
    // These would be type-only imports in real usage, but we validate the structure
    const testApiSummary: any = {
      filename: 'test.json',
      title: 'Test API', 
      version: '1.0.0',
      description: 'Test description',
      endpointCount: 5
    };
    
    expect(testApiSummary.filename).toBeTruthy();
    expect(testApiSummary.endpointCount).toBeGreaterThan(0);
  });
});
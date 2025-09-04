#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * OpenAPI Analyzer MCP Server - A Model Context Protocol server for analyzing OpenAPI specifications
 * 
 * This server provides tools to load, analyze, and compare OpenAPI specification files,
 * enabling natural language queries about API structures, endpoints, and inconsistencies.
 */

// Configuration
const SPECS_FOLDER = process.env.OPENAPI_SPECS_FOLDER;

/**
 * Validate the OPENAPI_SPECS_FOLDER configuration
 */
export async function validateSpecsFolder(): Promise<string> {
  if (!SPECS_FOLDER) {
    console.error('❌ Error: OPENAPI_SPECS_FOLDER environment variable is required');
    console.error('');
    console.error('Please set it to the absolute path of your OpenAPI specifications folder.');
    console.error('');
    console.error('Examples:');
    console.error('  macOS/Linux: OPENAPI_SPECS_FOLDER=/Users/john/my-apis');
    console.error('  Windows: OPENAPI_SPECS_FOLDER=C:\\Users\\john\\my-apis');
    console.error('');
    console.error('Claude Desktop configuration example:');
    console.error('  "env": {');
    console.error('    "OPENAPI_SPECS_FOLDER": "/absolute/path/to/your/specs"');
    console.error('  }');
    process.exit(1);
  }

  try {
    // Check if the folder exists and is accessible
    const stats = await fs.stat(SPECS_FOLDER);
    
    if (!stats.isDirectory()) {
      console.error(`❌ Error: OPENAPI_SPECS_FOLDER is not a directory: ${SPECS_FOLDER}`);
      console.error('');
      console.error('Please provide a path to a directory containing your OpenAPI JSON files.');
      process.exit(1);
    }

    // Try to read the directory to check permissions
    await fs.access(SPECS_FOLDER, fs.constants.R_OK);
    
    return SPECS_FOLDER;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error(`❌ Error: OPENAPI_SPECS_FOLDER does not exist: ${SPECS_FOLDER}`);
      console.error('');
      console.error('Please create the directory or provide a path to an existing directory.');
    } else if (error.code === 'EACCES') {
      console.error(`❌ Error: No read permission for OPENAPI_SPECS_FOLDER: ${SPECS_FOLDER}`);
      console.error('');
      console.error('Please check the folder permissions.');
    } else {
      console.error(`❌ Error accessing OPENAPI_SPECS_FOLDER: ${error.message}`);
    }
    process.exit(1);
  }
}

export interface OpenAPIInfo {
  title?: string;
  version?: string;
  description?: string;
}

export interface OpenAPISpec {
  filename: string;
  spec: Record<string, any>;
  info?: OpenAPIInfo;
  paths?: Record<string, any>;
  components?: Record<string, any>;
}

export interface ApiSummary {
  filename: string;
  title: string;
  version: string;
  description: string;
  endpointCount: number;
}

export interface SearchResult {
  filename: string;
  api_title?: string;
  path: string;
  method: string;
  summary?: string;
  description?: string;
  operationId?: string;
}

export interface ApiStats {
  totalApis: number;
  totalEndpoints: number;
  methodCounts: Record<string, number>;
  commonPaths: Record<string, number>;
  versions: Record<string, number>;
  apis: Array<{
    filename: string;
    title?: string;
    version?: string;
    endpointCount: number;
    methods: string[];
  }>;
}

export interface Inconsistency {
  type: string;
  message: string;
  details: Record<string, any>;
}

export interface SchemaComparison {
  filename: string;
  api?: string;
  schemaName: string;
  schema: Record<string, any>;
}

/**
 * Main analyzer class for OpenAPI specifications
 */
export class OpenAPIAnalyzer {
  private specs: OpenAPISpec[] = [];

  /**
   * Validate the OPENAPI_SPECS_FOLDER configuration for this instance
   */
  private async validateSpecsFolder(): Promise<string> {
    const SPECS_FOLDER = process.env.OPENAPI_SPECS_FOLDER;
    
    if (!SPECS_FOLDER) {
      throw new Error('OPENAPI_SPECS_FOLDER environment variable is required');
    }

    try {
      const stats = await fs.stat(SPECS_FOLDER);
      
      if (!stats.isDirectory()) {
        throw new Error(`OPENAPI_SPECS_FOLDER is not a directory: ${SPECS_FOLDER}`);
      }

      await fs.access(SPECS_FOLDER, fs.constants.R_OK);
      
      return SPECS_FOLDER;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`OPENAPI_SPECS_FOLDER does not exist: ${SPECS_FOLDER}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`No read permission for OPENAPI_SPECS_FOLDER: ${SPECS_FOLDER}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Load all OpenAPI specification files from the configured folder
   */
  async loadSpecs(): Promise<void> {
    const validatedFolder = await this.validateSpecsFolder();
    
    try {
      const files = await fs.readdir(validatedFolder);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      if (jsonFiles.length === 0) {
        console.error(`⚠️  Warning: No .json files found in ${validatedFolder}`);
        console.error('');
        console.error('Please ensure your OpenAPI specifications are:');
        console.error('  - Saved as .json files (not .yaml or .yml)');
        console.error('  - Located in the specified folder');
        console.error('');
        console.error('If you have YAML files, convert them to JSON first.');
      } else {
        console.error(`📁 Found ${jsonFiles.length} JSON files in ${validatedFolder}`);
      }
      
      this.specs = [];
      
      for (const file of jsonFiles) {
        await this.loadSingleSpec(file, validatedFolder);
      }
      
      if (this.specs.length === 0 && jsonFiles.length > 0) {
        console.error('❌ No valid OpenAPI specifications were loaded');
        console.error('');
        console.error('Common issues:');
        console.error('  - Files are not valid JSON');
        console.error('  - Files do not contain OpenAPI/Swagger specifications');
        console.error('  - Files are missing "openapi" or "swagger" fields');
      } else {
        console.error(`✅ Successfully loaded ${this.specs.length} OpenAPI specs`);
      }
    } catch (error: any) {
      console.error(`❌ Error reading specs folder: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load a single OpenAPI specification file
   */
  private async loadSingleSpec(filename: string, specsFolder: string): Promise<void> {
    try {
      const filePath = path.join(specsFolder, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      
      let spec: Record<string, any>;
      try {
        spec = JSON.parse(content);
      } catch (parseError) {
        console.error(`⚠️  Skipping ${filename}: Invalid JSON format`);
        return;
      }
      
      // Validate that this looks like an OpenAPI spec
      if (!spec.openapi && !spec.swagger) {
        console.error(`⚠️  Skipping ${filename}: Not an OpenAPI/Swagger specification (missing 'openapi' or 'swagger' field)`);
        return;
      }
      
      // Additional validation for common issues
      if (!spec.info) {
        console.error(`⚠️  Warning: ${filename} missing 'info' section, but will be loaded`);
      }
      
      if (!spec.paths || Object.keys(spec.paths).length === 0) {
        console.error(`⚠️  Warning: ${filename} has no paths defined`);
      }
      
      this.specs.push({
        filename,
        spec,
        info: spec.info,
        paths: spec.paths,
        components: spec.components
      });
      
      console.error(`  ✓ Loaded ${filename} (${spec.info?.title || 'Untitled'} v${spec.info?.version || 'unknown'})`);
    } catch (error: any) {
      console.error(`❌ Error loading ${filename}: ${error.message}`);
    }
  }

  /**
   * Get a summary of all loaded OpenAPI specifications
   */
  listAllSpecs(): ApiSummary[] {
    return this.specs.map(spec => ({
      filename: spec.filename,
      title: spec.info?.title || 'No title',
      version: spec.info?.version || 'No version',
      description: spec.info?.description || 'No description',
      endpointCount: spec.paths ? Object.keys(spec.paths).length : 0
    }));
  }

  /**
   * Get the full OpenAPI specification by filename
   */
  getSpecByFilename(filename: string): Record<string, any> | null {
    const spec = this.specs.find(s => s.filename === filename);
    return spec ? spec.spec : null;
  }

  /**
   * Search for endpoints across all APIs by keyword
   */
  searchEndpoints(query: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const spec of this.specs) {
      if (!spec.paths) continue;

      for (const [path, pathItem] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathItem as Record<string, any>)) {
          if (typeof operation !== 'object' || operation === null) continue;

          const operationObj = operation as Record<string, any>;
          const searchableText = [
            path,
            method,
            operationObj.summary || '',
            operationObj.description || '',
            operationObj.operationId || ''
          ].join(' ').toLowerCase();
          
          if (searchableText.includes(lowerQuery)) {
            results.push({
              filename: spec.filename,
              api_title: spec.info?.title,
              path,
              method: method.toUpperCase(),
              summary: operationObj.summary,
              description: operationObj.description,
              operationId: operationObj.operationId
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Generate comprehensive statistics about all loaded APIs
   */
  getApiStats(): ApiStats {
    const stats: ApiStats = {
      totalApis: this.specs.length,
      totalEndpoints: 0,
      methodCounts: {},
      commonPaths: {},
      versions: {},
      apis: []
    };

    const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
    
    for (const spec of this.specs) {
      let endpointCount = 0;
      const apiMethods = new Set<string>();

      if (spec.paths) {
        for (const [path, pathItem] of Object.entries(spec.paths)) {
          for (const method of Object.keys(pathItem as Record<string, any>)) {
            if (httpMethods.includes(method.toLowerCase())) {
              endpointCount++;
              const upperMethod = method.toUpperCase();
              apiMethods.add(upperMethod);
              stats.methodCounts[upperMethod] = (stats.methodCounts[upperMethod] || 0) + 1;
            }
          }
          
          // Track common path patterns
          const pathPattern = path.replace(/\{[^}]+\}/g, '{id}');
          stats.commonPaths[pathPattern] = (stats.commonPaths[pathPattern] || 0) + 1;
        }
      }

      stats.totalEndpoints += endpointCount;
      
      const version = spec.info?.version || 'unknown';
      stats.versions[version] = (stats.versions[version] || 0) + 1;

      stats.apis.push({
        filename: spec.filename,
        title: spec.info?.title,
        version: spec.info?.version,
        endpointCount,
        methods: Array.from(apiMethods).sort()
      });
    }

    return stats;
  }

  /**
   * Find inconsistencies in authentication schemes and naming conventions across APIs
   */
  findInconsistencies(): Inconsistency[] {
    const inconsistencies: Inconsistency[] = [];
    
    // Check authentication schemes
    const authSchemes = new Map<string, string[]>();
    
    for (const spec of this.specs) {
      if (spec.spec.components?.securitySchemes) {
        for (const [name, scheme] of Object.entries(spec.spec.components.securitySchemes as Record<string, any>)) {
          const schemeObj = scheme as Record<string, any>;
          const type = schemeObj.type;
          
          if (type) {
            if (!authSchemes.has(type)) {
              authSchemes.set(type, []);
            }
            authSchemes.get(type)!.push(`${spec.filename}: ${name}`);
          }
        }
      }
    }

    // Report auth inconsistencies
    if (authSchemes.size > 1) {
      inconsistencies.push({
        type: 'authentication',
        message: 'Multiple authentication schemes found across APIs',
        details: Object.fromEntries(authSchemes)
      });
    }

    return inconsistencies;
  }

  /**
   * Compare schemas with the same name across different APIs
   */
  compareSchemas(schema1Name: string, schema2Name: string): SchemaComparison[] {
    const schemas: SchemaComparison[] = [];
    const schemaNames = schema2Name ? [schema1Name, schema2Name] : [schema1Name];
    
    for (const spec of this.specs) {
      if (spec.components?.schemas) {
        for (const schemaName of schemaNames) {
          if (spec.components.schemas[schemaName]) {
            schemas.push({
              filename: spec.filename,
              api: spec.info?.title,
              schemaName,
              schema: spec.components.schemas[schemaName]
            });
          }
        }
      }
    }

    return schemas;
  }
}

// Initialize the analyzer
const analyzer = new OpenAPIAnalyzer();

// Create the MCP server
const server = new Server(
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

/**
 * Define all available tools for the MCP server
 */
const tools: Tool[] = [
  {
    name: 'load_specs',
    description: 'Load all OpenAPI specifications from the configured folder',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_apis',
    description: 'List all loaded API specifications with basic info',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_api_spec',
    description: 'Get the full OpenAPI spec for a specific file',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The filename of the OpenAPI spec',
        },
      },
      required: ['filename'],
    },
  },
  {
    name: 'search_endpoints',
    description: 'Search for endpoints across all APIs by keyword',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term to find in paths, methods, summaries, or descriptions',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_api_stats',
    description: 'Get comprehensive statistics about all loaded APIs',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'find_inconsistencies',
    description: 'Find naming conventions and other inconsistencies across APIs',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'compare_schemas',
    description: 'Compare schemas with the same name across different APIs',
    inputSchema: {
      type: 'object',
      properties: {
        schema1: {
          type: 'string',
          description: 'First schema name to compare',
        },
        schema2: {
          type: 'string',
          description: 'Second schema name to compare (optional)',
        },
      },
      required: ['schema1'],
    },
  },
];

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: No arguments provided',
        },
      ],
    };
  }

  try {
    switch (name) {
      case 'load_specs':
        await analyzer.loadSpecs();
        return {
          content: [
            {
              type: 'text',
              text: `Successfully loaded ${analyzer['specs'].length} OpenAPI specifications`,
            },
          ],
        };

      case 'list_apis':
        const apiList = analyzer.listAllSpecs();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(apiList, null, 2),
            },
          ],
        };

      case 'get_api_spec':
        const filename = args.filename as string;
        if (!filename) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: filename parameter is required',
              },
            ],
          };
        }
        const spec = analyzer.getSpecByFilename(filename);
        if (!spec) {
          return {
            content: [
              {
                type: 'text',
                text: `API spec not found: ${filename}`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(spec, null, 2),
            },
          ],
        };

      case 'search_endpoints':
        const query = args.query as string;
        if (!query) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: query parameter is required',
              },
            ],
          };
        }
        const searchResults = analyzer.searchEndpoints(query);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(searchResults, null, 2),
            },
          ],
        };

      case 'get_api_stats':
        const stats = analyzer.getApiStats();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };

      case 'find_inconsistencies':
        const inconsistencies = analyzer.findInconsistencies();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(inconsistencies, null, 2),
            },
          ],
        };

      case 'compare_schemas':
        const schema1 = args.schema1 as string;
        const schema2 = (args.schema2 as string) || schema1;
        if (!schema1) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: schema1 parameter is required',
              },
            ],
          };
        }
        const comparison = analyzer.compareSchemas(schema1, schema2);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(comparison, null, 2),
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error}`,
        },
      ],
    };
  }
});

// Start the server
async function main() {
  try {
    // Validate configuration before starting the server
    await validateSpecsFolder();
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('🚀 OpenAPI Analyzer MCP Server running...');
    console.error('📖 Ready to analyze OpenAPI specifications!');
  } catch (error: any) {
    console.error(`❌ Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

// Only run the server if this file is being executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}` || 
    process.argv[1]?.includes('openapi-analyzer-mcp')) {
  main().catch((error: any) => {
    console.error(`❌ Unexpected error: ${error.message}`);
    process.exit(1);
  });
}
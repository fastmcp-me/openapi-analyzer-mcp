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
import SwaggerParser from '@apidevtools/swagger-parser';

/**
 * OpenAPI Analyzer MCP Server - A Model Context Protocol server for analyzing OpenAPI specifications
 * 
 * This server provides tools to load, analyze, and compare OpenAPI specification files,
 * enabling natural language queries about API structures, endpoints, and inconsistencies.
 */

// Configuration - Priority order: Discovery URL -> Individual URLs -> Local folder
const DISCOVERY_URL = process.env.OPENAPI_DISCOVERY_URL;
const SPEC_URLS = process.env.OPENAPI_SPEC_URLS?.split(',').map(url => url.trim()).filter(Boolean) || [];
const SPECS_FOLDER = process.env.OPENAPI_SPECS_FOLDER;

/**
 * Validate that at least one configuration source is available
 */
export async function validateConfiguration(): Promise<void> {
  if (!DISCOVERY_URL && SPEC_URLS.length === 0 && !SPECS_FOLDER) {
    console.error('❌ Error: No OpenAPI source configured');
    console.error('');
    console.error('Please set at least one of the following environment variables:');
    console.error('');
    console.error('1. OPENAPI_DISCOVERY_URL - URL to API registry (apis.json or custom format)');
    console.error('   Example: OPENAPI_DISCOVERY_URL=https://docs.company.com/apis.json');
    console.error('');
    console.error('2. OPENAPI_SPEC_URLS - Comma-separated list of OpenAPI spec URLs');
    console.error('   Example: OPENAPI_SPEC_URLS=https://api.com/v1/spec.yaml,https://api.com/v2/spec.yaml');
    console.error('');
    console.error('3. OPENAPI_SPECS_FOLDER - Local folder with OpenAPI files');
    console.error('   Example: OPENAPI_SPECS_FOLDER=/absolute/path/to/your/specs');
    console.error('');
    console.error('Priority order: Discovery URL → Individual URLs → Local folder');
    process.exit(1);
  }
}

/**
 * Validate the local specs folder if it's configured
 */
async function validateSpecsFolder(): Promise<string> {
  if (!SPECS_FOLDER) {
    throw new Error('SPECS_FOLDER not configured');
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
  source?: {
    type: 'local' | 'remote';
    url?: string;
    apiInfo?: any;
  };
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

export interface LoadSource {
  type: 'discovery' | 'urls' | 'folder';
  url?: string;
  urls?: string[];
  folder?: string;
  count: number;
  metadata?: any;
}

export interface ApiDiscovery {
  name?: string;
  description?: string;
  url?: string;
  apis: Array<{
    name: string;
    baseURL?: string;
    version?: string;
    description?: string;
    properties?: Array<{
      type: string;
      url: string;
    }>;
    spec_url?: string; // Custom format support
    docs_url?: string; // Custom format support
    status?: string;   // Custom format support
    tags?: string[];   // Custom format support
  }>;
}

/**
 * Main analyzer class for OpenAPI specifications
 */
export class OpenAPIAnalyzer {
  private specs: OpenAPISpec[] = [];
  private loadedSources: LoadSource[] = [];
  private discoveryUrl?: string;
  private specUrls: string[] = [];
  private specsFolder?: string;

  constructor(options?: {
    discoveryUrl?: string;
    specUrls?: string[];
    specsFolder?: string;
  }) {
    // Use constructor options for testing, or fall back to environment variables
    this.discoveryUrl = options?.discoveryUrl || DISCOVERY_URL;
    this.specUrls = options?.specUrls || SPEC_URLS;
    this.specsFolder = options?.specsFolder || SPECS_FOLDER;
  }

  /**
   * Load specs from all configured sources: Discovery URL + Individual URLs + Local folder
   */
  async loadSpecs(): Promise<void> {
    this.specs = [];
    this.loadedSources = [];
    let totalLoaded = 0;

    // Source 1: Discovery URL (apis.json or custom registry)
    if (this.discoveryUrl) {
      const beforeCount = this.specs.length;
      await this.loadFromDiscoveryUrl();
      const discoveryCount = this.specs.length - beforeCount;
      if (discoveryCount > 0) {
        console.error(`✅ Loaded ${discoveryCount} specs from discovery URL`);
        totalLoaded += discoveryCount;
      }
    }

    // Source 2: Individual URLs
    if (this.specUrls.length > 0) {
      const beforeCount = this.specs.length;
      await this.loadFromUrls();
      const urlsCount = this.specs.length - beforeCount;
      if (urlsCount > 0) {
        console.error(`✅ Loaded ${urlsCount} specs from individual URLs`);
        totalLoaded += urlsCount;
      }
    }

    // Source 3: Local folder
    if (this.specsFolder) {
      const beforeCount = this.specs.length;
      await this.loadFromLocalFolder();
      const localCount = this.specs.length - beforeCount;
      if (localCount > 0) {
        console.error(`✅ Loaded ${localCount} specs from local folder`);
        totalLoaded += localCount;
      }
    }

    if (totalLoaded > 0) {
      console.error(`🎉 Total loaded: ${totalLoaded} OpenAPI specifications from ${this.loadedSources.length} sources`);
    } else {
      console.error('⚠️  Warning: No OpenAPI specifications were loaded from any source');
    }
  }

  /**
   * Load specs from discovery URL (apis.json format or custom)
   */
  private async loadFromDiscoveryUrl(): Promise<void> {
    try {
      console.error(`📡 Fetching API registry from ${this.discoveryUrl}`);
      
      const response = await fetch(this.discoveryUrl!);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const registry: ApiDiscovery = await response.json();
      
      if (!registry.apis || !Array.isArray(registry.apis)) {
        throw new Error('Invalid registry format: missing apis array');
      }

      console.error(`📋 Found ${registry.apis.length} APIs in registry`);
      
      // Load each spec from the registry
      for (const apiInfo of registry.apis) {
        await this.loadSingleRemoteSpec(apiInfo);
      }

      this.loadedSources.push({
        type: 'discovery',
        url: this.discoveryUrl!,
        count: this.specs.length,
        metadata: {
          name: registry.name,
          description: registry.description,
          total_apis: registry.apis.length
        }
      });

    } catch (error: any) {
      console.error(`⚠️  Warning: Failed to load from discovery URL: ${error.message}`);
      console.error(`    Falling back to individual URLs or local folder`);
    }
  }

  /**
   * Load specs from individual URLs
   */
  private async loadFromUrls(): Promise<void> {
    console.error(`📡 Loading from ${this.specUrls.length} individual URLs`);
    
    for (const url of this.specUrls) {
      await this.loadSingleRemoteSpec({ name: url.split('/').pop() || 'remote-spec', spec_url: url });
    }

    this.loadedSources.push({
      type: 'urls',
      urls: this.specUrls,
      count: this.specs.length
    });
  }

  /**
   * Load a single remote OpenAPI spec
   */
  private async loadSingleRemoteSpec(apiInfo: ApiDiscovery['apis'][0]): Promise<void> {
    try {
      // Determine spec URL - support both apis.json format and custom format
      let specUrl: string | undefined;
      
      if (apiInfo.spec_url) {
        // Custom format
        specUrl = apiInfo.spec_url;
      } else if (apiInfo.properties) {
        // apis.json format - look for Swagger/OpenAPI property
        const openApiProperty = apiInfo.properties.find(p => 
          p.type.toLowerCase() === 'swagger' || 
          p.type.toLowerCase() === 'openapi'
        );
        specUrl = openApiProperty?.url;
      }

      if (!specUrl) {
        console.error(`⚠️  Skipping ${apiInfo.name}: No OpenAPI spec URL found`);
        return;
      }

      const response = await fetch(specUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Use SwaggerParser.parse with URL directly to let it handle the fetching and parsing
      const spec = await SwaggerParser.parse(specUrl) as Record<string, any>;
      
      this.specs.push({
        filename: apiInfo.name,
        spec,
        info: spec.info,
        paths: spec.paths,
        components: spec.components,
        source: {
          type: 'remote',
          url: specUrl,
          apiInfo
        }
      });

      const title = spec.info?.title || apiInfo.name;
      const version = spec.info?.version || apiInfo.version || 'unknown';
      console.error(`  ✓ Loaded ${apiInfo.name} (${title} v${version})`);

    } catch (error: any) {
      console.error(`⚠️  Skipping ${apiInfo.name}: ${error.message}`);
    }
  }

  /**
   * Load specs from local folder (existing implementation)
   */
  private async loadFromLocalFolder(): Promise<void> {
    try {
      const validatedFolder = await this.validateLocalFolder();
      console.error(`📁 Loading from local folder: ${validatedFolder}`);
      
      const files = await fs.readdir(validatedFolder);
      const specFiles = files.filter(file => 
        file.endsWith('.json') || 
        file.endsWith('.yaml') || 
        file.endsWith('.yml')
      );
      
      if (specFiles.length === 0) {
        console.error(`⚠️  Warning: No OpenAPI specification files found in ${validatedFolder}`);
        return;
      }

      console.error(`📁 Found ${specFiles.length} OpenAPI specification files`);
      
      for (const file of specFiles) {
        await this.loadSingleLocalSpec(file, validatedFolder);
      }

      this.loadedSources.push({
        type: 'folder',
        folder: validatedFolder,
        count: this.specs.length
      });
      
    } catch (error: any) {
      console.error(`⚠️  Warning: Failed to load from local folder: ${error.message}`);
    }
  }

  /**
   * Validate local specs folder
   */
  private async validateLocalFolder(): Promise<string> {
    if (!this.specsFolder) {
      throw new Error('SPECS_FOLDER not configured');
    }

    try {
      const stats = await fs.stat(this.specsFolder);
      
      if (!stats.isDirectory()) {
        throw new Error(`OPENAPI_SPECS_FOLDER is not a directory: ${this.specsFolder}`);
      }

      await fs.access(this.specsFolder, fs.constants.R_OK);
      
      return this.specsFolder;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`OPENAPI_SPECS_FOLDER does not exist: ${this.specsFolder}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`No read permission for OPENAPI_SPECS_FOLDER: ${this.specsFolder}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Load a single OpenAPI specification file from local folder
   */
  private async loadSingleLocalSpec(filename: string, specsFolder: string): Promise<void> {
    try {
      const filePath = path.join(specsFolder, filename);
      
      let spec: Record<string, any>;
      try {
        // Use Swagger parser to handle JSON/YAML parsing and $ref resolution
        spec = await SwaggerParser.parse(filePath) as Record<string, any>;
      } catch (parseError) {
        const fileExt = path.extname(filename);
        console.error(`⚠️  Skipping ${filename}: Invalid ${fileExt.substring(1).toUpperCase()} format or malformed OpenAPI spec`);
        return;
      }
      
      // Swagger parser already validates that it's a valid OpenAPI spec
      // Additional validation is now handled by the parser
      
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
        components: spec.components,
        source: {
          type: 'local'
        }
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
   * Get information about loaded sources
   */
  getLoadedSources(): LoadSource[] {
    return this.loadedSources;
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
  {
    name: 'get_load_sources',
    description: 'Get information about where OpenAPI specs were loaded from (discovery URL, individual URLs, or local folder)',
    inputSchema: {
      type: 'object',
      properties: {},
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

      case 'get_load_sources':
        const sources = analyzer.getLoadedSources();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(sources, null, 2),
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
    await validateConfiguration();
    
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
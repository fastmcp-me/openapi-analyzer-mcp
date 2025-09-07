[![Add to Cursor](https://fastmcp.me/badges/cursor_dark.svg)](https://fastmcp.me/MCP/Details/858/openapi-analyzer)
[![Add to VS Code](https://fastmcp.me/badges/vscode_dark.svg)](https://fastmcp.me/MCP/Details/858/openapi-analyzer)
[![Add to Claude](https://fastmcp.me/badges/claude_dark.svg)](https://fastmcp.me/MCP/Details/858/openapi-analyzer)
[![Add to ChatGPT](https://fastmcp.me/badges/chatgpt_dark.svg)](https://fastmcp.me/MCP/Details/858/openapi-analyzer)
[![Add to Codex](https://fastmcp.me/badges/codex_dark.svg)](https://fastmcp.me/MCP/Details/858/openapi-analyzer)
[![Add to Gemini](https://fastmcp.me/badges/gemini_dark.svg)](https://fastmcp.me/MCP/Details/858/openapi-analyzer)

# OpenAPI Analyzer MCP Server

[![npm version](https://badge.fury.io/js/openapi-analyzer-mcp.svg)](https://badge.fury.io/js/openapi-analyzer-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful **Model Context Protocol (MCP) server** for analyzing OpenAPI specifications with Claude Desktop and other LLM clients. This server enables natural language queries about your API structures, endpoints, schemas, and helps identify inconsistencies across multiple OpenAPI specs.

## 📋 Table of Contents

- [🚀 Features](#-features)
- [🛠 Installation](#-installation)
- [⚙️ Configuration](#️-configuration)
- [🎯 Usage](#-usage)
- [🔧 Available Tools](#-available-tools)
- [🔍 Example Output](#-example-output)
- [🏗️ Creating Your Own API Registry](#️-creating-your-own-api-registry)
- [🚨 Troubleshooting](#-troubleshooting)
- [🤝 Contributing](#-contributing)
- [🆕 Changelog](#-changelog)
- [📝 License](#-license)

## 🚀 Features

### 🎯 **Smart Discovery System**
- **📡 API Registry Support**: Automatically discover APIs from `apis.json` registries (support for 30+ APIs)
- **🔗 URL-Based Loading**: Load specs from individual URLs with automatic fallback
- **📁 Local File Support**: Traditional folder-based spec loading with multi-format support
- **🔄 Priority System**: Discovery URL → Individual URLs → Local folder (intelligent fallback)

### 🔍 **Advanced Analysis**
- **📊 Bulk Analysis**: Load and analyze 90+ OpenAPI specification files simultaneously
- **🔍 Smart Search**: Find endpoints across all APIs using natural language queries  
- **📈 Comprehensive Stats**: Generate detailed statistics about your API ecosystem
- **🔧 Inconsistency Detection**: Identify authentication schemes and naming convention mismatches
- **📋 Schema Comparison**: Compare schemas with the same name across different APIs
- **⚡ Fast Queries**: In-memory indexing for lightning-fast responses

### 🌐 **Universal Compatibility**
- **Multi-Format Support**: JSON, YAML, and YML specifications
- **Version Support**: OpenAPI 2.0, 3.0, and 3.1 specifications
- **Remote & Local**: Works with URLs, API registries, and local files
- **Source Tracking**: Know exactly where each API spec was loaded from

## 🛠 Installation

### Option 1: Install from npm

```bash
npm install openapi-analyzer-mcp
```

### Option 2: Build from source

```bash
git clone https://github.com/sureshkumars/openapi-analyzer-mcp.git
cd openapi-analyzer-mcp
npm install
npm run build
```

## ⚙️ Configuration

### 🎯 Smart Discovery Options

The OpenAPI Analyzer supports **three discovery methods** with intelligent priority fallback:

1. **🏆 Priority 1: API Registry** (`OPENAPI_DISCOVERY_URL`)
2. **🥈 Priority 2: Individual URLs** (`OPENAPI_SPEC_URLS`) 
3. **🥉 Priority 3: Local Folder** (`OPENAPI_SPECS_FOLDER`)

### Claude Desktop Setup

**Find your config file:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\\Claude\\claude_desktop_config.json`

### Configuration Examples

#### 🌟 **Option 1: API Registry Discovery (Recommended)**
Perfect for companies with centralized API registries:

```json
{
  "mcpServers": {
    "openapi-analyzer": {
      "command": "npx",
      "args": ["-y", "openapi-analyzer-mcp"],
      "env": {
        "OPENAPI_DISCOVERY_URL": "https://docs.company.com/apis.json"
      }
    }
  }
}
```

#### 🔗 **Option 2: Individual API URLs**
Load specific APIs from direct URLs:

```json
{
  "mcpServers": {
    "openapi-analyzer": {
      "command": "npx", 
      "args": ["-y", "openapi-analyzer-mcp"],
      "env": {
        "OPENAPI_SPEC_URLS": "https://api.example.com/v1/openapi.yaml,https://api.example.com/v2/openapi.yaml,https://petstore.swagger.io/v2/swagger.json"
      }
    }
  }
}
```

#### 📁 **Option 3: Local Folder**
Traditional approach for local specification files:

```json
{
  "mcpServers": {
    "openapi-analyzer": {
      "command": "npx",
      "args": ["-y", "openapi-analyzer-mcp"],
      "env": {
        "OPENAPI_SPECS_FOLDER": "/absolute/path/to/your/openapi-specs"
      }
    }
  }
}
```

#### 🔄 **Option 4: Multi-Source with Fallback**
Ultimate flexibility - tries all methods with intelligent fallback:

```json
{
  "mcpServers": {
    "openapi-analyzer": {
      "command": "npx",
      "args": ["-y", "openapi-analyzer-mcp"],
      "env": {
        "OPENAPI_DISCOVERY_URL": "https://docs.company.com/apis.json",
        "OPENAPI_SPEC_URLS": "https://legacy-api.com/spec.yaml,https://external-api.com/spec.json",
        "OPENAPI_SPECS_FOLDER": "/path/to/local/specs"
      }
    }
  }
}
```

#### 🏢 **Real-World Examples**

**Company with API Registry:**
```json
{
  "mcpServers": {
    "company-apis": {
      "command": "npx",
      "args": ["-y", "openapi-analyzer-mcp"],
      "env": {
        "OPENAPI_DISCOVERY_URL": "https://api.company.com/registry/apis.json"
      }
    }
  }
}
```

**Multiple API Sources:**
```json
{
  "mcpServers": {
    "multi-apis": {
      "command": "npx",
      "args": ["-y", "openapi-analyzer-mcp"],
      "env": {
        "OPENAPI_SPEC_URLS": "https://petstore.swagger.io/v2/swagger.json,https://api.example.com/v1/openapi.yaml"
      }
    }
  }
}
```

### 🔧 Environment Variables

| Variable | Description | Example | Priority |
|----------|-------------|---------|----------|
| `OPENAPI_DISCOVERY_URL` | URL to API registry (apis.json format) | `https://docs.company.com/apis.json` | 1 (Highest) |
| `OPENAPI_SPEC_URLS` | Comma-separated list of OpenAPI spec URLs | `https://api1.com/spec.yaml,https://api2.com/spec.json` | 2 (Medium) |
| `OPENAPI_SPECS_FOLDER` | Absolute path to local OpenAPI files folder | `/absolute/path/to/specs` | 3 (Fallback) |

**⚠️ Important Notes:**
- At least one environment variable must be set
- System tries sources in priority order and stops at first success
- Always use absolute paths for `OPENAPI_SPECS_FOLDER`
- Supports JSON, YAML, and YML formats for all sources

## 🎯 Usage

Once configured, you can interact with your OpenAPI specs using natural language in Claude Desktop:

### 🚀 Smart Discovery Queries

#### API Registry Discovery
```
"Load all APIs from the company registry and show me an overview"
"Discover APIs from the configured registry and analyze their authentication patterns"
"What APIs are available in our API registry?"
"Show me where my specs were loaded from"
```

#### Cross-API Analysis
```
"Load all my OpenAPI specs and give me a comprehensive summary"
"How many APIs do I have and what's the total number of endpoints?"
"Compare authentication schemes across all loaded APIs"
"Which APIs are using different versions of the same schema?"
```

#### Search and Discovery
```
"Show me all POST endpoints for user creation across all APIs"
"Find all endpoints related to authentication across all loaded APIs"
"Which APIs have pagination parameters?"
"Search for endpoints that handle file uploads"
"Find all APIs that use the 'User' schema"
```

#### Analysis and Comparison
```
"What authentication schemes are used across my APIs?"
"Which APIs have inconsistent naming conventions?"
"Compare the User schema across different APIs"
"Show me APIs that are still using version 1.0"
```

#### Statistics and Insights
```
"Generate comprehensive statistics about my API ecosystem"
"Which HTTP methods are most commonly used?"
"What are the most common path patterns?"
"Show me version distribution across my APIs"
```

## 🔧 Available Tools

The MCP server provides these tools for programmatic access:

| Tool | Description | Parameters |
|------|-------------|------------|
| `load_specs` | **Smart Load**: Automatically load specs using priority system (registry → URLs → folder) | None |
| `list_apis` | List all loaded APIs with basic info (title, version, endpoint count) | None |
| `get_api_spec` | Get the full OpenAPI spec for a specific file | `filename` |
| `search_endpoints` | Search endpoints by keyword across all APIs | `query` |
| `get_api_stats` | Generate comprehensive statistics about all loaded APIs | None |
| `find_inconsistencies` | Detect inconsistencies in authentication schemes | None |
| `compare_schemas` | Compare schemas with the same name across different APIs | `schema1`, `schema2` (optional) |
| `get_load_sources` | **New!** Show where specs were loaded from (registry, URLs, or folder) | None |

## 📁 Project Structure

```
openapi-analyzer-mcp/
├── src/
│   └── index.ts          # Main server implementation
├── tests/               # Comprehensive test suite
│   ├── analyzer.test.ts # Core functionality tests
│   ├── server.test.ts   # MCP server tests  
│   ├── validation.test.ts # Environment tests
│   ├── setup.ts         # Test configuration
│   └── fixtures/        # Test data files
├── dist/                # Compiled JavaScript
├── coverage/            # Test coverage reports
├── examples/            # Example configurations
│   ├── claude_desktop_config.json
│   └── sample-openapi.json
├── vitest.config.ts     # Test configuration
├── package.json
├── tsconfig.json
└── README.md
```

**Note**: You don't need an `openapi-specs` folder in this repository. Point `OPENAPI_SPECS_FOLDER` to wherever your actual OpenAPI files are located.

## 🔍 Example Output

### 🎯 Smart Discovery Results

#### Load Sources Information
```json
[
  {
    "type": "discovery",
    "url": "https://api.company.com/registry/apis.json",
    "count": 12,
    "metadata": {
      "name": "Company APIs",
      "description": "Collection of company API specifications",
      "total_apis": 12
    }
  }
]
```

#### Registry Discovery Success
```json
{
  "totalApis": 12,
  "totalEndpoints": 247,
  "loadedFrom": "API Registry",
  "discoveryUrl": "https://api.company.com/registry/apis.json",
  "apis": [
    {
      "filename": "User Management API",
      "title": "User Management API", 
      "version": "2.1.0",
      "endpointCount": 18,
      "source": "https://docs.company.com/user-api.yaml"
    },
    {
      "filename": "Product Catalog API",
      "title": "Product Catalog API",
      "version": "1.5.0", 
      "endpointCount": 32,
      "source": "https://docs.company.com/product-api.yaml"
    }
  ]
}
```

### 📊 API Statistics
```json
{
  "totalApis": 12,
  "totalEndpoints": 247,
  "methodCounts": {
    "GET": 98,
    "POST": 67,
    "PUT": 45,
    "DELETE": 37
  },
  "versions": {
    "1.0.0": 8,
    "2.0.0": 3,
    "3.1.0": 1
  },
  "commonPaths": {
    "/api/v1/users/{id}": 8,
    "/api/v1/orders": 6,
    "/health": 12
  }
}
```

### Search Results
```json
[
  {
    "filename": "user-api.json",
    "api_title": "User Management API",
    "path": "/api/v1/users",
    "method": "POST",
    "summary": "Create a new user",
    "operationId": "createUser"
  },
  {
    "filename": "admin-api.json", 
    "api_title": "Admin API",
    "path": "/admin/users",
    "method": "POST",
    "summary": "Create user account",
    "operationId": "adminCreateUser"
  }
]
```

## 🏗️ Creating Your Own API Registry

Want to set up your own `apis.json` registry? Here's how:

### Standard APIs.json Format

Create a file at `https://your-domain.com/apis.json`:

```json
{
  "name": "Your Company APIs",
  "description": "Collection of all our API specifications",
  "url": "https://your-domain.com",
  "apis": [
    {
      "name": "User API",
      "baseURL": "https://api.your-domain.com/users",
      "properties": [
        {
          "type": "Swagger",
          "url": "https://docs.your-domain.com/user-api.yaml"
        }
      ]
    },
    {
      "name": "Orders API", 
      "baseURL": "https://api.your-domain.com/orders",
      "properties": [
        {
          "type": "OpenAPI",
          "url": "https://docs.your-domain.com/orders-api.json"
        }
      ]
    }
  ]
}
```

### Custom Registry Format

Or use the simpler custom format:

```json
{
  "name": "Your Company APIs",
  "description": "Our API registry",
  "apis": [
    {
      "name": "User API",
      "version": "v2",
      "spec_url": "https://docs.your-domain.com/user-api.yaml",
      "docs_url": "https://docs.your-domain.com/user-api",
      "status": "stable",
      "tags": ["auth", "users"]
    }
  ]
}
```

## 🚨 Troubleshooting

### Tools not appearing in Claude Desktop

1. **Verify environment variables are set** - At least one source must be configured
2. **Check that URLs are accessible** - Test discovery URLs and spec URLs manually
3. **Restart Claude Desktop** completely after configuration changes
4. **Check network connectivity** for remote API registries
5. **Verify file formats** - Supports JSON, YAML, and YML

### Common Error Messages

#### Smart Discovery Errors
- **"❌ Error: No OpenAPI source configured"**: Set at least one of `OPENAPI_DISCOVERY_URL`, `OPENAPI_SPEC_URLS`, or `OPENAPI_SPECS_FOLDER`
- **"⚠️ Warning: Failed to load from discovery URL"**: Check if the registry URL is accessible and returns valid JSON
- **"Invalid registry format: missing apis array"**: Your APIs.json file must have an `apis` array
- **"No OpenAPI spec URL found"**: API entries must have either `spec_url` or `properties` with OpenAPI/Swagger type

#### Traditional Errors  
- **"❌ Error: OPENAPI_SPECS_FOLDER does not exist"**: The specified directory doesn't exist
- **"❌ Error: OPENAPI_SPECS_FOLDER is not a directory"**: The path points to a file, not a directory
- **"❌ Error: No read permission for OPENAPI_SPECS_FOLDER"**: Check folder permissions
- **"⚠️ Warning: No OpenAPI specification files found"**: Directory exists but contains no supported files
- **"⚠️ Skipping [file]: Invalid format"**: File is not valid JSON/YAML or malformed OpenAPI spec

### Debug Mode

Set `NODE_ENV=development` to see detailed logging:

```json
{
  "mcpServers": {
    "openapi-analyzer": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "OPENAPI_SPECS_FOLDER": "/path/to/specs",
        "NODE_ENV": "development"
      }
    }
  }
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup

```bash
git clone https://github.com/sureshkumars/openapi-analyzer-mcp.git
cd openapi-analyzer-mcp
npm install
npm run build
npm run dev  # Start in development mode
```

### Running Tests

This project includes a comprehensive test suite with 46+ tests covering all functionality:

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

#### Test Coverage

The test suite provides extensive coverage with **100% test success rate**:
- **✅ 46 tests passing** with **66.79% statement coverage** and **100% function coverage**
- **Unit tests** for the OpenAPIAnalyzer class (30 tests) - covers all loading methods and analysis features
- **Integration tests** for MCP server configuration (8 tests) - validates all tools and exports
- **Validation tests** for environment setup and error handling (8 tests) - tests all discovery methods

**New in v1.2.0:**
- ✅ **Smart discovery testing** - URL loading, API registry parsing, fallback mechanisms
- ✅ **Constructor-based testing** - Flexible test configuration without environment variables
- ✅ **Remote spec mocking** - Full coverage of HTTP-based spec loading
- ✅ **Backward compatibility** - All existing functionality preserved

#### Test Structure

```
tests/
├── analyzer.test.ts      # Core OpenAPIAnalyzer functionality tests
├── server.test.ts        # MCP server configuration tests
├── validation.test.ts    # Environment validation tests
├── setup.ts             # Test configuration
└── fixtures/            # Sample test data
    ├── sample-api.json
    ├── another-api.json
    └── invalid-api.json
```

#### What's Tested

- ✅ **OpenAPI spec loading** (valid/invalid files, JSON parsing)
- ✅ **Search functionality** (by path, method, summary, operationId)
- ✅ **Statistics generation** (method counts, versions, common paths)
- ✅ **Schema comparison** (cross-API schema analysis)
- ✅ **Inconsistency detection** (authentication schemes)
- ✅ **Error handling** (missing env vars, file permissions)
- ✅ **Edge cases** (empty directories, malformed JSON)

#### Test Technology

- **Vitest** - Fast test framework with TypeScript support
- **Comprehensive mocking** - File system operations and console output
- **Type safety** - Full TypeScript integration with proper interfaces

## 🆕 Changelog

### Version 1.2.0 - Smart Discovery System
**Released: September 2025**

#### 🎯 Major Features
- **🚀 Smart Discovery System**: Revolutionary API discovery with priority-based fallback
- **📡 API Registry Support**: Full support for `apis.json` format and custom registries  
- **🔗 URL-Based Loading**: Load specs directly from individual URLs
- **🔄 Intelligent Fallback**: Discovery URL → Individual URLs → Local folder priority system
- **🏷️ Source Tracking**: New `get_load_sources` tool shows where specs were loaded from

#### ✨ Real-World Integration
- **🏢 Production Ready**: Successfully tested with 30+ production APIs from various registries
- **📊 Bulk Processing**: Load 90+ APIs from registries in seconds
- **🌐 Universal Format Support**: JSON, YAML, YML from any source (remote or local)

#### 🧪 Enhanced Testing  
- **✅ 46 tests passing** with 100% success rate
- **📈 Improved coverage**: 66.79% statement coverage, 100% function coverage
- **🔧 Constructor-based testing**: Flexible test configuration
- **🔗 Remote spec mocking**: Full HTTP-based loading test coverage

#### 🔧 Developer Experience
- **⚡ Zero Breaking Changes**: Full backward compatibility maintained
- **📚 Comprehensive Documentation**: Updated with real-world examples
- **🏗️ Registry Setup Guide**: Instructions for creating your own APIs.json registry
- **🚨 Enhanced Error Handling**: Better error messages and graceful fallbacks

### Version 1.1.0 - YAML Support & Enhanced Analysis
- Added YAML/YML format support using @apidevtools/swagger-parser
- Enhanced schema comparison and inconsistency detection
- Improved error handling and validation

### Version 1.0.0 - Initial Release
- Core OpenAPI analysis functionality
- Local folder-based spec loading
- MCP server implementation with 6 core tools

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- Supports OpenAPI specifications as defined by the [OpenAPI Initiative](https://www.openapis.org/)
- Compatible with [Claude Desktop](https://claude.ai/desktop) and other MCP clients

---

**Made with ❤️ for API developers and documentation teams**

If you find this tool helpful, please consider giving it a ⭐ on GitHub!
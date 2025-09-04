# OpenAPI Analyzer MCP Server

[![npm version](https://badge.fury.io/js/openapi-analyzer-mcp.svg)](https://badge.fury.io/js/openapi-analyzer-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful **Model Context Protocol (MCP) server** for analyzing OpenAPI specifications with Claude Desktop and other LLM clients. This server enables natural language queries about your API structures, endpoints, schemas, and helps identify inconsistencies across multiple OpenAPI specs.

## 🚀 Features

- **📁 Bulk Analysis**: Load and analyze 90+ OpenAPI specification files simultaneously
- **🔍 Smart Search**: Find endpoints across all APIs using natural language queries  
- **📊 Comprehensive Stats**: Generate detailed statistics about your API ecosystem
- **🔧 Inconsistency Detection**: Identify authentication schemes and naming convention mismatches
- **📋 Schema Comparison**: Compare schemas with the same name across different APIs
- **⚡ Fast Queries**: In-memory indexing for lightning-fast responses
- **🌐 Universal Compatibility**: Works with OpenAPI 2.0, 3.0, and 3.1 specifications in JSON, YAML, and YML formats

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

### Claude Desktop Setup

1. **Find your Claude Desktop config file:**
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\\Claude\\claude_desktop_config.json`

2. **Add the server configuration:**

   **Option A: Using installed package**
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

   **Option B: Using local build**
   ```json
   {
     "mcpServers": {
       "openapi-analyzer": {
         "command": "node",
         "args": ["/absolute/path/to/openapi-analyzer-mcp/dist/index.js"],
         "env": {
           "OPENAPI_SPECS_FOLDER": "/absolute/path/to/your/openapi-specs"
         }
       }
     }
   }
   ```

   **⚠️ Important**: Always use absolute paths, not relative paths like `./my-specs`

3. **Restart Claude Desktop**

### Environment Variables

- `OPENAPI_SPECS_FOLDER`: **Required**. Absolute path to the folder containing your OpenAPI specification files (JSON, YAML, or YML).

## 🎯 Usage

Once configured, you can interact with your OpenAPI specs using natural language in Claude Desktop:

### Example Queries

#### Load and Overview
```
"Load all my OpenAPI specs and give me a summary"
"How many APIs do I have and what's the total number of endpoints?"
```

#### Search and Discovery
```
"Show me all POST endpoints for user creation"
"Find all endpoints related to authentication"
"Which APIs have pagination parameters?"
"Search for endpoints that handle file uploads"
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
| `load_specs` | Load all OpenAPI specifications from the configured folder | None |
| `list_apis` | List all loaded APIs with basic info (title, version, endpoint count) | None |
| `get_api_spec` | Get the full OpenAPI spec for a specific file | `filename` |
| `search_endpoints` | Search endpoints by keyword across all APIs | `query` |
| `get_api_stats` | Generate comprehensive statistics about all loaded APIs | None |
| `find_inconsistencies` | Detect inconsistencies in authentication schemes | None |
| `compare_schemas` | Compare schemas with the same name across different APIs | `schema1`, `schema2` (optional) |

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

### API Statistics
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

## 🚨 Troubleshooting

### Tools not appearing in Claude Desktop

1. **Verify file paths are absolute** in your Claude Desktop config
2. **Check that the `dist/index.js` file exists** after running `npm run build`
3. **Restart Claude Desktop** completely after configuration changes
4. **Check folder permissions** for the OPENAPI_SPECS_FOLDER
5. **Verify OpenAPI files are valid JSON** - invalid files are skipped with warnings

### Common Error Messages

- **"❌ Error: OPENAPI_SPECS_FOLDER environment variable is required"**: You must set this environment variable to an absolute path
- **"❌ Error: OPENAPI_SPECS_FOLDER does not exist"**: The specified directory doesn't exist - create it or fix the path
- **"❌ Error: OPENAPI_SPECS_FOLDER is not a directory"**: The path points to a file, not a directory
- **"❌ Error: No read permission for OPENAPI_SPECS_FOLDER"**: Check folder permissions (chmod/chown on Unix, folder properties on Windows)  
- **"⚠️  Warning: No .json files found"**: The directory exists but contains no `.json` files - check file extensions
- **"⚠️  Skipping [file]: Invalid JSON format"**: The file is not valid JSON - check syntax
- **"⚠️  Skipping [file]: Not an OpenAPI/Swagger specification"**: The JSON file is missing required `openapi` or `swagger` fields
- **"❌ No valid OpenAPI specifications were loaded"**: All JSON files failed validation

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

The test suite provides extensive coverage:
- **✅ 46 tests passing** with **59.42% statement coverage**
- **Unit tests** for the OpenAPIAnalyzer class (30 tests)
- **Integration tests** for MCP server configuration (8 tests) 
- **Validation tests** for environment setup and error handling (8 tests)

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

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- Supports OpenAPI specifications as defined by the [OpenAPI Initiative](https://www.openapis.org/)
- Compatible with [Claude Desktop](https://claude.ai/desktop) and other MCP clients

---

**Made with ❤️ for API developers and documentation teams**

If you find this tool helpful, please consider giving it a ⭐ on GitHub!
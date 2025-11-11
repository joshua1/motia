import path from 'path'
import { type StandardSchemaV1 } from '@standard-schema/spec'
import { schemaToJsonSchema, isStandardSchema } from '../schema/schema-utils'

// Add ts-node registration before dynamic imports

require('ts-node').register({
	transpileOnly: true,
	compilerOptions: { module: 'commonjs' },
})

async function getConfig(filePath: string) {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const module = require(path.resolve(filePath))
		// Check if the specified function exists in the module
		if (!module.config) {
			throw new Error(`Config not found in module ${filePath}`)
		}

		// Convert Standard Schema V1 schemas to JSON Schema
		if (module.config.input && isStandardSchema(module.config.input)) {
			module.config.input = schemaToJsonSchema(module.config.input)
		}

		if (module.config.bodySchema && isStandardSchema(module.config.bodySchema)) {
			module.config.bodySchema = schemaToJsonSchema(module.config.bodySchema)
		}

		if (module.config.responseSchema) {
			for (const [status, schema] of Object.entries(module.config.responseSchema)) {
				if (isStandardSchema(schema)) {
					module.config.responseSchema[status] = schemaToJsonSchema(schema)
				}
			}
		}

		if (module.config.schema && isStandardSchema(module.config.schema)) {
			module.config.schema = schemaToJsonSchema(module.config.schema)
		}

		process.send?.(module.config)

		process.exit(0)
	} catch (error) {
		console.error('Error running TypeScript module:', error)
		process.exit(1)
	}
}

const [, , filePath] = process.argv

if (!filePath) {
	console.error('Usage: node get-config.js <file-path>')
	process.exit(1)
}

getConfig(filePath).catch((err) => {
	console.error('Error:', err)
	process.exit(1)
})

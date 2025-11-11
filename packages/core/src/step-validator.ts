import { type StandardSchemaV1, SchemaError } from '@standard-schema/utils'
import { Step } from './types'
import { isStandardSchema, StandardInput } from './schema/schema-utils'

// Helper function to validate if a value is a valid schema (Standard Schema compliant)
const isValidSchema = (value: unknown): value is StandardInput => {
	return isStandardSchema(value)
}

const objectSchema = {
	type: 'object',
	properties: {},
	additionalProperties: false,
} as const

const arraySchema = {
	type: 'array',
	items: objectSchema,
} as const

const jsonSchema = {
	any: [
		{
			type: 'object',
			properties: {},
			additionalProperties: false,
		},
		{
			type: 'array',
			items: objectSchema,
		},
	],
} as const

const emits = [
	{
		any: [
			{
				type: 'string',
			},
			{
				type: 'object',
				properties: {
					topic: { type: 'string' },
					label: { type: 'string' },
					conditional: { type: 'boolean' },
				},
				additionalProperties: false,
			},
		],
	},
} as const

const noopSchema = {
	type: 'object',
	properties: {
		type: { const: 'noop' },
		name: { type: 'string' },
		description: { type: 'string' },
		virtualEmits: emits,
		virtualSubscribes: {
			type: 'array',
			items: { type: 'string' },
		},
		flows: {
			type: 'array',
			items: { type: 'string' },
		},
	},
	required: ['type', 'name'],
	additionalProperties: false,
} as const

const eventSchema = {
	type: 'object',
	properties: {
		type: { const: 'event' },
		name: { type: 'string' },
		description: { type: 'string' },
		subscribes: {
			type: 'array',
			items: { type: 'string' },
		},
		emits: emits,
		virtualEmits: emits,
		virtualSubscribes: {
			type: 'array',
			items: { type: 'string' },
		},
		input: {
			any: [jsonSchema, { type: 'object' }, { type: 'null' }],
		},
		flows: {
			type: 'array',
			items: { type: 'string' },
		},
		includeFiles: {
			type: 'array',
			items: { type: 'string' },
		},
	},
	required: ['type', 'name'],
	additionalProperties: false,
} as const

const apiSchema = {
	type: 'object',
	properties: {
		type: { const: 'api' },
		name: { type: 'string' },
		description: { type: 'string' },
		path: { type: 'string' },
		method: { type: 'string' },
		emits: emits,
		virtualEmits: emits,
		virtualSubscribes: {
			type: 'array',
			items: { type: 'string' },
		},
		flows: {
			type: 'array',
			items: { type: 'string' },
		},
		includeFiles: {
			type: 'array',
			items: { type: 'string' },
		},
		middleware: {
			type: 'array',
			items: {},
		},
		queryParams: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					description: { type: 'string' },
				},
				required: ['name'],
			},
		},
		bodySchema: {
			any: [jsonSchema, { type: 'object' }, { type: 'null' }],
		},
		responseSchema: {
			type: 'object',
			patternProperties: {
				'^[0-9]+$': jsonSchema,
			},
		},
	},
	required: ['type', 'name', 'path', 'method'],
	additionalProperties: false,
} as const

const cronSchema = {
	type: 'object',
	properties: {
		type: { const: 'cron' },
		name: { type: 'string' },
		description: { type: 'string' },
		cron: { type: 'string' },
		virtualEmits: emits,
		virtualSubscribes: {
			type: 'array',
			items: { type: 'string' },
		},
		emits: emits,
		flows: {
			type: 'array',
			items: { type: 'string' },
		},
		includeFiles: {
			type: 'array',
			items: { type: 'string' },
		},
	},
	required: ['type', 'name', 'cron'],
	additionalProperties: false,
} as const

export type ValidationSuccess = {
	success: true
}

export type ValidationError = {
	success: false
	error: string
	errors?: Array<{ path: string; message: string }>
}

export type ValidationResult = ValidationSuccess | ValidationError

/**
 * Validate a step configuration against the Standard Schema specification
 */
export const validateStep = (step: Step): ValidationResult => {
	try {
		const stepConfig = step.config

		if (stepConfig.type === 'noop') {
			validateWithJsonSchema(noopSchema, stepConfig)
		} else if (stepConfig.type === 'event') {
			validateWithJsonSchema(eventSchema, stepConfig)
		} else if (stepConfig.type === 'api') {
			validateWithJsonSchema(apiSchema, stepConfig)
		} else if (stepConfig.type === 'cron') {
			validateWithJsonSchema(cronSchema, stepConfig)
		} else {
			return {
				success: false,
				error: `Invalid step type: ${stepConfig.type}`,
			}
		}

		// Validate schema fields if present
		if (stepConfig.type === 'event' && stepConfig.input) {
			if (!isValidSchema(stepConfig.input)) {
				return {
					success: false,
					error: 'Invalid input schema: must be a Standard Schema V1 compliant schema',
				}
			}
		}

		if (stepConfig.type === 'api') {
			if (stepConfig.bodySchema && !isValidSchema(stepConfig.bodySchema)) {
				return {
					success: false,
					error: 'Invalid bodySchema: must be a Standard Schema V1 compliant schema',
				}
			}

			if (stepConfig.responseSchema) {
				for (const [status, schema] of Object.entries(stepConfig.responseSchema)) {
					if (!isValidSchema(schema)) {
						return {
							success: false,
							error: `Invalid responseSchema for status ${status}: must be a Standard Schema V1 compliant schema`,
						}
					}
				}
			}
		}

		return { success: true }
	} catch (error) {
		if (error instanceof SchemaError) {
			const errorMessages = error.issues.map((issue) => issue.message).join(', ')
			return {
				success: false,
				error: errorMessages,
				errors: error.issues.map((issue) => ({
					path: getDotPath(issue) || 'root',
					message: issue.message,
				})),
			}
		}

		// Handle unexpected errors
		return {
			success: false,
			error: 'Unexpected validation error occurred',
		}
	}
}

/**
 * Validate data against a JSON Schema
 */
function validateWithJsonSchema<T>(schema: Record<string, unknown>, data: unknown): asserts data is T {
	// This is a basic JSON Schema validation
	// In a real implementation, you'd use a library like ajv
	// For now, just check required properties and basic types
	if (typeof data !== 'object' || data === null) {
		throw new Error(`Expected object, got ${typeof data}`)
	}

	const objData = data as Record<string, unknown>

	for (const [key, propSchema] of Object.entries(schema.properties || {})) {
		const isRequired = (schema.required || []).includes(key)
		const hasProperty = key in objData

		if (isRequired && !hasProperty) {
			throw new Error(`Missing required property: ${key}`)
		}

		if (hasProperty && propSchema && typeof propSchema === 'object') {
			const propType = (propSchema as any).type
			const propValue = objData[key]

			if (propType === 'string' && typeof propValue !== 'string') {
				throw new Error(`Property ${key} must be a string`)
			}
			if (propType === 'number' && typeof propValue !== 'number') {
				throw new Error(`Property ${key} must be a number`)
			}
			if (propType === 'boolean' && typeof propValue !== 'boolean') {
				throw new Error(`Property ${key} must be a boolean`)
			}
		}
	}
}

import { type StandardSchemaV1, SchemaError, getDotPath } from '@standard-schema/utils'
import { JsonSchema } from '../types/schema.types'

/**
 * Type for Standard Schema V1 compliant schemas
 */
export type StandardInput = StandardSchemaV1<any, any>

/**
 * Type guard to check if a value implements Standard Schema V1
 */
export function isStandardSchema<T = unknown>(value: unknown): value is StandardSchemaV1<T> {
	return (
		Boolean(value) &&
		typeof value === 'object' &&
		value !== null &&
		'~standard' in value &&
		typeof (value as any)['~standard'] === 'object' &&
		typeof (value as any)['~standard'].version === 'number' &&
		typeof (value as any)['~standard'].validate === 'function'
	)
}

/**
 * Convert a Standard Schema to JSON Schema for internal processing
 */
export function schemaToJsonSchema(schema: StandardInput): JsonSchema {
	if (!isStandardSchema(schema)) {
		// Fallback to generic object schema for non-Standard Schema
		return {
			type: 'object',
			properties: {},
			additionalProperties: true,
		} as any
	}

	// Try to get JSON Schema from Standard Schema if available
	const standard = schema['~standard']

	// Check if schema has a toJSONSchema method
	if (typeof (schema as any).toJSONSchema === 'function') {
		return (schema as any).toJSONSchema()
	}

	// Use type information if available
	if (standard.types) {
		return createJsonSchemaFromTypes(standard.types)
	}

	// Fallback: create a generic object schema
	return {
		type: 'object',
		properties: {},
		additionalProperties: true,
		description: 'Standard Schema - JSON Schema conversion not available',
	} as any
}

/**
 * Create a basic JSON Schema from Standard Schema type information
 */
function createJsonSchemaFromTypes(types: { input?: any; output?: any }): JsonSchema {
	// This is a simplified conversion - in practice, you might want
	// to use a more sophisticated type-to-JSON-Schema converter
	if (types.input) {
		return inferJsonSchemaFromValue(types.input)
	}

	if (types.output) {
		return inferJsonSchemaFromValue(types.output)
	}

	return {
		type: 'object',
		properties: {},
		additionalProperties: true,
	} as any
}

/**
 * Infer a basic JSON Schema from a sample value
 */
function inferJsonSchemaFromValue(value: unknown): JsonSchema {
	if (value === null) {
		return { type: 'object' } as any // Convert 'null' to object to avoid type issues
	}

	if (typeof value === 'string') {
		return { type: 'string' }
	}

	if (typeof value === 'number') {
		return { type: 'number' } as any
	}

	if (typeof value === 'boolean') {
		return { type: 'boolean' } as any
	}

	if (Array.isArray(value)) {
		if (value.length > 0) {
			return {
				type: 'array',
				items: inferJsonSchemaFromValue(value[0]),
			} as any
		}
		return { type: 'array', items: {} } as any
	}

	if (typeof value === 'object' && value !== null) {
		const properties: Record<string, JsonSchema> = {}
		const required: string[] = []

		for (const [key, val] of Object.entries(value as object)) {
			properties[key] = inferJsonSchemaFromValue(val)
			if (val !== undefined && val !== null) {
				required.push(key)
			}
		}

		return {
			type: 'object',
			properties,
			required: required.length > 0 ? required : undefined,
			additionalProperties: false,
		} as any
	}

	return { type: 'object', additionalProperties: true } as any
}

/**
 * Validate data using a Standard Schema
 */
export function validateWithSchema<T>(schema: StandardInput, data: unknown): StandardSchemaV1.Result<T> {
	if (!isStandardSchema(schema)) {
		// Fallback: just return the data as valid
		return { value: data as T }
	}

	const result = schema['~standard'].validate(data)

	// Handle both sync and async validation results
	if (result instanceof Promise) {
		throw new Error('Async validation not supported in this context. Use validateWithSchemaAsync instead.')
	}

	return result as StandardSchemaV1.Result<T>
}

/**
 * Validate data using a Standard Schema (async version)
 */
export async function validateWithSchemaAsync<T>(schema: StandardInput, data: unknown): Promise<StandardSchemaV1.Result<T>> {
	if (!isStandardSchema(schema)) {
		// Fallback: just return the data as valid
		return { value: data as T }
	}

	const result = schema['~standard'].validate(data)

	if (result instanceof Promise) {
		return await result
	}

	return result as StandardSchemaV1.Result<T>
}

/**
 * Format validation errors for user display
 */
export function formatValidationErrors(issues: ReadonlyArray<StandardSchemaV1.Issue>): string[] {
	return issues.map(issue => {
		const path = getDotPath(issue)
		if (path) {
			return `${path}: ${issue.message}`
		}
		return issue.message
	})
}

/**
 * Validate data or throw with SchemaError
 */
export function validateOrThrow<T>(schema: StandardInput, data: unknown): StandardSchemaV1.InferOutput<T> {
	const result = validateWithSchema(schema, data)

	if (result.issues) {
		throw new SchemaError(result.issues)
	}

	return result.value
}

/**
 * Validate data or throw with SchemaError (async version)
 */
export async function validateOrThrowAsync<T>(schema: StandardInput, data: unknown): Promise<StandardSchemaV1.InferOutput<T>> {
	const result = await validateWithSchemaAsync(schema, data)

	if (result.issues) {
		throw new SchemaError(result.issues)
	}

	return result.value
}

/**
 * Type utilities for Standard Schema
 */
export type InferInput<T extends StandardInput> = T extends StandardSchemaV1<infer I, any>
	? I
	: never

export type InferOutput<T extends StandardInput> = T extends StandardSchemaV1<any, infer O>
	? O
	: never

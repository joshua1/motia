import { type StandardSchemaV1, SchemaError, getDotPath } from '@standard-schema/utils'
import {
	isStandardSchema,
	schemaToJsonSchema,
	validateWithSchema,
	validateWithSchemaAsync,
	type StandardInput,
	type InferInput,
	type InferOutput,
	formatValidationErrors,
	validateOrThrow,
	validateOrThrowAsync,
} from '../../schema/schema-utils'

describe('schema-utils', () => {
	describe('isStandardSchema', () => {
		it('should identify Standard Schema V1 compliant schemas', () => {
			const standardSchema: StandardSchemaV1<string> = {
				'~standard': {
					version: 1,
					vendor: 'test',
					validate: (value: unknown) => {
						if (typeof value === 'string') {
							return { value }
						}
						return { issues: [{ message: 'Must be a string', path: [] }] }
					},
				},
			}
			expect(isStandardSchema(standardSchema)).toBe(true)
		})

		it('should reject non-Standard Schema objects', () => {
			expect(isStandardSchema({})).toBe(false)
			expect(isStandardSchema(null)).toBe(false)
			expect(isStandardSchema('not a schema')).toBe(false)
			expect(isStandardSchema({ '~standard': {} })).toBe(false)
		})
	})

	describe('schemaToJsonSchema', () => {
		it('should convert Standard Schema to JSON Schema', () => {
			const standardSchema: StandardSchemaV1<{ name: string }> = {
				'~standard': {
					version: 1,
					vendor: 'test',
					validate: (value: unknown) => {
						if (typeof value === 'object' && value !== null && 'name' in value) {
							return { value: value as { name: string } }
						}
						return { issues: [{ message: 'Invalid object', path: [] }] }
					},
					types: {
						input: { name: 'test' },
						output: { name: 'test' },
					},
				},
			}

			const jsonSchema = schemaToJsonSchema(standardSchema)

			expect(jsonSchema).toHaveProperty('type', 'object')
			expect(jsonSchema).toHaveProperty('properties')
		})

		it('should return existing JSON Schema as-is', () => {
			const existingJsonSchema = {
				type: 'object' as const,
				properties: {
					name: { type: 'string' as const },
				},
			}

			const result = schemaToJsonSchema(existingJsonSchema as any)
			expect(result).toBe(existingJsonSchema)
		})

		it('should handle custom Standard Schema implementations', () => {
			const customSchema: StandardSchemaV1<{ name: string }> = {
				'~standard': {
					version: 1,
					vendor: 'custom-validator',
					validate: (value: unknown) => {
						if (typeof value === 'object' && value !== null && 'name' in value) {
							return { value: value as { name: string } }
						}
						return { issues: [{ message: 'Invalid object', path: [] }] }
					},
				},
			}

			const jsonSchema = schemaToJsonSchema(customSchema)
			expect(jsonSchema).toHaveProperty('type', 'object')
		})
	})

	describe('validateWithSchema', () => {
		it('should validate with Standard Schema', () => {
			const standardSchema: StandardSchemaV1<{ name: string }> = {
				'~standard': {
					version: 1,
					vendor: 'test',
					validate: (value: unknown) => {
						if (typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string') {
							return { value: value as { name: string } }
						}
						return { issues: [{ message: 'Invalid object', path: [] }] }
					},
				},
			}

			const validData = { name: 'John' }
			const invalidData = { name: 123 }

			const validResult = validateWithSchema(standardSchema, validData)
			expect(validResult.issues).toBeUndefined()
			if (validResult.issues) {
				throw new Error('Expected valid result')
			}
			expect(validResult.value).toEqual(validData)

			const invalidResult = validateWithSchema(standardSchema, invalidData)
			expect(invalidResult.issues).toBeDefined()
			expect(invalidResult.issues!.length).toBeGreaterThan(0)
		})

		it('should handle non-schema inputs gracefully', () => {
			const result = validateWithSchema({} as StandardInput, 'any data')
			expect(result.issues).toBeUndefined()
			if (result.issues) {
				throw new Error('Expected valid result')
			}
			expect(result.value).toBe('any data')
		})
	})

	describe('validateWithSchemaAsync', () => {
		it('should validate async with Standard Schema', async () => {
			const asyncSchema: StandardSchemaV1<string> = {
				'~standard': {
					version: 1,
					vendor: 'async-validator',
					async validate(value: unknown) {
						if (typeof value === 'string' && value.length > 0) {
							return { value: value.toUpperCase() }
						}
						return { issues: [{ message: 'Must be non-empty string', path: [] }] }
					},
				},
			}

			const validResult = await validateWithSchemaAsync(asyncSchema, 'hello')
			expect(validResult.issues).toBeUndefined()
			if (validResult.issues) {
				throw new Error('Expected valid result')
			}
			expect(validResult.value).toBe('HELLO')

			const invalidResult = await validateWithSchemaAsync(asyncSchema, '')
			expect(invalidResult.issues).toBeDefined()
			expect(invalidResult.issues!.length).toBeGreaterThan(0)
		})
	})

	describe('validateOrThrow', () => {
		it('should throw SchemaError on validation failure', () => {
			const schema: StandardSchemaV1<string> = {
				'~standard': {
					version: 1,
					vendor: 'test',
					validate: (value: unknown) => {
						if (typeof value === 'string') {
							return { value }
						}
						return { issues: [{ message: 'Must be a string', path: [] }] }
					},
				},
			}

			expect(() => validateOrThrow(schema, 123)).toThrow(SchemaError)
		})

		it('should return validated value on success', () => {
			const schema: StandardSchemaV1<string> = {
				'~standard': {
					version: 1,
					vendor: 'test',
					validate: (value: unknown) => {
						if (typeof value === 'string') {
							return { value: value.toUpperCase() }
						}
						return { issues: [{ message: 'Must be a string', path: [] }] }
					},
				},
			}

			const result = validateOrThrow(schema, 'hello')
			expect(result).toBe('HELLO')
		})
	})

	describe('validateOrThrowAsync', () => {
		it('should throw SchemaError on async validation failure', async () => {
			const asyncSchema: StandardSchemaV1<string> = {
				'~standard': {
					version: 1,
					vendor: 'async-test',
					async validate(value: unknown) {
						if (typeof value === 'string') {
							return { value }
						}
						return { issues: [{ message: 'Must be a string', path: [] }] }
					},
				},
			}

			await expect(validateOrThrowAsync(asyncSchema, 123)).rejects.toThrow(SchemaError)
		})

		it('should return validated value on async success', async () => {
			const asyncSchema: StandardSchemaV1<string> = {
				'~standard': {
					version: 1,
					vendor: 'async-test',
					async validate(value: unknown) {
						if (typeof value === 'string') {
							return { value: value.toUpperCase() }
						}
						return { issues: [{ message: 'Must be a string', path: [] }] }
					},
				},
			}

			const result = await validateOrThrowAsync(asyncSchema, 'hello')
			expect(result).toBe('HELLO')
		})
	})

	describe('formatValidationErrors', () => {
		it('should format validation errors with paths', () => {
			const issues: StandardSchemaV1.Issue[] = [
				{ message: 'Name is required', path: ['name'] },
				{ message: 'Email is invalid', path: ['user', 'email'] },
				{ message: 'Invalid age', path: ['user', 'profile', 'age'] },
				{ message: 'Root error', path: [] },
			]

			const formatted = formatValidationErrors(issues)
			expect(formatted).toEqual([
				'name: Name is required',
				'user.email: Email is invalid',
				'user.profile.age: Invalid age',
				'Invalid age',
			])
		})

		it('should format validation errors without paths', () => {
			const issues: StandardSchemaV1.Issue[] = [
				{ message: 'General error', path: [] },
				{ message: 'Another error', path: [] },
			]

			const formatted = formatValidationErrors(issues)
			expect(formatted).toEqual(['General error', 'Another error'])
		})
	})

	describe('type inference', () => {
		it('should infer input/output types correctly', () => {
			const schema: StandardSchemaV1<{ name: string }, { nameUpper: string }> = {
				'~standard': {
					version: 1,
					vendor: 'type-test',
					validate: (value: unknown) => {
						if (typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string') {
							return { value: { nameUpper: value.name.toUpperCase() } }
						}
						return { issues: [{ message: 'Invalid object', path: [] }] }
					},
					types: {
						input: { name: '' },
						output: { nameUpper: '' },
					},
				},
			}

			type InputType = InferInput<typeof schema>
			type OutputType = InferOutput<typeof schema>

			const testData: InputType = { name: 'John' }
			const outputData: OutputType = { nameUpper: 'JOHN' }

			expect(testData).toHaveProperty('name')
			expect(outputData).toHaveProperty('nameUpper')
		})
	})

	describe('integration examples', () => {
		it('should work with complex nested validation', () => {
			const addressSchema: StandardSchemaV1<{
				street: string
				city: string
				country: string
			}> = {
				'~standard': {
					version: 1,
					vendor: 'address-validator',
					validate: (value) => {
						if (typeof value !== 'object' || value === null) {
							return { issues: [{ message: 'Must be an object', path: [] }] }
						}

						const issues: StandardSchemaV1.Issue[] = []

						if (!value.street || typeof value.street !== 'string') {
							issues.push({ message: 'Street is required', path: ['street'] })
						}

						if (!value.city || typeof value.city !== 'string') {
							issues.push({ message: 'City is required', path: ['city'] })
						}

						if (!value.country || typeof value.country !== 'string') {
							issues.push({ message: 'Country is required', path: ['country'] })
						}

						if (issues.length > 0) {
							return { issues }
						}

						return { value }
					},
				},
			}

			const userSchema: StandardSchemaV1<{
				name: string
				email: string
				address: typeof addressSchema
			}> = {
				'~standard': {
					version: 1,
					vendor: 'user-validator',
					validate: (value) => {
						if (typeof value !== 'object' || value === null) {
							return { issues: [{ message: 'Must be an object', path: [] }] }
						}

						const issues: StandardSchemaV1.Issue[] = []

						if (!value.name || typeof value.name !== 'string') {
							issues.push({ message: 'Name is required', path: ['name'] })
						}

						if (!value.email || typeof value.email !== 'string') {
							issues.push({ message: 'Email is required', path: ['email'] })
						}

						const addressResult = addressSchema['~standard'].validate(value.address)
						if (addressResult.issues) {
							issues.push(...addressResult.issues)
						}

						if (issues.length > 0) {
							return { issues }
						}

						return {
							value: {
								name: value.name,
								email: value.email,
								address: addressResult.value,
							},
						}
					},
				},
			}

			const result = validateWithSchema(userSchema, {
				name: 'John Doe',
				email: 'john@example.com',
				address: {
					street: '123 Main St',
					city: 'New York',
					country: 'USA',
				},
			})

			expect(result.issues).toBeUndefined()
			if (result.issues) {
				throw new Error('Expected valid result')
			}
			expect(result.value).toEqual({
				name: 'John Doe',
				email: 'john@example.com',
				address: {
					street: '123 Main St',
					city: 'New York',
					country: 'USA',
				},
			})
		})
	})
})

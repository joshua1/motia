
```import { EventConfig, ApiRouteConfig, Handlers } from '../types'
import { type StandardSchemaV1 } from '@standard-schema/spec'

/**
 * Create a basic string validator
 */
const stringSchema = (message = 'Must be a string'): StandardSchemaV1<string> => ({
	'~standard': {
		version: 1,
		vendor: 'motia-examples',
		validate(value) {
			if (typeof value === 'string') {
				return { value }
			}
			return { issues: [{ message, path: [] }] }
		},
	},
})

/**
 * Create a numeric string validator
 */
const numericStringSchema = (): StandardSchemaV1<string> => ({
	'~standard': {
		version: 1,
		vendor: 'motia-examples',
		validate(value) {
			if (typeof value === 'string' && /^\d+$/.test(value)) {
				return { value }
			}
			return { issues: [{ message: 'Must be a numeric string', path: [] }] }
		},
	},
})

/**
 * Create an email validator
 */
const emailSchema = (): StandardSchemaV1<string> => ({
	'~standard': {
		version: 1,
		vendor: 'motia-examples',
		validate(value) {
			if (typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
				return { value: value.toLowerCase() }
			}
			return { issues: [{ message: 'Invalid email format', path: [] }] }
		},
	},
})

/**
 * Create an object validator with nested validation
 */
const userSchema = (): StandardSchemaV1<{ name: string; email: string; age: number }> => ({
	'~standard': {
		version: 1,
		vendor: 'motia-examples',
		validate(value) {
			if (typeof value !== 'object' || value === null) {
				return { issues: [{ message: 'Must be an object', path: [] }] }
			}

			const issues: StandardSchemaV1.Issue[] = []

			if (typeof value.name !== 'string' || !value.name.trim()) {
				issues.push({ message: 'Name is required and must be a string', path: ['name'] })
			}

			if (typeof value.email !== 'string') {
				issues.push({ message: 'Email must be a string', path: ['email'] })
			} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) {
				issues.push({ message: 'Invalid email format', path: ['email'] })
			}

			if (typeof value.age !== 'number' || value.age < 0 || value.age > 150) {
				issues.push({ message: 'Age must be a number between 0 and 150', path: ['age'] })
			}

			if (issues.length > 0) {
				return { issues }
			}

			return {
				value: {
					name: value.name.trim(),
					email: value.email.toLowerCase(),
					age: value.age,
				}
			}
		},
		types: {
			input: { name: '', email: '', age: 0 },
			output: { name: '', email: '', age: 0 }
		}
	},
})

/**
 * Create an async validator for external validation
 */
const asyncEmailValidator = (): StandardSchemaV1<string> => ({
	'~standard': {
		version: 1,
		vendor: 'motia-async',
		async validate(value) {
			if (typeof value !== 'string') {
				return { issues: [{ message: 'Must be a string', path: [] }] }
			}

			// Simulate async external validation (e.g., checking against a service)
			await new Promise(resolve => setTimeout(resolve, 100))

			if (!value.includes('@')) {
				return { issues: [{ message: 'Email must contain @ symbol', path: [] }] }
			}

			return { value: value.toLowerCase() }
		},
	},
})

/**
 * Example Event configuration using Standard Schema
 */
export const userCreatedEvent: EventConfig = {
	type: 'event',
	name: 'UserCreated',
	description: 'Event triggered when a user is created',
	subscribes: ['user.created'],
	emits: ['user.processed'],
	input: userSchema(),
}

/**
 * Example API route with Standard Schema validation
 */
export const createUserApi: ApiRouteConfig = {
	type: 'api',
	name: 'CreateUser',
	description: 'Create a new user',
	path: '/users',
	method: 'POST',
	emits: ['user.created'],
	bodySchema: userSchema(),
	responseSchema: {
		201: {
			'~standard': {
				version: 1,
				vendor: 'motia-examples',
				validate(value) {
					if (typeof value !== 'object' || value === null) {
						return { issues: [{ message: 'Response must be an object', path: [] }] }
					}

					const required = ['id', 'name', 'email', 'age']
					const issues: StandardSchemaV1.Issue[] = []

					for (const field of required) {
						if (!(field in value)) {
							issues.push({ message: `Missing required field: ${ field } `, path: [field] })
						}
					}

					if (issues.length > 0) {
						return { issues }
					}

					return { value }
				},
			},
		},
		400: {
			'~standard': {
				version: 1,
				vendor: 'motia-examples',
				validate(value) {
					if (typeof value !== 'object' || value === null) {
						return { issues: [{ message: 'Error response must be an object', path: [] }] }
					}

					if (!('error' in value)) {
						return { issues: [{ message: 'Error response must contain error field', path: ['error'] }] }
					}

					if (typeof value.error !== 'string') {
						return { issues: [{ message: 'Error must be a string', path: ['error'] }] }
					}

					return { value }
				},
			},
		},
	},
}

/**
 * Mixed validation example - combining different schemas
 */
export const mixedValidationEvent: EventConfig = {
	type: 'event',
	name: 'MixedValidation',
	description: 'Event with mixed validation approaches',
	subscribes: ['user.update'],
	emits: ['user.updated'],
	input: {
		'~standard': {
			version: 1,
			vendor: 'motia-mixed',
			validate(value) {
				if (typeof value !== 'object' || value === null) {
					return { issues: [{ message: 'Must be an object', path: [] }] }
				}

				const issues: StandardSchemaV1.Issue[] = []

				// Validate userId with custom validator
				const userIdResult = stringSchema('User ID is required')['~standard'].validate(value.userId)
				if (userIdResult.issues) {
					issues.push(...userIdResult.issues.map(issue => ({ ...issue, path: ['userId', ...issue.path] })))
				}

				// Validate name
				if (typeof value.name !== 'string' || !value.name.trim()) {
					issues.push({ message: 'Name is required', path: ['name'] })
				}

				// Validate email with email schema
				const emailResult = emailSchema()['~standard'].validate(value.email)
				if (emailResult.issues) {
					issues.push(...emailResult.issues.map(issue => ({ ...issue, path: ['email', ...issue.path] })))
				}

				if (issues.length > 0) {
					return { issues }
				}

				return {
					value: {
						userId: userIdResult.value!,
						name: value.name.trim(),
						email: emailResult.value!,
					},
				}
			},
		},
	},
}

/**
 * Handlers demonstrating type inference with Standard Schema
 */
export const handlers: Handlers = {
	UserCreated: async (input, ctx) => {
		// input is properly typed as { name: string; email: string; age: number }
		console.log(`Processing user: ${ input.name } (${ input.email })`)
		console.log(`User age: ${ input.age } `)

		// Emit processed user event
		await ctx.emit({
			topic: 'user.processed',
			data: {
				id: Math.random().toString(36),
				name: input.name,
				email: input.email,
				processedAt: new Date().toISOString(),
			},
		})
	},

	MixedValidation: async (input, ctx) => {
		// input is properly typed from the mixed schema
		console.log(`Updating user: ${ input.name } `)

		await ctx.emit({
			topic: 'user.updated',
			data: {
				userId: input.userId,
				name: input.name,
				email: input.email,
			},
		})
	},
}

/**
 * Async validation handler
 */
export const asyncValidationHandler: Handlers['UserCreated'] = async (input, ctx) => {
	// Simulate async processing
	await new Promise(resolve => setTimeout(resolve, 50))

	// Use async validator to check email against external service
	const emailResult = await asyncEmailValidator()['~standard'].validate(input.email)
	if (emailResult.issues) {
		console.error('Email validation failed:', emailResult.issues)
		return
	}

	console.log(`Email validated asynchronously: ${ emailResult.value } `)

	await ctx.emit({
		topic: 'user.processed',
		data: { ...input, email: emailResult.value },
	})
}

/**
 * Example of creating a custom validator for business rules
 */
const businessRulesSchema = (): StandardSchemaV1<{ productName: string; price: number; category: string }> => ({
	'~standard': {
		version: 1,
		vendor: 'motia-business',
		validate(value) {
			if (typeof value !== 'object' || value === null) {
				return { issues: [{ message: 'Must be an object', path: [] }] }
			}

			const issues: StandardSchemaV1.Issue[] = []

			if (typeof value.productName !== 'string' || value.productName.length < 3) {
				issues.push({ message: 'Product name must be at least 3 characters', path: ['productName'] })
			}

			if (typeof value.price !== 'number' || value.price <= 0) {
				issues.push({ message: 'Price must be positive', path: ['price'] })
			}

			const validCategories = ['electronics', 'clothing', 'books', 'home']
			if (!validCategories.includes(value.category)) {
				issues.push({ message: `Invalid category.Must be one of: ${ validCategories.join(', ') } `, path: ['category'] })
			}

			if (issues.length > 0) {
				return { issues }
			}

			return {
				value: {
					...value,
					price: Number(value.price.toFixed(2)), // Format to 2 decimal places
					category: value.category.toLowerCase(),
				},
			}
		},
	},
})

/**
 * Export schemas for reuse
 */
export const schemas = {
	string: stringSchema,
	numericString: numericStringSchema,
	email: emailSchema,
	user: userSchema,
	asyncEmail: asyncEmailValidator,
	businessRules: businessRulesSchema,
}

/**
 * Export schema validators for external use
 */
export const validators = {
	validateString: (value: unknown) => stringSchema()['~standard'].validate(value),
	validateEmail: (value: unknown) => emailSchema()['~standard'].validate(value),
	validateUser: (value: unknown) => userSchema()['~standard'].validate(value),
	validateBusinessRules: (value: unknown) => businessRulesSchema()['~standard'].validate(value),
}

/**
 * Utility function for creating field-level schemas
 */
export const fields = {
	requiredString: (fieldName: string, message?: string) => ({
		'~standard': {
			version: 1,
			vendor: 'motia-fields',
			validate(value) {
				if (typeof value !== 'string' || !value.trim()) {
					return { issues: [{ message: message || `${ fieldName } is required`, path: [] }] }
				}
				return { value }
			},
		},
	}),

	optionalString: (fieldName: string) => ({
		'~standard': {
			version: 1,
			vendor: 'motia-fields',
			validate(value) {
				if (value === null || value === undefined) {
					return { value: null as any } // Allow null/undefined for optional fields
				}
				if (typeof value !== 'string') {
					return { issues: [{ message: `${ fieldName } must be a string if provided`, path: [] }] }
				}
				return { value }
			},
		},
	}),

	minLength: (min: number) => ({
		'~standard': {
			version: 1,
			vendor: 'motia-fields',
			validate(value) {
				if (typeof value !== 'string' || value.length < min) {
					return { issues: [{ message: `Must be at least ${ min } characters`, path: [] }] }
				}
				return { value }
			},
		},
	}),
}

/**
 * Usage examples and documentation
 */
export const usage = {
	// Basic string validation
	// const result = validators.validateString('hello') // { value: 'hello' }
	// const invalid = validators.validateString(123) // { issues: [{ message: 'Must be a string', path: [] }] }

	// Email validation
	// const emailResult = validators.validateEmail('test@example.com') // { value: 'test@example.com' }
	// const invalidEmail = validators.validateEmail('invalid') // { issues: [{ message: 'Invalid email format', path: [] }] }

	// User object validation
	// const userResult = validators.validateUser({ name: 'John', email: 'john@example.com', age: 25 })
	// const invalidUser = validators.validateUser({ name: '', email: 'invalid', age: -5 })

	// Field-level validation
	// const nameField = fields.requiredString('name')()
	// const optionalField = fields.optionalString('description')()

	// Schema composition
	// const composedSchema = {
	//   '~standard': {
	//     version: 1,
	//     vendor: 'motia-composed',
	//     validate(value) {
	//       const nameResult = nameField['~standard'].validate(value.name)
	//       if (nameResult.issues) return { issues: nameResult.issues }
	//       const emailResult = validators.validateEmail(value.email)
	//       if (emailResult.issues) return { issues: emailResult.issues }
	//       return { value: { name: nameResult.value, email: emailResult.value } }
	//     },
	//   },
	// }
}

/**
 * Migration guide from Zod to Standard Schema
 */
export const migrationGuide = {
	beforeZod: `
// Before: Using Zod
import { z } from 'zod'
import { EventConfig } from 'motia'

export const config: EventConfig = {
	type: 'event',
	name: 'UserEvent',
	input: z.object({
		name: z.string(),
		email: z.string().email(),
		age: z.number().min(18),
	}),
	// ... other config
}
	`,

	afterStandardSchema: `
// After: Using Standard Schema
import { EventConfig } from 'motia'

const userSchema = () => ({
	'~standard': {
		version: 1,
		vendor: 'my-validator',
		validate(value) {
			// Your validation logic here
		},
	},
})

export const config: EventConfig = {
	type: 'event',
	name: 'UserEvent',
	input: userSchema(),
	// ... other config
}
	`,
}

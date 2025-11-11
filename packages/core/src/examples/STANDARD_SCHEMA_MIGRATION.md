# Standard Schema Migration Guide

This guide explains how to migrate from Zod-only validation to Standard Schema V1 in the Motia framework, enabling support for multiple validation libraries.

## Overview

Standard Schema V1 is a specification that provides a common interface for JavaScript/TypeScript schema validation libraries. By adopting Standard Schema, Motia now supports:

- **Zod** (existing - fully backward compatible)
- **Valibot**
- **ArkType**
- **Effect Schema**
- **Yup**
- **Joi**
- **Typia**
- And any other library implementing Standard Schema V1

## Benefits

1. **Library Choice**: Use your preferred validation library
2. **No Vendor Lock-in**: Switch libraries without framework changes
3. **Backward Compatibility**: Existing Zod schemas continue to work
4. **Type Safety**: Full TypeScript inference with all libraries
5. **Future-Proof**: New libraries can be adopted without framework updates

## Quick Start

### 1. Install Your Preferred Library

```bash
# For Valibot
npm install valibot

# For ArkType
npm install arktype

# For Effect Schema
npm install effect

# For Yup
npm install yup
```

### 2. Replace Schema Definitions

#### Before (Zod only)
```typescript
import { z } from 'zod'
import { EventConfig } from 'motia'

export const config: EventConfig = {
  type: 'event',
  name: 'UserCreated',
  subscribes: ['user.created'],
  emits: ['user.processed'],
  input: z.object({
    userId: z.string(),
    email: z.string().email(),
    age: z.number().min(18),
  }),
}
```

#### After (Valibot)
```typescript
import * as v from 'valibot'
import { EventConfig } from 'motia'

export const config: EventConfig = {
  type: 'event',
  name: 'UserCreated',
  subscribes: ['user.created'],
  emits: ['user.processed'],
  input: v.object({
    userId: v.string(),
    email: v.string([v.email()]),
    age: v.number([v.minValue(18)]),
  }),
}
```

#### After (ArkType)
```typescript
import { type } from 'arktype'
import { EventConfig } from 'motia'

export const config: EventConfig = {
  type: 'event',
  name: 'UserCreated',
  subscribes: ['user.created'],
  emits: ['user.processed'],
  input: type({
    userId: 'string',
    email: 'string.email',
    age: 'number>=18',
  }),
}
```

## Library-Specific Examples

### API Routes

#### Valibot API Route
```typescript
import * as v from 'valibot'
import { ApiRouteConfig } from 'motia'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'CreateUser',
  path: '/users',
  method: 'POST',
  emits: ['user.created'],
  bodySchema: v.object({
    name: v.string([v.minLength(2)]),
    email: v.string([v.email()]),
    password: v.string([v.minLength(8)]),
  }),
  responseSchema: {
    201: v.object({
      id: v.string(),
      name: v.string(),
      email: v.string(),
      createdAt: v.string(),
    }),
    400: v.object({
      error: v.string(),
      details: v.optional(v.array(v.string())),
    }),
  },
}
```

#### ArkType API Route
```typescript
import { type } from 'arktype'
import { ApiRouteConfig } from 'motia'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'CreateUser',
  path: '/users',
  method: 'POST',
  emits: ['user.created'],
  bodySchema: type({
    name: 'string>=2',
    email: 'string.email',
    password: 'string>=8',
  }),
  responseSchema: {
    201: type({
      id: 'string',
      name: 'string',
      email: 'string.email',
      createdAt: 'string',
    }),
    400: type({
      error: 'string',
      details: 'string[]?',
    }),
  },
}
```

### Streams

```typescript
import { StreamConfig } from 'motia'
import * as v from 'valibot'

export const config: StreamConfig = {
  name: 'userProfiles',
  schema: v.object({
    id: v.string(),
    name: v.string([v.minLength(1)]),
    email: v.string([v.email()]),
    preferences: v.optional(v.record(v.string())),
  }),
  baseConfig: { storageType: 'default' },
}
```

## Type Inference

Type inference works identically across all libraries:

```typescript
import { Handlers } from 'motia'

export const handlers: Handlers = {
  // Works with any library - input is properly typed
  UserCreated: async (input, ctx) => {
    // TypeScript infers input type based on your schema
    console.log(`Processing user ${input.userId}`)
    console.log(`Email: ${input.email}`)
    console.log(`Age: ${input.age}`)

    // Emit with proper typing
    await ctx.emit({
      topic: 'user.processed',
      data: { userId: input.userId, processed: true }
    })
  },
}
```

## Advanced Usage

### Custom Validation Logic

You can create custom Standard Schema implementations:

```typescript
import { type StandardSchemaV1 } from '@standard-schema/spec'

const customEmailValidator = {
  '~standard': {
    version: 1 as const,
    vendor: 'my-company',
    validate(value: unknown) {
      if (typeof value !== 'string') {
        return { issues: [{ message: 'Must be a string', path: [] }] }
      }

      // Custom validation logic
      if (!value.includes('@company.com')) {
        return { issues: [{ message: 'Must use company email', path: [] }] }
      }

      return { value: value.toLowerCase() } // Transform
    },
  },
} as StandardSchemaV1<string>

// Use in config
export const config: EventConfig = {
  type: 'event',
  name: 'EmployeeEvent',
  subscribes: ['employee.created'],
  emits: ['employee.validated'],
  input: v.object({
    name: v.string(),
    email: customEmailValidator, // Mix with other libraries
  }),
}
```

### Async Validation

Some libraries support async validation:

```typescript
const asyncEmailSchema = {
  '~standard': {
    version: 1 as const,
    vendor: 'async-validator',
    async validate(value: unknown) {
      if (typeof value !== 'string') {
        return { issues: [{ message: 'Must be a string', path: [] }] }
      }

      // Check against external service
      const isValid = await checkEmailDomain(value)
      if (!isValid) {
        return { issues: [{ message: 'Invalid email domain', path: [] }] }
      }

      return { value }
    },
  },
} as StandardSchemaV1<string>
```

### Runtime Validation

If you need to validate data outside of Motia's automatic validation:

```typescript
import { validateWithSchema, type InferInput } from 'motia/schema/schema-utils'

function validateUserData<T>(schema: T, data: unknown): InferInput<T> {
  const result = validateWithSchema(schema, data)

  if (result.issues) {
    throw new Error(`Validation failed: ${result.issues.map(i => i.message).join(', ')}`)
  }

  return result.value
}

// Works with any library
const userData = validateUserData(userSchema, untrustedData)
```

## Migration Strategy

### Phase 1: No Changes Required
- Existing Zod schemas continue to work unchanged
- No immediate action needed

### Phase 2: Gradual Adoption
1. Install your preferred validation library
2. Start with new steps using the new library
3. Gradually migrate existing schemas as needed
4. Mix libraries within the same project if beneficial

### Phase 3: Full Migration (Optional)
- Replace all Zod schemas with your preferred library
- Remove Zod dependency if no longer needed
- Standardize on a single library across your project

## Common Questions

### Q: Do I need to change my handler code?
A: No. Handler code remains exactly the same. The type inference and validation work identically.

### Q: Can I mix libraries in the same project?
A: Yes. Each step can use a different validation library if needed.

### Q: Will my existing Zod schemas break?
A: No. Backward compatibility is maintained. Zod schemas continue to work as before.

### Q: How does performance compare?
A: Performance differences are minimal and typically depend on the validation library rather than the Standard Schema interface.

### Q: What about JSON Schema generation?
A: Zod schemas continue to use zod-to-json-schema. For other libraries, basic JSON Schema is generated from type information or sample validation.

### Q: Can I use custom validation logic?
A: Yes. You can implement custom Standard Schema V1 compliant validators for any use case.

## Troubleshooting

### Type Inference Issues
If TypeScript doesn't infer types correctly:
1. Ensure you're using the latest version of your validation library
2. Check that the library properly implements Standard Schema V1
3. Use explicit type annotations if needed

### Validation Errors
If validation behaves unexpectedly:
1. Check library-specific syntax differences
2. Ensure proper import/usage of the Standard Schema interface
3. Test schemas independently first

### Build Errors
If you encounter build errors:
1. Verify all validation library dependencies are installed
2. Check that your TypeScript version supports Standard Schema types
3. Ensure compatibility between library versions

## Resources

- [Standard Schema Specification](https://github.com/standard-schema/standard-schema)
- [Valibot Documentation](https://valibot.dev/)
- [ArkType Documentation](https://arktype.io/)
- [Effect Schema Documentation](https://effect.website/docs/schema)
- [Zod Documentation](https://zod.dev/)

## Support

For issues specific to Motia's Standard Schema implementation:
- Check the Motia documentation
- Review the examples in `motia/packages/core/src/examples/standard-schema-examples.ts`
- Open an issue in the Motia repository

For library-specific questions:
- Consult the validation library's documentation
- Check the library's Standard Schema V1 compliance status
- Review library-specific migration guides

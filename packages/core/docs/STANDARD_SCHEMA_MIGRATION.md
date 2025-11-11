# Valibot (recommended for performance)
npm install valibot

# ArkType (recommended for type safety)
npm install arktype

# Effect Schema (recommended for functional programming)
npm install effect

# Or any other Standard Schema V1 compliant library
```

### Step 2: Update Step Configurations

#### Before (Zod)
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

#### After (Effect Schema)
```typescript
import { Schema } from 'effect'
import { EventConfig } from 'motia'

export const config: EventConfig = {
  type: 'event',
  name: 'UserCreated',
  subscribes: ['user.created'],
  emits: ['user.processed'],
  input: Schema.Struct({
    userId: Schema.String,
    email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
    age: Schema.Number.pipe(Schema.greaterThanOrEqualTo(18)),
  }),
}
```

### Step 3: Update Handler Functions

Handler functions remain exactly the same - only the schema definition changes:

```typescript
// This works with any Standard Schema V1 compliant library
export const handler = async (input, ctx) => {
  // input is properly typed based on your schema
  console.log(`Processing user: ${input.userId}`)

  await ctx.emit({
    topic: 'user.processed',
    data: { userId: input.userId, processed: true }
  })
}
```

## API Changes

### Event Config
```typescript
// Before
input: z.ZodObject<any>

// After
input: StandardInput
```

### API Route Config
```typescript
// Before
bodySchema?: z.ZodObject<any>
responseSchema?: Record<number, z.ZodObject<any> | z.ZodAny>

// After
bodySchema?: StandardInput
responseSchema?: Record<number, StandardInput>
```

### Stream Config
```typescript
// Before
schema: z.ZodObject<any>

// After
schema: StandardInput
```

## Library-Specific Examples

### Valibot Examples

#### Event Step
```typescript
import * as v from 'valibot'
import { EventConfig } from 'motia'

const userSchema = v.object({
  id: v.string([v.uuid()]),
  name: v.string([v.minLength(2), v.maxLength(50)]),
  email: v.string([v.email()]),
  age: v.number([v.minValue(18), v.maxValue(120)]),
  role: v.enum(['admin', 'user', 'guest']),
  preferences: v.optional(v.record(v.string())),
  createdAt: v.optional(v.date()),
})

export const config: EventConfig = {
  type: 'event',
  name: 'UserCreated',
  description: 'Validates user creation with Valibot',
  subscribes: ['user.created'],
  emits: ['user.validated'],
  input: userSchema,
}
```

#### API Route
```typescript
import * as v from 'valibot'
import { ApiRouteConfig } from 'motia'

const createUserSchema = v.object({
  name: v.string([v.minLength(2), v.maxLength(50)]),
  email: v.string([v.email()]),
  password: v.string([v.minLength(8), v.regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number')]),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'CreateUser',
  path: '/users',
  method: 'POST',
  emits: ['user.created'],
  bodySchema: createUserSchema,
  responseSchema: {
    201: v.object({
      id: v.string(),
      name: v.string(),
      email: v.string([v.email()]),
      createdAt: v.string(),
    }),
    400: v.object({
      error: v.string(),
      details: v.optional(v.array(v.string())),
    }),
  },
}
```

### ArkType Examples

#### Event Step
```typescript
import { type } from 'arktype'
import { EventConfig } from 'motia'

const User = type({
  id: 'string.uuid',
  name: 'string>=2<=50',
  email: 'string.email',
  age: 'number>=18<=120',
  role: "'admin'|'user'|'guest'",
  preferences: '{[string]: string}?',
  createdAt: 'Date?',
})

export const config: EventConfig = {
  type: 'event',
  name: 'UserCreated',
  description: 'Validates user creation with ArkType',
  subscribes: ['user.created'],
  emits: ['user.validated'],
  input: User,
}
```

#### API Route
```typescript
import { type } from 'arktype'
import { ApiRouteConfig } from 'motia'

const CreateUser = type({
  name: 'string>=2<=50',
  email: 'string.email',
  password: 'string>=8',
})

const UserResponse = type({
  id: 'string.uuid',
  name: 'string',
  email: 'string.email',
  createdAt: 'Date',
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'CreateUser',
  path: '/users',
  method: 'POST',
  emits: ['user.created'],
  bodySchema: CreateUser,
  responseSchema: {
    201: UserResponse,
    400: type({
      error: 'string',
      details: 'string[]?',
    }),
  },
}
```

## Advanced Usage

### Custom Standard Schema Implementation

You can create your own validators that implement Standard Schema V1:

```typescript
import { type StandardSchemaV1 } from '@standard-schema/spec'

// Custom email validator with async domain check
const emailValidator: StandardSchemaV1<string> = {
  '~standard': {
    version: 1,
    vendor: 'custom-email-validator',
    async validate(value) {
      if (typeof value !== 'string') {
        return { issues: [{ message: 'Must be a string', path: [] }] }
      }

      if (!value.includes('@')) {
        return { issues: [{ message: 'Must contain @ symbol', path: [] }] }
      }

      // Async domain validation
      const [, domain] = value.split('@')
      const isValidDomain = await checkDomainValidity(domain)

      if (!isValidDomain) {
        return { issues: [{ message: 'Invalid domain', path: [] }] }
      }

      return { value: value.toLowerCase() }
    },
  },
}

// Use in config
export const config: EventConfig = {
  type: 'event',
  name: 'EmailValidated',
  subscribes: ['email.received'],
  emits: ['email.processed'],
  input: {
    '~standard': {
      version: 1,
      vendor: 'motia-composed',
      validate(value) {
        if (typeof value !== 'object' || value === null) {
          return { issues: [{ message: 'Must be an object', path: [] }] }
        }

        const emailResult = emailValidator['~standard'].validate(value.email)
        if (emailResult.issues) {
          return { issues: [...emailResult.issues.map(issue => ({ ...issue, path: ['email', ...issue.path]))] }
        }

        return { value }
      },
    },
  },
}
```

### Schema Composition

Combine multiple schemas or libraries:

```typescript
import * as v from 'valibot'
import { type StandardSchemaV1 } from '@standard-schema/spec'

// External service validator
const externalIdSchema: StandardSchemaV1<string> = {
  '~standard': {
    version: 1,
    vendor: 'external-service',
    async validate(value) {
      if (typeof value !== 'string') {
        return { issues: [{ message: 'Must be a string', path: [] }] }
      }

      const isValid = await validateWithExternalService(value)
      if (!isValid) {
        return { issues: [{ message: 'Invalid external ID', path: [] }] }
      }

      return { value }
    },
  },
}

// Combine with local validation
const createUserSchema = v.object({
  name: v.string([v.minLength(2)]),
  email: v.string([v.email()]),
  externalId: externalIdSchema, // Mix with custom async validator
  preferences: v.optional(v.record(v.string())),
})
```

## Type Safety

Standard Schema V1 provides full type safety:

```typescript
import * as v from 'valibot'
import { type StandardSchemaV1 } from '@standard-schema/spec'

const userSchema = v.object({
  id: v.string(),
  name: v.string(),
  email: v.string([v.email()]),
})

type User = StandardSchemaV1.InferInput<typeof userSchema>
// type User = { id: string; name: string; email: string }

type ValidatedUser = StandardSchemaV1.InferOutput<typeof userSchema>
// type ValidatedUser = { id: string; name: string; email: string }

function processUser(user: User) {
  // Full type safety with input type
  return user
}
```

## Error Handling

Use Standard Schema utilities for better error handling:

```typescript
import { validateOrThrow, SchemaError, formatValidationErrors } from 'motia'

try {
  const validatedData = validateOrThrow(userSchema, inputData)
  // Process validated data
} catch (error) {
  if (error instanceof SchemaError) {
    console.error('Validation failed:')
    error.issues.forEach(issue => {
      console.error(`  ${issue.path?.join('.') || 'root'}: ${issue.message}`)
    })
  }
  throw error
}
```

## Performance Considerations

### Library Performance
- **Valibot**: Best performance, minimal bundle size
- **ArkType**: Excellent type safety, good runtime performance
- **Effect Schema**: Functional programming paradigm, good performance
- **Zod**: Good performance, but no longer supported in Motia

### Bundle Size
Standard Schema libraries generally produce smaller bundles than Zod:
- Valibot: ~2KB minified
- ArkType: ~3KB minified
- Effect Schema: ~4KB minified

## Testing

Update tests to work with Standard Schema:

```typescript
// Before
import { z } from 'zod'

// After
import * as v from 'valibot'

// Before
const schema = z.object({ name: z.string() })

// After
const schema = v.object({ name: v.string() })

// Validation works the same
const result = schema['~standard'].validate(data)
if (result.issues) {
  // Handle validation errors
} else {
  // Use validated data
}
```

## Benefits of Migration

1. **No Vendor Lock-in**: Switch between libraries without code changes
2. **Better Performance**: Choose fastest library for your use case
3. **Smaller Bundles**: Standard Schema libraries are generally smaller
4. **Future-Proof**: New libraries work without framework updates
5. **Unified Interface**: Consistent API across all libraries
6. **Async Support**: Built-in support for async validation

## Migration Checklist

- [ ] Remove `zod` from package.json
- [ ] Remove `zod-to-json-schema` from package.json
- [ ] Add `@standard-schema/spec` and `@standard-schema/utils`
- [ ] Update all EventConfig.input to use StandardInput
- [ ] Update all ApiRouteConfig.bodySchema/responseSchema to use StandardInput
- [ ] Update all StreamConfig.schema to use StandardInput
- [ ] Replace Zod schema definitions with chosen library
- [ ] Update imports from `zod` to chosen library
- [ ] Test all validation works correctly
- [ ] Update documentation
- [ ] Remove Zod type references

## Troubleshooting

### Common Issues

#### "Type 'X' has no properties in common with type 'Y'"
- Ensure using correct import from chosen library
- Check that schema implements Standard Schema V1 interface

#### "validate is not a function"
- Ensure the schema has `~standard.validate` method
- Check that library implements Standard Schema V1 correctly

#### JSON Schema conversion issues
- Standard Schema doesn't require JSON Schema conversion internally
- Use library's built-in conversion if available
- The framework handles this automatically

### Getting Help

- Check [Standard Schema documentation](https://github.com/standard-schema/standard-schema)
- Review [Motia examples](../src/examples/standard-schema-examples.ts)
- Check library-specific documentation
- Open an issue on Motia repository

## Library Recommendations

| Library | Best For | Bundle Size | Type Safety | Performance |
|----------|------------|-------------|-------------|------------|
| Valibot | Performance | Small | Good | Excellent |
| ArkType | Type Safety | Medium | Excellent | Good |
| Effect Schema | FP | Large | Excellent | Good |

Choose based on your project needs:
- **Performance critical**: Valibot
- **Type safety critical**: ArkType
- **Functional programming**: Effect Schema
- **Balanced approach**: Any of the above
```

Now let me try to build the updated code to ensure everything works:
<tool_call>terminal
<arg_key>command</arg_key>
<arg_value>cd packages/core && npm run build</arg_value>
<arg_key>cd</arg_key>
<arg_value>motia</arg_value>
</tool_call>

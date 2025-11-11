import { ApiResponse, ApiRouteConfig, ApiRouteHandler } from '../types'
import { type StandardSchemaV1 } from '@standard-schema/spec'

// Create a Standard Schema for emit data
const emitSchema: StandardSchemaV1<{ topic: string; data: Record<string, unknown> }> = {
	'~standard': {
		version: 1,
		vendor: 'motia-emit',
		validate(value) {
			if (typeof value !== 'object' || value === null) {
				return { issues: [{ message: 'Must be an object', path: [] }] }
			}

			const { topic, data } = value

			if (typeof topic !== 'string') {
				return { issues: [{ message: 'Topic must be a string', path: ['topic'] }] }
			}

			if (!topic.trim()) {
				return { issues: [{ message: 'Topic cannot be empty', path: ['topic'] }] }
			}

			if (typeof data !== 'object' || data === null) {
				return { issues: [{ message: 'Data must be an object', path: ['data'] }] }
			}

			return { value: { topic, data } }
		},
	},
}

export const config: ApiRouteConfig = {
	type: 'api',
	name: 'Event Emitter',
	description: 'System endpoint for emitting events',
	path: '/emit',
	method: 'POST',
	emits: [], // Dynamic emissions
	flows: ['_system'],
	bodySchema: emitSchema,
}

type EmitData = StandardSchemaV1.InferInput<typeof emitSchema>

export const handler: ApiRouteHandler<
	EmitData,
	ApiResponse<200, { success: true; emitted: EmitData }>,
	EmitData
> = async (req, { emit, logger }) => {
	const { topic, data } = req.body

	logger.info('[Event Emitter] Emitting event', { topic, data })
	await emit({ topic, data })

	return {
		status: 200,
		body: { success: true, emitted: { topic, data } },
	}
}
```
<tool_call>sequentialthinking
<arg_key>thought</arg_key>
<think></think>
Now I need to update other files that use schemas. Let me continue with the helper files and API endpoints:
<tool_call>edit_file
<arg_key>display_description</arg_key>
<arg_value>Update helper flows to use Standard Schema</arg_value>
<arg_key>path</arg_key>
<arg_value>motia/packages/core/src/helper/flows-helper.ts</arg_value>
<arg_key>mode</arg_key>
<arg_value>edit</arg_value>
</tool_call>

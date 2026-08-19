import createClient from 'openapi-fetch'
import type { paths } from './schema' // Path to your generated OpenAPI file

export const api = createClient<paths>({
    baseUrl: '/api',
})

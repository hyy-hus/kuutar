// src/api/client.ts
import createClient, { type Middleware } from 'openapi-fetch'
import type { paths } from './schema'

export const api = createClient<paths>({
    baseUrl: '/api',
})

const authMiddleware: Middleware = {
    async onRequest({ request }) {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('access_token')
            if (token) {
                request.headers.set('Authorization', `Bearer ${token}`)
            }
        }
        return request
    },

    async onResponse({ request, response }) {
        // If request fails with 401 and isn't already trying to login/refresh
        if (response.status === 401 && !request.url.includes('/auth/')) {
            const refreshToken = localStorage.getItem('refresh_token')

            if (refreshToken) {
                try {
                    // Attempt token refresh
                    const res = await fetch('/api/auth/refresh', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refresh_token: refreshToken }),
                    })

                    if (res.ok) {
                        const data = await res.json()
                        localStorage.setItem('access_token', data.access_token)
                        localStorage.setItem('refresh_token', data.refresh_token)

                        // Retry original request with new token
                        const newRequest = new Request(request)
                        newRequest.headers.set('Authorization', `Bearer ${data.access_token}`)
                        return fetch(newRequest)
                    }
                } catch {
                    // Refresh failed, purge tokens
                    localStorage.removeItem('access_token')
                    localStorage.removeItem('refresh_token')
                }
            }
        }

        return response
    },
}

api.use(authMiddleware)

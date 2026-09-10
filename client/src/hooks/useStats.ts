// client/src/hooks/useStats.ts
import { useQuery } from '@tanstack/react-query'
import { api } from '#/api/client'
import type { components } from '#/api/schema'

export type SystemStats = components['schemas']['SystemStats']
export type TopResourceStat = components['schemas']['TopResourceStat']

export const statsKeys = {
    all: ['stats'] as const,
    summary: () => [...statsKeys.all, 'summary'] as const,
}

export function useStats() {
    return useQuery({
        queryKey: statsKeys.summary(),
        queryFn: async () => {
            const { data, error } = await api.GET('/stats')
            if (error || !data) throw new Error('Tilastojen haku epäonnistui.')
            return data
        },
        staleTime: 1000 * 60 * 5, // Cache stats for 5 minutes
    })
}

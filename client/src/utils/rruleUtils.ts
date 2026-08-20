// src/utils/rruleUtils.ts
import { RRule, Frequency, rrulestr } from 'rrule'
import type { CreateOccurrencePayload } from '#/hooks/useReservations'

export interface RRuleConfig {
    freq: Frequency | null
    count?: number
}

export function parseRRule(rruleStr?: string | null): RRuleConfig {
    if (!rruleStr) return { freq: null, count: 1 }

    try {
        const rule = rrulestr(rruleStr) as RRule
        return {
            freq: rule.options.freq ?? null,
            count: rule.options.count ?? 1,
        }
    } catch {
        return { freq: null, count: 1 }
    }
}

export function generateOccurrences(
    startTimeStr: string,
    endTimeStr: string,
    resourceId: string,
    config: RRuleConfig
): { occurrences: CreateOccurrencePayload[]; rruleString: string | null } {
    if (!startTimeStr || !endTimeStr || !resourceId) {
        return { occurrences: [], rruleString: null }
    }

    const start = new Date(startTimeStr)
    const end = new Date(endTimeStr)
    const durationMs = end.getTime() - start.getTime()

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || durationMs <= 0) {
        return { occurrences: [], rruleString: null }
    }

    if (config.freq === null) {
        return {
            occurrences: [
                {
                    resource_id: resourceId,
                    start_time: start.toISOString(),
                    end_time: end.toISOString(),
                },
            ],
            rruleString: null,
        }
    }

    const rule = new RRule({
        freq: config.freq,
        dtstart: start,
        count: Math.max(1, config.count ?? 1),
    })

    const dates = rule.all()
    const occurrences: CreateOccurrencePayload[] = dates.map((d) => {
        const occEnd = new Date(d.getTime() + durationMs)
        return {
            resource_id: resourceId,
            start_time: d.toISOString(),
            end_time: occEnd.toISOString(),
        }
    })

    return {
        occurrences,
        rruleString: rule.toString(),
    }
}

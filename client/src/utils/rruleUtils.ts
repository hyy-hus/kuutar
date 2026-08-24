import { RRule, Frequency, rrulestr } from 'rrule'
import type { CreateOccurrencePayload } from '#/hooks/useReservations'

export interface RRuleConfig {
    freq: Frequency | null
    until?: Date | null
}

export function parseRRule(rruleStr?: string | null): RRuleConfig {
    if (!rruleStr) return { freq: null, until: null }

    try {
        const rule = rrulestr(rruleStr) as RRule
        return {
            freq: rule.options.freq ?? null,
            until: rule.options.until ?? null,
        }
    } catch {
        return { freq: null, until: null }
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

    // Default until date to end of start date if not provided
    const untilDate = config.until ? new Date(config.until) : new Date(start)
    // Ensure UNTIL covers through the end of the selected day
    untilDate.setHours(23, 59, 59, 999)

    const rule = new RRule({
        freq: config.freq,
        dtstart: start,
        until: untilDate,
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

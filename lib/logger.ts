// Structured logger — wraps next-axiom when configured, falls back to console.
// Every log call includes timestamp, and any fields passed (business_id, lead_id, event_type).
// Usage:
//   import { logger } from '@/lib/logger'
//   logger.info('lead_created', { business_id, lead_id, event_type: 'lead_created' })

import { Logger } from 'next-axiom'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogFields {
  business_id?: string
  lead_id?: string
  event_type?: string
  [key: string]: unknown
}

// next-axiom reads NEXT_PUBLIC_AXIOM_DATASET + NEXT_PUBLIC_AXIOM_TOKEN automatically.
// If those are missing, it no-ops internally and we fall through to console.
const axiomConfigured =
  !!process.env.NEXT_PUBLIC_AXIOM_DATASET && !!process.env.NEXT_PUBLIC_AXIOM_TOKEN

function consoleLog(level: LogLevel, message: string, fields?: LogFields) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields,
  }
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(JSON.stringify(entry))
}

function makeLogger() {
  return {
    debug(message: string, fields?: LogFields) {
      if (axiomConfigured) {
        const log = new Logger()
        log.debug(message, fields)
        // Fire-and-forget flush — don't block callers
        log.flush().catch(() => {})
      }
      if (process.env.NODE_ENV === 'development') {
        consoleLog('debug', message, fields)
      }
    },

    info(message: string, fields?: LogFields) {
      if (axiomConfigured) {
        const log = new Logger()
        log.info(message, fields)
        log.flush().catch(() => {})
      }
      consoleLog('info', message, fields)
    },

    warn(message: string, fields?: LogFields) {
      if (axiomConfigured) {
        const log = new Logger()
        log.warn(message, fields)
        log.flush().catch(() => {})
      }
      consoleLog('warn', message, fields)
    },

    error(message: string, fields?: LogFields) {
      if (axiomConfigured) {
        const log = new Logger()
        log.error(message, fields)
        log.flush().catch(() => {})
      }
      consoleLog('error', message, fields)
    },
  }
}

export const logger = makeLogger()

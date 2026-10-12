import webpush from 'web-push'
import { logger } from '@/lib/logger'

// VAPID keys must be set in env. Generate once with:
// node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(JSON.stringify(k))"
function getVapidConfig() {
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject    = process.env.VAPID_SUBJECT ?? 'mailto:admin@theleadflowautomation.com'
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject }
}

export interface PushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export async function sendPushNotification(params: {
  subscriptions: PushSubscription[]
  title: string
  body: string
  url?: string
}): Promise<void> {
  const vapid = getVapidConfig()
  if (!vapid) return // VAPID not configured — skip silently

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)

  const payload = JSON.stringify({
    title: params.title,
    body: params.body,
    url: params.url ?? '/dashboard',
  })

  await Promise.all(
    params.subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload)
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          // Subscription expired — caller should remove it
          logger.info('push_subscription_expired', { endpoint: sub.endpoint.slice(-20) })
        } else {
          logger.error('push_send_failed', { error: String(err) })
        }
      }
    })
  )
}

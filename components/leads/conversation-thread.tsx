'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ManualReply } from './manual-reply'
import { timeAgo } from '@/lib/utils'

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  channel: string
  ai_generated: boolean
  created_at: string
}

interface Props {
  leadId: string
  aiPaused: boolean
  personaName: string
  initialMessages: Message[]
}

export function ConversationThread({ leadId, aiPaused, personaName, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)

  function handleSent(msg: { id: string; body: string; created_at: string }) {
    setMessages((prev) => [
      ...prev,
      {
        id: msg.id,
        direction: 'outbound',
        body: msg.body,
        channel: 'sms',
        ai_generated: false,
        created_at: msg.created_at,
      },
    ])
  }

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {!messages.length ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-slate-400">No messages yet.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOutbound = msg.direction === 'outbound'
            return (
              <div
                key={msg.id}
                className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}
              >
                <div className={cn('max-w-[75%] space-y-1', isOutbound ? 'items-end' : 'items-start', 'flex flex-col')}>
                  <div
                    className={cn(
                      'px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                      isOutbound
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-slate-100 text-slate-900 rounded-bl-md',
                    )}
                  >
                    {msg.body}
                  </div>
                  <div className={cn('flex items-center gap-1.5', isOutbound ? 'flex-row-reverse' : '')}>
                    <span className="text-xs text-slate-400">{timeAgo(msg.created_at)}</span>
                    {isOutbound && msg.ai_generated && (
                      <span className="text-xs text-slate-400">· AI</span>
                    )}
                    {isOutbound && !msg.ai_generated && (
                      <span className="text-xs text-slate-400">· Manual</span>
                    )}
                    {msg.channel === 'voice' && (
                      <span className="text-xs text-slate-400">· Voice</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Manual reply input — only when AI is paused */}
      {aiPaused && (
        <ManualReply leadId={leadId} personaName={personaName} onSent={handleSent} />
      )}
    </>
  )
}

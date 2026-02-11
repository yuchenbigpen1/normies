/**
 * ThreadOverlay - Fullscreen overlay for threaded discussions (Normies)
 *
 * Opens when a user wants a second opinion or critique on an assistant message.
 * Shows the original message at top, thread messages below, and a floating input at bottom.
 *
 * Uses PreviewOverlay as the base container.
 */

import * as React from 'react'
import { MessageCircle } from 'lucide-react'
import { PreviewOverlay } from './PreviewOverlay'
import { Markdown } from '../markdown'

export interface ThreadMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

export interface ThreadOverlayProps {
  /** Whether the overlay is visible */
  isOpen: boolean
  /** Callback when the overlay should close */
  onClose: () => void
  /** Theme mode */
  theme?: 'light' | 'dark'
  /** The original assistant message being discussed */
  originalMessage: string
  /** Messages in the thread conversation */
  threadMessages: ThreadMessage[]
  /** Whether the thread assistant is currently streaming */
  isStreaming?: boolean
  /** Callback when user sends a message in the thread */
  onSendMessage?: (message: string) => void
  /** Render prop for the input area — allows parent to provide the actual ChatInput */
  renderInput?: () => React.ReactNode
}

export function ThreadOverlay({
  isOpen,
  onClose,
  theme,
  originalMessage,
  threadMessages,
  isStreaming,
  onSendMessage,
  renderInput,
}: ThreadOverlayProps) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (threadMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [threadMessages.length])

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      theme={theme}
      typeBadge={{
        icon: MessageCircle,
        label: 'Thread',
        variant: 'gray',
      }}
      title="Sanity Check"
    >
      {/* Matches DocumentFormattedMarkdownOverlay layout: max-w-[960px], centered, px-6 */}
      <div className="flex flex-col min-h-full !justify-start px-6 py-8">
        <div className="w-full max-w-[960px] mx-auto flex flex-col flex-1">
          {/* Original message in a card */}
          <div className="rounded-[16px] bg-background shadow-strong p-8 mb-6">
            <div className="text-sm">
              <Markdown mode="minimal">{originalMessage}</Markdown>
            </div>
          </div>

          {/* Thread messages */}
          <div className="flex-1 space-y-4">
            {threadMessages.map((msg) => (
              <div
                key={msg.id}
                className={
                  msg.role === 'user'
                    ? 'flex justify-end'
                    : 'flex justify-start'
                }
              >
                <div
                  className={
                    msg.role === 'user'
                      ? 'max-w-[80%] rounded-[12px] bg-foreground text-background px-4 py-2.5 text-sm'
                      : 'max-w-[80%] text-sm'
                  }
                >
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <Markdown mode="minimal">{msg.content}</Markdown>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Floating input area — pinned to bottom */}
          {renderInput && (
            <div className="sticky bottom-0 pt-4 pb-2 mt-auto">
              <div className="absolute inset-0 bg-gradient-to-t from-foreground-3 via-foreground-3/80 to-transparent pointer-events-none" />
              <div className="relative">
                {renderInput()}
              </div>
            </div>
          )}
        </div>
      </div>
    </PreviewOverlay>
  )
}

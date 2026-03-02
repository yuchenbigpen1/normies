/**
 * SelfReview Tool
 *
 * Session-scoped tool that enables the agent to get an independent critique
 * of the current conversation from a secondary LLM. Replaces the old manual
 * "Sanity Check" thread overlay with a single automated tool call.
 *
 * Flow:
 * 1. Agent calls self_review (triggered by user clicking "Review" button or asking)
 * 2. Tool fetches conversation transcript via onGetConversation callback
 * 3. Tool calls Anthropic API (Haiku) with a critic system prompt
 * 4. Returns the critic's feedback as a tool result
 * 5. Agent incorporates the feedback inline
 */

import Anthropic from '@anthropic-ai/sdk';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { getAnthropicApiKey, getAnthropicBaseUrl } from '../../config/storage.ts';

// Tool result type - matches what the SDK expects
type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

import type { SessionScopedToolCallbacks } from '../session-scoped-tools.ts';

// ============================================================================
// CRITIC SYSTEM PROMPT
// ============================================================================

const CRITIC_SYSTEM_PROMPT = `You are an independent critic reviewing a conversation between a user and an AI assistant.

## Your Job

Review the conversation and provide honest, actionable feedback:
- Are there mistakes, incorrect assumptions, or missed edge cases?
- Is the assistant addressing the user's actual intent?
- Are there better approaches the assistant should consider?
- Is the assistant being too verbose, too vague, or missing the point?
- If the implementation involves any external SDK, library, API, or tool: has the assistant verified that the approach matches the latest patterns, features, and best practices? Flag any usage that may rely on stale knowledge or outdated APIs — the assistant should search/verify before committing to a specific approach.

## Output Format

Provide your feedback as a concise critique:
1. Start with a one-line overall assessment (looks good / has issues / mixed)
2. List specific points (3-5 bullet points max)
3. If something is wrong, suggest what should be done instead

## Important

- Be honest — don't soften criticism at the cost of clarity
- Don't manufacture problems. If the conversation looks solid, say so briefly
- Focus on what matters most, not minor style issues
- Address the assistant directly (e.g., "You should..." or "The approach to X is flawed because...")`;

// ============================================================================
// TOOL CREATION
// ============================================================================

function errorResponse(message: string): ToolResult {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}

/**
 * Create the self_review session-scoped tool.
 *
 * @param sessionId - Current session ID
 * @param getCallbacks - Function to get registered callbacks for this session
 */
export function createSelfReviewTool(
  sessionId: string,
  getCallbacks: () => SessionScopedToolCallbacks | undefined,
) {
  return tool(
    'self_review',
    `Get an independent critique of the current conversation from a secondary AI.

Call this when the user wants a review or "sanity check" of the conversation.
The tool fetches the conversation history, sends it to an independent critic model,
and returns actionable feedback.

Use this when:
- The user clicks the "Review" button or asks for a review/sanity check
- You want a second opinion on your approach before proceeding

The critic reviews the full conversation and provides honest feedback about
mistakes, missed considerations, or better approaches.`,
    {
      focus: z.string().optional().describe(
        'Optional focus area for the review (e.g., "security implications", "performance", "correctness"). If not provided, the critic reviews everything.'
      ),
    },
    async (args) => {
      // 1. Get conversation transcript via callback
      const callbacks = getCallbacks();
      if (!callbacks?.onGetConversation) {
        return errorResponse('Self-review is not available in this context.');
      }

      const transcript = await callbacks.onGetConversation();
      if (!transcript) {
        return errorResponse('No conversation to review yet.');
      }

      // 2. Authenticate
      const apiKey = await getAnthropicApiKey();
      if (!apiKey) {
        return errorResponse(
          'self_review requires an Anthropic API key.\n\n' +
          'Add an API key in Settings to enable conversation review.'
        );
      }

      // 3. Build the review prompt
      const reviewPrompt = args.focus
        ? `Review the following conversation, focusing specifically on: ${args.focus}\n\n${transcript}`
        : `Review the following conversation:\n\n${transcript}`;

      // 4. Call Anthropic API
      const baseUrl = getAnthropicBaseUrl();
      const client = new Anthropic({
        apiKey,
        ...(baseUrl ? { baseURL: baseUrl } : {}),
      });

      try {
        const response = await client.messages.create({
          model: 'claude-opus-4-6',
          max_tokens: 2048,
          system: CRITIC_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: reviewPrompt }],
        });

        // Extract text from response
        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map(block => block.text)
          .join('\n');

        if (!text) {
          return errorResponse('Critic returned an empty response. Please try again.');
        }

        return {
          content: [{ type: 'text' as const, text }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return errorResponse(`Failed to get review: ${message}`);
      }
    },
  );
}

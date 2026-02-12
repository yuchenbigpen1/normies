/**
 * Tests for QuestionResponse formatting logic.
 *
 * The session manager formats QuestionResponse into a user message string
 * that the agent reads to understand the user's answer. This test validates
 * that the formatting logic produces correct output for all scenarios.
 *
 * Covers:
 * - Single question, single select → option label
 * - Single question, free text → free text value
 * - Multiple questions → question headers + answers
 * - Skipped/cancelled → skip message
 * - Multi-select → comma-separated labels
 * - Edge cases: empty selections, missing answers
 */
import { describe, it, expect } from 'bun:test';
import type { QuestionItem } from '../session-scoped-tools.ts';

// Replicate the exact formatting logic from sessions.ts respondToQuestion
// to test it in isolation without needing Electron
interface QuestionAnswer {
  selectedLabels?: string[];
  freeText?: string;
}

interface QuestionResponse {
  type: 'question';
  requestId: string;
  answers: QuestionAnswer[];
  cancelled: boolean;
}

/**
 * Format question answers into a user-facing message string.
 * This mirrors the logic in SessionManager.respondToQuestion()
 */
function formatQuestionAnswers(questions: QuestionItem[], response: QuestionResponse): string {
  if (response.cancelled) {
    return '[User skipped the question]';
  }

  const answerLines: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i]!;
    const answer = response.answers[i];
    if (questions.length > 1) {
      answerLines.push(`**${question.question}**`);
    }
    if (answer?.freeText) {
      answerLines.push(answer.freeText);
    } else if (answer?.selectedLabels?.length) {
      answerLines.push(answer.selectedLabels.join(', '));
    }
  }

  return answerLines.join('\n');
}

// ============================================
// Test cases
// ============================================

describe('Question response formatting — single question', () => {
  const singleQuestion: QuestionItem[] = [{
    question: 'What kind of tracking do you need?',
    options: [
      { label: 'Sales pipeline', description: 'Track deals from lead to close' },
      { label: 'Support tickets', description: 'Track customer issues' },
      { label: 'Usage analytics' },
    ],
  }];

  it('formats single option selection as just the label', () => {
    const result = formatQuestionAnswers(singleQuestion, {
      type: 'question',
      requestId: 'req-1',
      answers: [{ selectedLabels: ['Sales pipeline'] }],
      cancelled: false,
    });

    expect(result).toBe('Sales pipeline');
  });

  it('formats free text response as the raw text', () => {
    const result = formatQuestionAnswers(singleQuestion, {
      type: 'question',
      requestId: 'req-1',
      answers: [{ freeText: 'I need inventory tracking for my warehouse' }],
      cancelled: false,
    });

    expect(result).toBe('I need inventory tracking for my warehouse');
  });

  it('formats cancelled as skip message', () => {
    const result = formatQuestionAnswers(singleQuestion, {
      type: 'question',
      requestId: 'req-1',
      answers: [{}],
      cancelled: true,
    });

    expect(result).toBe('[User skipped the question]');
  });

  it('does NOT include question header for single question', () => {
    const result = formatQuestionAnswers(singleQuestion, {
      type: 'question',
      requestId: 'req-1',
      answers: [{ selectedLabels: ['Support tickets'] }],
      cancelled: false,
    });

    // Single question should not have the bold header
    expect(result).not.toContain('**');
    expect(result).toBe('Support tickets');
  });
});

describe('Question response formatting — multiple questions', () => {
  const multipleQuestions: QuestionItem[] = [
    {
      question: 'What framework?',
      options: [{ label: 'React' }, { label: 'Vue' }],
    },
    {
      question: 'What database?',
      options: [{ label: 'PostgreSQL' }, { label: 'MongoDB' }],
    },
    {
      question: 'What hosting?',
      options: [{ label: 'Vercel' }, { label: 'AWS' }],
    },
  ];

  it('includes question headers when there are multiple questions', () => {
    const result = formatQuestionAnswers(multipleQuestions, {
      type: 'question',
      requestId: 'req-1',
      answers: [
        { selectedLabels: ['React'] },
        { selectedLabels: ['PostgreSQL'] },
        { selectedLabels: ['Vercel'] },
      ],
      cancelled: false,
    });

    expect(result).toContain('**What framework?**');
    expect(result).toContain('React');
    expect(result).toContain('**What database?**');
    expect(result).toContain('PostgreSQL');
    expect(result).toContain('**What hosting?**');
    expect(result).toContain('Vercel');
  });

  it('formats each question + answer on separate lines', () => {
    const result = formatQuestionAnswers(multipleQuestions, {
      type: 'question',
      requestId: 'req-1',
      answers: [
        { selectedLabels: ['React'] },
        { selectedLabels: ['MongoDB'] },
        { selectedLabels: ['AWS'] },
      ],
      cancelled: false,
    });

    const lines = result.split('\n');
    // 3 questions × 2 lines each (header + answer) = 6 lines
    expect(lines).toHaveLength(6);
    expect(lines[0]).toBe('**What framework?**');
    expect(lines[1]).toBe('React');
    expect(lines[2]).toBe('**What database?**');
    expect(lines[3]).toBe('MongoDB');
  });

  it('handles mixed answers (some selected, some free text)', () => {
    const result = formatQuestionAnswers(multipleQuestions, {
      type: 'question',
      requestId: 'req-1',
      answers: [
        { selectedLabels: ['Vue'] },
        { freeText: 'SQLite for simplicity' },
        { selectedLabels: ['AWS'] },
      ],
      cancelled: false,
    });

    expect(result).toContain('Vue');
    expect(result).toContain('SQLite for simplicity');
    expect(result).toContain('AWS');
  });
});

describe('Question response formatting — multi-select', () => {
  const multiSelectQuestion: QuestionItem[] = [{
    question: 'Select your preferred tools',
    options: [
      { label: 'React' },
      { label: 'Vue' },
      { label: 'Svelte' },
      { label: 'Angular' },
    ],
    multiSelect: true,
  }];

  it('formats multiple selections as comma-separated list', () => {
    const result = formatQuestionAnswers(multiSelectQuestion, {
      type: 'question',
      requestId: 'req-1',
      answers: [{ selectedLabels: ['React', 'Svelte'] }],
      cancelled: false,
    });

    expect(result).toBe('React, Svelte');
  });

  it('formats single selection in multi-select as single label', () => {
    const result = formatQuestionAnswers(multiSelectQuestion, {
      type: 'question',
      requestId: 'req-1',
      answers: [{ selectedLabels: ['Vue'] }],
      cancelled: false,
    });

    expect(result).toBe('Vue');
  });

  it('formats all selections', () => {
    const result = formatQuestionAnswers(multiSelectQuestion, {
      type: 'question',
      requestId: 'req-1',
      answers: [{ selectedLabels: ['React', 'Vue', 'Svelte', 'Angular'] }],
      cancelled: false,
    });

    expect(result).toBe('React, Vue, Svelte, Angular');
  });
});

describe('Question response formatting — edge cases', () => {
  const singleQuestion: QuestionItem[] = [{
    question: 'Pick one',
    options: [{ label: 'A' }, { label: 'B' }],
  }];

  it('handles empty selectedLabels array', () => {
    const result = formatQuestionAnswers(singleQuestion, {
      type: 'question',
      requestId: 'req-1',
      answers: [{ selectedLabels: [] }],
      cancelled: false,
    });

    // Empty selection produces empty string
    expect(result).toBe('');
  });

  it('handles answer with no fields set', () => {
    const result = formatQuestionAnswers(singleQuestion, {
      type: 'question',
      requestId: 'req-1',
      answers: [{}],
      cancelled: false,
    });

    expect(result).toBe('');
  });

  it('prioritizes freeText over selectedLabels', () => {
    const result = formatQuestionAnswers(singleQuestion, {
      type: 'question',
      requestId: 'req-1',
      answers: [{ freeText: 'Custom answer', selectedLabels: ['A'] }],
      cancelled: false,
    });

    // freeText takes priority (checked first in the if/else chain)
    expect(result).toBe('Custom answer');
  });

  it('cancelled overrides all answers', () => {
    const result = formatQuestionAnswers(singleQuestion, {
      type: 'question',
      requestId: 'req-1',
      answers: [{ selectedLabels: ['A'] }],
      cancelled: true,
    });

    expect(result).toBe('[User skipped the question]');
  });
});

describe('QuestionResponse type contract', () => {
  it('has required type field set to "question"', () => {
    const response: QuestionResponse = {
      type: 'question',
      requestId: 'test-123',
      answers: [{ selectedLabels: ['Option A'] }],
      cancelled: false,
    };

    expect(response.type).toBe('question');
  });

  it('matches the shape expected by StructuredResponse union', () => {
    // This validates the contract between QuestionPanel and ChatDisplay
    const response: QuestionResponse = {
      type: 'question',
      requestId: 'test-456',
      answers: [
        { selectedLabels: ['React'] },
        { freeText: 'Custom tooling' },
      ],
      cancelled: false,
    };

    expect(response.type).toBe('question');
    expect(response.requestId).toBeTruthy();
    expect(response.answers).toHaveLength(2);
    expect(response.cancelled).toBe(false);
  });

  it('supports skipped shape', () => {
    const response: QuestionResponse = {
      type: 'question',
      requestId: 'test-789',
      answers: [{}, {}],
      cancelled: true,
    };

    expect(response.cancelled).toBe(true);
    expect(response.answers).toHaveLength(2);
  });
});

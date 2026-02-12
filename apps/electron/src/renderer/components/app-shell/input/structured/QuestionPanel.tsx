import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronRight, ChevronLeft, Pencil, Check, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { QuestionRequest, QuestionAnswer, QuestionResponse } from '../../../../../shared/types'

interface QuestionPanelProps {
  request: QuestionRequest
  onResponse: (response: QuestionResponse) => void
  /** When true, removes container styling (shadow, rounded) - used when wrapped by InputContainer */
  unstyled?: boolean
}

/**
 * QuestionPanel - Interactive multiple-choice panel for agent questions
 *
 * Shows when the agent calls ask_user_question. Features:
 * - Numbered options with labels + descriptions
 * - Question pagination (1 of N) for multiple questions
 * - Keyboard navigation (number keys, arrows, Enter, Esc)
 * - "Something else" free-text input
 * - Skip button (cancels all questions)
 * - Multi-select mode with checkboxes
 */
export function QuestionPanel({ request, onResponse, unstyled = false }: QuestionPanelProps) {
  const { questions, requestId } = request
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<QuestionAnswer[]>(() =>
    questions.map(() => ({ selectedLabels: [] }))
  )
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [showFreeText, setShowFreeText] = useState(false)
  const [freeTextValue, setFreeTextValue] = useState('')
  // Prevent double-advance from rapid clicks in single-select mode
  const isAdvancingRef = useRef(false)
  const freeTextRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Track direction for slide animation
  const [slideDirection, setSlideDirection] = useState<'forward' | 'back'>('forward')

  const currentQuestion = questions[currentIndex]
  const isMultiSelect = currentQuestion?.multiSelect ?? false
  const totalQuestions = questions.length
  const currentAnswer = answers[currentIndex]
  const selectedLabels = currentAnswer?.selectedLabels || []

  // Focus container for keyboard events
  useEffect(() => {
    if (!showFreeText) {
      containerRef.current?.focus()
    }
  }, [currentIndex, showFreeText])

  // Focus free text input when shown
  useEffect(() => {
    if (showFreeText) {
      freeTextRef.current?.focus()
    }
  }, [showFreeText])

  // Reset highlight and free text when question changes
  useEffect(() => {
    setHighlightedIndex(0)
    setShowFreeText(false)
    setFreeTextValue('')
    isAdvancingRef.current = false
  }, [currentIndex])

  const submitAllAnswers = useCallback((finalAnswers: QuestionAnswer[]) => {
    onResponse({
      type: 'question',
      requestId,
      answers: finalAnswers,
      cancelled: false,
    })
  }, [requestId, onResponse])

  const handleSkip = useCallback(() => {
    onResponse({
      type: 'question',
      requestId,
      answers: questions.map(() => ({})),
      cancelled: true,
    })
  }, [requestId, questions, onResponse])

  const advanceOrSubmit = useCallback((updatedAnswers: QuestionAnswer[]) => {
    if (currentIndex < totalQuestions - 1) {
      setSlideDirection('forward')
      setCurrentIndex(prev => prev + 1)
    } else {
      submitAllAnswers(updatedAnswers)
    }
  }, [currentIndex, totalQuestions, submitAllAnswers])

  const handleOptionSelect = useCallback((optionLabel: string) => {
    if (isMultiSelect) {
      // Toggle selection
      setAnswers(prev => {
        const updated = [...prev]
        const current = updated[currentIndex].selectedLabels || []
        if (current.includes(optionLabel)) {
          updated[currentIndex] = { selectedLabels: current.filter(l => l !== optionLabel) }
        } else {
          updated[currentIndex] = { selectedLabels: [...current, optionLabel] }
        }
        return updated
      })
    } else {
      // Single select - select and advance after brief visual feedback
      if (isAdvancingRef.current) return
      isAdvancingRef.current = true

      const updated = [...answers]
      updated[currentIndex] = { selectedLabels: [optionLabel] }
      setAnswers(updated)
      setTimeout(() => advanceOrSubmit(updated), 180)
    }
  }, [currentIndex, isMultiSelect, answers, advanceOrSubmit])

  const handleConfirmMultiSelect = useCallback(() => {
    advanceOrSubmit(answers)
  }, [answers, advanceOrSubmit])

  const handleFreeTextSubmit = useCallback(() => {
    if (!freeTextValue.trim()) return
    if (isAdvancingRef.current) return
    isAdvancingRef.current = true

    const updated = [...answers]
    updated[currentIndex] = { freeText: freeTextValue.trim() }
    setAnswers(updated)
    setTimeout(() => advanceOrSubmit(updated), 180)
  }, [freeTextValue, answers, currentIndex, advanceOrSubmit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // When free text is showing, only handle Escape (Enter is on the input itself)
    if (showFreeText) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowFreeText(false)
        containerRef.current?.focus()
      }
      return
    }

    const optionCount = currentQuestion.options.length + 1 // +1 for "Something else"

    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault()
        setHighlightedIndex(prev => (prev + 1) % optionCount)
        break
      case 'ArrowUp':
      case 'k':
        e.preventDefault()
        setHighlightedIndex(prev => (prev - 1 + optionCount) % optionCount)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex === currentQuestion.options.length) {
          // "Something else" is highlighted
          setShowFreeText(true)
        } else if (isMultiSelect && selectedLabels.length > 0) {
          // In multi-select with selections, Enter confirms
          handleConfirmMultiSelect()
        } else {
          handleOptionSelect(currentQuestion.options[highlightedIndex].label)
        }
        break
      case 'Escape':
        e.preventDefault()
        handleSkip()
        break
      case ' ':
        if (isMultiSelect && highlightedIndex < currentQuestion.options.length) {
          e.preventDefault()
          handleOptionSelect(currentQuestion.options[highlightedIndex].label)
        }
        break
      default: {
        // Number keys (1-9) for direct selection
        const num = parseInt(e.key)
        if (num >= 1 && num <= currentQuestion.options.length) {
          e.preventDefault()
          setHighlightedIndex(num - 1)
          handleOptionSelect(currentQuestion.options[num - 1].label)
        }
        break
      }
    }
  }, [showFreeText, currentQuestion, highlightedIndex, isMultiSelect, selectedLabels, handleOptionSelect, handleConfirmMultiSelect, handleSkip])

  const goToPrevQuestion = useCallback(() => {
    if (currentIndex > 0) {
      setSlideDirection('back')
      setCurrentIndex(prev => prev - 1)
    }
  }, [currentIndex])

  if (!currentQuestion) return null

  const optionCount = currentQuestion.options.length

  // Keyboard hint text
  const hintText = isMultiSelect
    ? 'Space to toggle, Enter to confirm, Esc to skip'
    : `Press 1\u2013${optionCount} to select, Esc to skip`

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        'overflow-hidden h-full flex flex-col bg-background outline-none',
        unstyled
          ? 'border-0'
          : 'border border-border rounded-[8px] shadow-middle'
      )}
    >
      {/* Header: Question text + pagination */}
      <div className="px-4 pt-4 pb-2 space-y-0.5">
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm font-medium text-foreground leading-snug flex-1">
            {currentQuestion.question}
          </span>
          {totalQuestions > 1 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 mt-0.5">
              <button
                onClick={goToPrevQuestion}
                disabled={currentIndex === 0}
                className="p-0.5 rounded hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                tabIndex={-1}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="tabular-nums">{currentIndex + 1} of {totalQuestions}</span>
              <div className="w-5" />
            </div>
          )}
        </div>
        {isMultiSelect && (
          <span className="text-[11px] text-muted-foreground">Select all that apply</span>
        )}
      </div>

      {/* Options list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: slideDirection === 'forward' ? 12 : -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: slideDirection === 'forward' ? -12 : 12 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-0.5"
          >
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedLabels.includes(option.label)
              const isHighlighted = highlightedIndex === index

              return (
                <button
                  key={option.label}
                  onClick={() => handleOptionSelect(option.label)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
                    isHighlighted && 'bg-foreground/[0.04]',
                    isSelected && !isMultiSelect && 'bg-primary/10',
                  )}
                >
                  {/* Checkbox (multi-select) or number badge (single-select) */}
                  {isMultiSelect ? (
                    <div className={cn(
                      'shrink-0 w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors',
                      isSelected
                        ? 'bg-primary border-primary'
                        : 'border-muted-foreground/40'
                    )}>
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
                    </div>
                  ) : (
                    <span className={cn(
                      'shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-medium transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-foreground/[0.07] text-muted-foreground'
                    )}>
                      {index + 1}
                    </span>
                  )}

                  {/* Label + description */}
                  <div className="flex-1 min-w-0">
                    <span className={cn(
                      'text-sm leading-snug',
                      isSelected ? 'text-foreground font-medium' : 'text-foreground'
                    )}>
                      {option.label}
                    </span>
                    {option.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                        {option.description}
                      </p>
                    )}
                  </div>

                  {/* Arrow indicator */}
                  <ChevronRight className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-opacity',
                    (isHighlighted || isSelected) ? 'opacity-50' : 'opacity-0'
                  )} />
                </button>
              )
            })}

            {/* "Something else" option */}
            {showFreeText ? (
              <div className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <Pencil className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    ref={freeTextRef}
                    type="text"
                    value={freeTextValue}
                    onChange={e => setFreeTextValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.stopPropagation()
                        handleFreeTextSubmit()
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        e.stopPropagation()
                        setShowFreeText(false)
                        containerRef.current?.focus()
                      }
                    }}
                    placeholder="Type your answer..."
                    className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-b border-foreground/20 focus:border-primary pb-1 transition-colors"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={handleFreeTextSubmit}
                    disabled={!freeTextValue.trim()}
                    tabIndex={-1}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowFreeText(true)}
                onMouseEnter={() => setHighlightedIndex(currentQuestion.options.length)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
                  highlightedIndex === currentQuestion.options.length && 'bg-foreground/[0.04]',
                )}
              >
                <Pencil className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">Something else</span>
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer: Actions + keyboard hint */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">
        {isMultiSelect && selectedLabels.length > 0 && (
          <Button
            size="sm"
            variant="default"
            className="h-7 gap-1.5"
            onClick={handleConfirmMultiSelect}
          >
            <Check className="h-3.5 w-3.5" />
            Confirm ({selectedLabels.length})
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={handleSkip}
        >
          <SkipForward className="h-3.5 w-3.5" />
          Skip
        </Button>

        <div className="flex-1" />

        <span className="text-[10px] text-muted-foreground">
          {hintText}
        </span>
      </div>
    </div>
  )
}

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Check, CreditCard, Key, Cpu } from "lucide-react"
import { StepFormLayout, BackButton, ContinueButton } from "./primitives"

export type ApiSetupMethod = 'api_key' | 'claude_oauth' | 'chatgpt_oauth' | 'openai_api_key'

interface ApiSetupOption {
  id: ApiSetupMethod
  name: string
  description: string
  icon: React.ReactNode
  providerGroup: 'anthropic' | 'openai'
}

const API_SETUP_OPTIONS: ApiSetupOption[] = [
  {
    id: 'claude_oauth',
    name: 'Claude Pro/Max',
    description: 'Use your Claude subscription for unlimited access.',
    icon: <CreditCard className="size-4" />,
    providerGroup: 'anthropic',
  },
  {
    id: 'api_key',
    name: 'Anthropic API Key',
    description: 'Pay-as-you-go via Anthropic, OpenRouter, Ollama, or compatible APIs.',
    icon: <Key className="size-4" />,
    providerGroup: 'anthropic',
  },
  {
    id: 'chatgpt_oauth',
    name: 'Codex · ChatGPT Plus/Pro',
    description: 'Use your ChatGPT Plus or Pro subscription with Codex.',
    icon: <Cpu className="size-4" />,
    providerGroup: 'openai',
  },
  {
    id: 'openai_api_key',
    name: 'Codex · OpenAI API Key',
    description: 'Pay-as-you-go via the OpenAI Platform API.',
    icon: <Key className="size-4" />,
    providerGroup: 'openai',
  },
]

type ProviderTab = 'anthropic' | 'openai'

interface APISetupStepProps {
  selectedMethod: ApiSetupMethod | null
  onSelect: (method: ApiSetupMethod) => void
  onContinue: () => void
  onBack: () => void
}

/**
 * APISetupStep - Choose how to connect your AI agents
 *
 * Two tabs: Claude (Anthropic) and Codex (OpenAI).
 * Each tab shows the relevant connection options.
 */
export function APISetupStep({
  selectedMethod,
  onSelect,
  onContinue,
  onBack,
}: APISetupStepProps) {
  // Default tab to the provider of the currently selected method
  const defaultTab = selectedMethod
    ? (API_SETUP_OPTIONS.find(o => o.id === selectedMethod)?.providerGroup ?? 'anthropic')
    : 'anthropic'
  const [activeTab, setActiveTab] = useState<ProviderTab>(defaultTab)

  const visibleOptions = API_SETUP_OPTIONS.filter(o => o.providerGroup === activeTab)

  return (
    <StepFormLayout
      title="Set Up API Connection"
      description="Select how you'd like to power your AI agents."
      actions={
        <>
          <BackButton onClick={onBack} />
          <ContinueButton onClick={onContinue} disabled={!selectedMethod} />
        </>
      }
    >
      {/* Provider tabs */}
      <div className="flex rounded-xl bg-foreground/[0.03] p-1 mb-4">
        {(['anthropic', 'openai'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all",
              activeTab === tab
                ? "bg-background shadow-minimal text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === 'anthropic' ? 'Claude' : 'Codex'}
          </button>
        ))}
      </div>

      {/* Options */}
      <div className="space-y-3">
        {visibleOptions.map((option) => {
          const isSelected = option.id === selectedMethod
          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className={cn(
                "flex w-full items-start gap-4 rounded-xl p-4 text-left transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "hover:bg-foreground/[0.02] shadow-minimal",
                isSelected ? "bg-background" : "bg-foreground-2"
              )}
            >
              <div className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg",
                isSelected ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"
              )}>
                {option.icon}
              </div>

              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm">{option.name}</span>
                <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
              </div>

              <div className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                isSelected
                  ? "border-foreground bg-foreground text-background"
                  : "border-muted-foreground/20"
              )}>
                {isSelected && <Check className="size-3" strokeWidth={3} />}
              </div>
            </button>
          )
        })}
      </div>
    </StepFormLayout>
  )
}

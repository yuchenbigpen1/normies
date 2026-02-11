/**
 * NavigationButtons
 *
 * Shared back/forward navigation pill for page headers.
 * Extracted from ChatPage so any page can reuse the same control.
 */

import * as React from 'react'
import { useAtom } from 'jotai'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { TopBarButton } from '@/components/ui/TopBarButton'
import { PanelLeftRounded } from '@/components/icons/PanelLeftRounded'
import { useNavigation } from '@/contexts/NavigationContext'
import { planReturnRouteAtom } from '@/atoms/sessions'

export interface NavigationButtonsProps {
  /** Show the sidebar toggle button before the nav pill */
  showSidebarToggle?: boolean
  /** Callback when the sidebar toggle is clicked */
  onToggleSidebar?: () => void
}

export const NavigationButtons = React.memo(function NavigationButtons({
  showSidebarToggle,
  onToggleSidebar,
}: NavigationButtonsProps) {
  const { navigate, canGoBack, canGoForward, goBack, goForward } = useNavigation()
  const [planReturnRoute, setPlanReturnRoute] = useAtom(planReturnRouteAtom)

  return (
    <div className="flex items-center gap-1">
      {showSidebarToggle && onToggleSidebar && (
        <TopBarButton aria-label="Toggle sidebar" onClick={onToggleSidebar} className="h-9 w-9">
          <PanelLeftRounded className="h-5 w-5 text-foreground/80" />
        </TopBarButton>
      )}
      <div className="inline-flex items-center glass-btn rounded-full titlebar-no-drag h-[34px] overflow-hidden">
        <button
          type="button"
          onClick={() => {
            if (planReturnRoute) {
              const route = planReturnRoute
              setPlanReturnRoute(null)
              navigate(route as Parameters<typeof navigate>[0])
            } else {
              goBack()
            }
          }}
          disabled={!canGoBack && !planReturnRoute}
          aria-label="Go back"
          className="inline-flex items-center justify-center h-full w-[38px] text-foreground/60 hover:bg-black/[0.04] active:bg-black/[0.07] transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>
        <div className="w-px h-[18px] bg-foreground/10 shrink-0" />
        <button
          type="button"
          onClick={goForward}
          disabled={!canGoForward}
          aria-label="Go forward"
          className="inline-flex items-center justify-center h-full w-[38px] text-foreground/60 hover:bg-black/[0.04] active:bg-black/[0.07] transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronRight className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
})

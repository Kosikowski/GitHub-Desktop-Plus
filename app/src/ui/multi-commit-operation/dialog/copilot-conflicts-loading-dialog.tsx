import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../../dialog'
import { DialogHeader } from '../../dialog/header'
import { Dispatcher } from '../../dispatcher'
import { Repository } from '../../../models/repository'
import { MultiCommitOperationStepKind } from '../../../models/multi-commit-operation'
import { MultiCommitOperationConflictState } from '../../../lib/app-state'
import { IConflictResolutionProgress } from '../../../lib/copilot-conflict-resolution'
import { Button } from '../../lib/button'
import { Octicon } from '../../octicons'
import * as octicons from '../../octicons/octicons.generated'
import { MultiCommitOperationKind } from '../../../models/multi-commit-operation'

interface ICopilotConflictsLoadingDialogProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly conflictState: MultiCommitOperationConflictState
  readonly conflictedFilePaths: ReadonlyArray<string>
  readonly progress: IConflictResolutionProgress | null
  readonly operationKind: MultiCommitOperationKind
  readonly onAbort: () => void
  readonly onDismissed: () => void
}

interface ICopilotConflictsLoadingDialogState {
  /**
   * Internal seconds counter used to enforce per-message dwell time.
   * Not displayed to the user — the rotating message is enough signal.
   */
  readonly elapsedSeconds: number
  /**
   * The growing chat-style log of messages shown so far. Latest is at
   * the end of the array (rendered at the bottom of the visible log).
   * Capped to bound DOM size; older messages scroll out of view
   * naturally before being trimmed off the front.
   */
  readonly displayedMessages: ReadonlyArray<string>
  /**
   * High-priority messages from the SDK (model reasoning sentences and
   * phase transitions). Always drained before fauxPending.
   */
  readonly realPending: ReadonlyArray<string>
  /**
   * Prebuilt fallback messages used to fill space when no real messages
   * are available. Drained only when realPending is empty.
   */
  readonly fauxPending: ReadonlyArray<string>
  /** Elapsed time when the most recent message was shown (for dwell). */
  readonly messageShownAt: number
  /**
   * Seconds the current message should stay visible. Randomized per
   * message so rotations don't feel mechanically timed.
   */
  readonly currentDwell: number
}

/** Maximum number of historical messages to keep in the visible log. */
const MaxDisplayedMessages = 4

/** Minimum seconds a message stays visible. */
const MinDwellSeconds = 3
/** Maximum seconds a message stays visible. */
const MaxDwellSeconds = 5

/** Pick a random dwell duration in [MinDwellSeconds, MaxDwellSeconds]. */
function randomDwell(): number {
  return (
    MinDwellSeconds +
    Math.floor(Math.random() * (MaxDwellSeconds - MinDwellSeconds + 1))
  )
}

/**
 * Build the background message queue from actual file data.
 * These rotate at a steady pace; reasoning snippets and phase
 * changes append to this queue so the user has time to read each.
 */
function buildMessageQueue(
  filePaths: ReadonlyArray<string>
): ReadonlyArray<string> {
  const fileNames = filePaths.map(p => p.split('/').pop() ?? p)
  const messages: string[] = ['Gathering context…']

  for (const name of fileNames.slice(0, 6)) {
    messages.push(`Analyzing ${name}…`)
  }
  if (fileNames.length > 6) {
    messages.push(`…and ${fileNames.length - 6} more`)
  }

  messages.push('Generating resolution…')
  return messages
}

/**
 * Filter out reasoning snippets that aren't worth surfacing — markdown
 * structural noise (headers, bullet points, bold-only labels) and
 * fragments that don't read as complete thoughts. Returns the cleaned
 * snippet, or null if it should be skipped.
 */
function cleanReasoningSnippet(snippet: string): string | null {
  const trimmed = snippet.trim()
  if (trimmed.length === 0) {
    return null
  }
  // Markdown headers
  if (/^#+\s/.test(trimmed)) {
    return null
  }
  // Bullet list items
  if (/^[-*]\s/.test(trimmed)) {
    return null
  }
  // Pure list-marker remnants like "1." or "2."
  if (/^\d+\.?$/.test(trimmed)) {
    return null
  }
  // Bold-only label with nothing meaningful after it
  if (/^\*\*[^*]+\*\*[:.]?\s*$/.test(trimmed)) {
    return null
  }
  // Numbered list items get a more lenient length check so we don't
  // drop "1. Foo" while keeping "2. Foo bar baz" — losing one item in
  // an enumerated sequence reads as a glitch.
  const isNumberedItem = /^\d+\.\s/.test(trimmed)
  const minLength = isNumberedItem ? 8 : 25
  if (trimmed.length < minLength) {
    return null
  }
  // Strip surrounding markdown emphasis from the displayed text
  return trimmed.replace(/\*\*/g, '').replace(/`/g, '')
}

/**
 * A loading interstitial shown while Copilot is resolving conflicts.
 *
 * Maintains a single FIFO queue of messages. Each message stays
 * visible for a randomized 3–5 seconds so rotations don't feel
 * mechanically timed. Reasoning snippets streamed from the model
 * and SDK phase transitions both append to a high-priority queue
 * that drains before the prebuilt faux messages.
 */
export class CopilotConflictsLoadingDialog extends React.Component<
  ICopilotConflictsLoadingDialogProps,
  ICopilotConflictsLoadingDialogState
> {
  private timer: ReturnType<typeof setInterval> | null = null
  private logRef = React.createRef<HTMLDivElement>()

  public constructor(props: ICopilotConflictsLoadingDialogProps) {
    super(props)
    const initial = buildMessageQueue(props.conflictedFilePaths)
    this.state = {
      elapsedSeconds: 0,
      displayedMessages: [initial[0]],
      realPending: [],
      fauxPending: initial.slice(1),
      messageShownAt: 0,
      currentDwell: randomDwell(),
    }
  }

  public componentDidMount() {
    this.timer = setInterval(this.tick, 1000)
  }

  public componentWillUnmount() {
    if (this.timer !== null) {
      clearInterval(this.timer)
    }
  }

  public componentDidUpdate(prevProps: ICopilotConflictsLoadingDialogProps) {
    const prevSnippet = prevProps.progress?.reasoningSnippet
    const currentSnippet = this.props.progress?.reasoningSnippet

    if (currentSnippet !== undefined && currentSnippet !== prevSnippet) {
      const cleaned = cleanReasoningSnippet(currentSnippet)
      if (cleaned !== null) {
        this.setState(prev => ({
          realPending: [...prev.realPending, cleaned],
        }))
      }
    }

    this.trimOverflowingMessages()
  }

  /**
   * If the rendered log content is taller than its container, drop the
   * oldest message(s) until it fits. This keeps the latest message
   * fully visible without having to anchor to the bottom.
   */
  private trimOverflowingMessages() {
    const log = this.logRef.current
    if (log === null) {
      return
    }

    if (log.scrollHeight <= log.clientHeight) {
      return
    }

    this.setState(prev => {
      if (prev.displayedMessages.length <= 1) {
        return null
      }
      return { displayedMessages: prev.displayedMessages.slice(1) }
    })
  }

  private tick = () => {
    this.setState(prev => {
      const nextElapsed = prev.elapsedSeconds + 1
      const dwelt = nextElapsed - prev.messageShownAt

      if (dwelt < prev.currentDwell) {
        return { ...prev, elapsedSeconds: nextElapsed }
      }

      const appendMessage = (
        next: string,
        realPending: ReadonlyArray<string>,
        fauxPending: ReadonlyArray<string>
      ) => {
        const merged = [...prev.displayedMessages, next]
        const displayedMessages =
          merged.length > MaxDisplayedMessages
            ? merged.slice(merged.length - MaxDisplayedMessages)
            : merged
        return {
          elapsedSeconds: nextElapsed,
          displayedMessages,
          realPending,
          fauxPending,
          messageShownAt: nextElapsed,
          currentDwell: randomDwell(),
        }
      }

      // Always drain real (SDK) messages first; fall back to faux only
      // when there's nothing real to show.
      if (prev.realPending.length > 0) {
        const [next, ...rest] = prev.realPending
        return appendMessage(next, rest, prev.fauxPending)
      }

      if (prev.fauxPending.length > 0) {
        const [next, ...rest] = prev.fauxPending
        return appendMessage(next, prev.realPending, rest)
      }

      return { ...prev, elapsedSeconds: nextElapsed }
    })
  }

  private onCancel = () => {
    const { dispatcher, repository, conflictState } = this.props

    dispatcher.setMultiCommitOperationStepWithCopilotResolution(
      repository,
      {
        kind: MultiCommitOperationStepKind.ShowConflicts,
        conflictState,
      },
      false
    )
  }

  public render() {
    const { displayedMessages } = this.state
    const { operationKind } = this.props

    return (
      <Dialog
        id="copilot-conflicts-loading"
        onDismissed={this.props.onDismissed}
      >
        <DialogHeader
          title={`Resolving conflicts for ${operationKind.toLowerCase()}`}
          showCloseButton={true}
          onCloseButtonClick={this.props.onDismissed}
        >
          <span className="copilot-conflicts-loading-model">
            GPT-5 mini · Medium
          </span>
        </DialogHeader>
        <DialogContent>
          <div className="copilot-conflicts-loading-content">
            <div
              ref={this.logRef}
              className={
                displayedMessages.length >= MaxDisplayedMessages
                  ? 'copilot-conflicts-loading-log is-scrolling'
                  : 'copilot-conflicts-loading-log'
              }
            >
              <Octicon
                className="copilot-conflicts-loading-log-icon"
                symbol={octicons.copilot}
              />
              <div className="copilot-conflicts-loading-log-messages">
                {displayedMessages.map((msg, i) => (
                  <p
                    key={`${i}-${msg}`}
                    className="copilot-conflicts-loading-log-line"
                  >
                    {msg}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <div className="copilot-conflicts-loading-footer">
            <Button onClick={this.onCancel}>Switch to manual</Button>
            <Button onClick={this.props.onAbort}>
              Abort {operationKind.toLowerCase()}
            </Button>
          </div>
        </DialogFooter>
      </Dialog>
    )
  }
}

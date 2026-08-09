interface StatusLineProps {
  date: string
  totalR: string       // e.g. "+0.82R"
  tradeCount: number
  habitsDone: number   // e.g. 4
  habitsTotal: number  // e.g. 6
  savedAt: string | null  // "22:41" or null
  showPublishHint: boolean // true when a writing surface has content
}

export function StatusLine(props: StatusLineProps) {
  return (
    <div className="border-t border-line px-3 py-1.5 text-[12px] text-faint tabular-nums">
      <span>{props.date}</span>
      <span className="mx-2">·</span>
      <span className={props.totalR.startsWith('+') ? 'text-up' : props.totalR.startsWith('-') ? 'text-down' : ''}>{props.totalR}</span>
      <span className="mx-2">·</span>
      <span>{props.tradeCount}t</span>
      <span className="mx-2">·</span>
      <span>habits {props.habitsDone}/{props.habitsTotal}</span>
      {props.showPublishHint && <><span className="mx-2">·</span><span>⌘⏎ publish</span></>}
      {props.savedAt && <><span className="mx-2">·</span><span>saved {props.savedAt}</span></>}
    </div>
  )
}

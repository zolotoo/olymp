'use client'
import { useState } from 'react'

export default function ExpandableText({
  text,
  limit,
  className,
  style,
}: {
  text: string
  limit: number
  className?: string
  style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const needsToggle = text.length > limit
  const shown = open || !needsToggle ? text : text.slice(0, limit) + '…'
  return (
    <div
      className={className}
      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: needsToggle ? 'pointer' : 'default', ...style }}
      onClick={() => needsToggle && setOpen((v) => !v)}
      title={needsToggle ? (open ? 'Свернуть' : 'Показать целиком') : undefined}
    >
      {shown}
    </div>
  )
}

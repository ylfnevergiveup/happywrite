import { useState, useRef, useEffect, useCallback } from 'react'

interface UseSplitDividerOptions {
  minLeft?: number
  minRight?: number
  defaultRatio?: number
}

export function useSplitDivider({
  minLeft = 300,
  minRight = 220,
  defaultRatio = 0.6,
}: UseSplitDividerOptions = {}) {
  const [leftWidth, setLeftWidth] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const totalWidth = rect.width
      const dividerWidth = 6
      const available = totalWidth - dividerWidth
      let left = e.clientX - rect.left
      left = Math.max(minLeft, Math.min(left, available - minRight))
      setLeftWidth(left)
    }

    const handleMouseUp = () => setIsDragging(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, minLeft, minRight])

  const handleDoubleClick = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const totalWidth = container.getBoundingClientRect().width
    setLeftWidth(totalWidth * defaultRatio)
  }, [defaultRatio])

  // Initialize leftWidth when right panel is shown
  const initWidth = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const totalWidth = container.getBoundingClientRect().width
    setLeftWidth((prev) => prev ?? totalWidth * defaultRatio)
  }, [defaultRatio])

  // Re-clamp leftWidth on window resize to prevent right panel overflow
  useEffect(() => {
    const handleResize = () => {
      setLeftWidth((prev) => {
        if (prev === null) return null
        const container = containerRef.current
        if (!container) return prev
        const totalWidth = container.getBoundingClientRect().width
        const dividerWidth = 6
        const maxLeft = totalWidth - dividerWidth - minRight
        return Math.min(prev, Math.max(minLeft, maxLeft))
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [minLeft, minRight])

  return {
    leftWidth,
    isDragging,
    containerRef,
    initWidth,
    dividerProps: {
      onMouseDown: handleMouseDown,
      onDoubleClick: handleDoubleClick,
    },
  }
}

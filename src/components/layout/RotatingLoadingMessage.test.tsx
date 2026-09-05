import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RotatingLoadingMessage, LOADING_MESSAGES } from './RotatingLoadingMessage'

describe('RotatingLoadingMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a message on initial mount', () => {
    render(<RotatingLoadingMessage />)
    const paragraph = screen.getByText((content) => LOADING_MESSAGES.includes(content))
    expect(paragraph).toBeInTheDocument()
  })

  it('rotates message after random interval between 3 and 8 seconds', () => {
    const testMessages = ['Message A', 'Message B', 'Message C']
    render(<RotatingLoadingMessage messages={testMessages} />)

    const initialText = screen.getByText(/Message [A-C]/).textContent
    expect(testMessages).toContain(initialText)

    // Advance timers by 8 seconds to ensure next message triggers
    act(() => {
      vi.advanceTimersByTime(8000)
    })

    const secondText = screen.getByText(/Message [A-C]/).textContent
    expect(testMessages).toContain(secondText)
  })

  it('does not repeat messages until all messages in pool have been shown', () => {
    const testMessages = ['Msg 1', 'Msg 2', 'Msg 3']
    render(<RotatingLoadingMessage messages={testMessages} />)

    const shownMessages: string[] = []

    for (let i = 0; i < 3; i++) {
      const currentText = screen.getByText(/Msg [1-3]/).textContent!
      shownMessages.push(currentText)

      if (i < 2) {
        act(() => {
          vi.advanceTimersByTime(8000)
        })
      }
    }

    // All 3 unique messages should have been shown in 3 iterations
    expect(new Set(shownMessages).size).toBe(3)
  })
})

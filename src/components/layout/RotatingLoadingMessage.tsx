'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import en from '@/lib/i18n/locales/en/common.json'

export const LOADING_MESSAGES: string[] = en.loadingMessages

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function RotatingLoadingMessage({ messages: suppliedMessages }: { messages?: string[] }) {
  const { t } = useTranslation();
  const messages = React.useMemo(() => suppliedMessages || t('loadingMessages', { returnObjects: true }) as string[], [suppliedMessages, t]);
  const [currentMessage, setCurrentMessage] = React.useState<string>('')

  React.useEffect(() => {
    if (!Array.isArray(messages) || messages.length === 0) return;
    let remainingIndices = messages.map((_, idx) => idx)
    let timerId: NodeJS.Timeout | null = null

    const showNextMessage = () => {
      if (remainingIndices.length === 0) {
        remainingIndices = messages.map((_, idx) => idx)
      }

      const randomIndexInRemaining = getRandomInt(0, remainingIndices.length - 1)
      const selectedMessageIndex = remainingIndices[randomIndexInRemaining]

      remainingIndices.splice(randomIndexInRemaining, 1)

      setCurrentMessage(messages[selectedMessageIndex])

      const durationSeconds = getRandomInt(3, 8)
      timerId = setTimeout(showNextMessage, durationSeconds * 1000)
    }

    showNextMessage()

    return () => {
      if (timerId) {
        clearTimeout(timerId)
      }
    }
  }, [messages])

  return (
    <p className="text-gray-600 dark:text-gray-400 font-medium">
      {currentMessage}
    </p>
  )
}

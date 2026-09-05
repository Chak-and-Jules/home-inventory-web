'use client'

import React from 'react'

export const LOADING_MESSAGES: string[] = [
  'Preparing the bills',
  'Checking the fridge',
  'Emptying the garbage',
  'Taking out the trash',
  'Checking the pantry',
  'Counting the leftovers',
  'Inspecting the laundry basket',
  'Looking under the couch',
  'Finding the missing socks',
  'Checking the junk drawer',
  'Restocking the essentials',
  'Updating the shopping list',
  'Checking expiration dates',
  'Locating the spare batteries',
  'Searching for the TV remote',
  'Asking “who moved this?”',
  'Taping the cables together',
  'Untangling the cables',
  'Applying security patches',
  'Restarting the router',
  'Rebooting the toaster',
  'Checking network connectivity',
  'Pinging the smart fridge',
  'Scanning for loose screws',
  'Running household diagnostics',
  'Compiling the shopping list',
  'Indexing the junk drawer',
  'Garbage collection in progress',
  'Defragmenting the pantry',
  'Optimizing shelf space',
  'Migrating leftovers to containers',
  'Syncing with the laundry basket',
  'Backing up important receipts',
  'Restoring from the junk drawer',
  'Resolving dependency conflicts',
  'Updating household dependencies',
  'Checking for critical vulnerabilities',
  'Installing missing batteries',
  'Rotating the secret snacks',
  'Refreshing the coffee supply',
  'Verifying the “I’ll fix it later” queue',
  'Running sudo make_house_clean',
  'Executing emergency fridge maintenance',
  'Deploying fresh toilet paper',
  'Scaling up the cleaning operation',
  'Negotiating with the dust bunnies',
  'Killing orphaned processes (and spiders)',
  'Checking whether the Wi-Fi is actually plugged in',
  'Performing highly sophisticated inventory magic',
  'Asking the house where it put everything',
]

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function RotatingLoadingMessage({ messages = LOADING_MESSAGES }: { messages?: string[] }) {
  const [currentMessage, setCurrentMessage] = React.useState<string>('')

  React.useEffect(() => {
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

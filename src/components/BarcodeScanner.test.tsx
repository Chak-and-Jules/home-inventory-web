import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BarcodeScanner } from './BarcodeScanner'

// Mock BarcodeDetector
class MockBarcodeDetector {
  detect = vi.fn().mockResolvedValue([])
}

describe('BarcodeScanner', () => {
  beforeEach(() => {
    vi.stubGlobal('BarcodeDetector', MockBarcodeDetector)
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }]
        })
      }
    })
  })

  it('renders "Scan Barcode" title', () => {
    render(<BarcodeScanner onScan={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/Scan Barcode/i)).toBeInTheDocument()
  })

  it('shows "Start Camera" button when supported', () => {
    render(<BarcodeScanner onScan={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Start Camera/i })).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<BarcodeScanner onScan={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /Close scanner/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows error message when BarcodeDetector is not supported', () => {
    vi.stubGlobal('BarcodeDetector', undefined)
    // Delete from window explicitly as stubGlobal might not be enough for 'in' check
    delete (window as Partial<Window>).BarcodeDetector

    render(<BarcodeScanner onScan={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/Barcode Detection API is not supported/i)).toBeInTheDocument()
  })
})

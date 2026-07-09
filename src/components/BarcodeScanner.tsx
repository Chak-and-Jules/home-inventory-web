'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Camera, RefreshCw } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

declare global {
  interface Window {
    BarcodeDetector: unknown
  }
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isSupported] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return 'BarcodeDetector' in window
    }
    return false
  })
  const [error, setError] = useState<string | null>(() =>
    !isSupported ? 'Barcode Detection API is not supported in this browser.' : null
  )
  const [isScanning, setIsScanning] = useState(false)
  const scanningRef = useRef(false)

  const startCamera = async () => {
    setError(null)
    setIsScanning(true)
    scanningRef.current = true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      detectBarcodes()
    } catch (err) {
      console.error('Error accessing camera:', err)
      setError('Could not access camera. Please ensure you have granted permission.')
      setIsScanning(false)
      scanningRef.current = false
    }
  }

  const stopCamera = () => {
    scanningRef.current = false
    setIsScanning(false)
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
  }

  const detectBarcodes = async () => {
    if (!scanningRef.current || !videoRef.current || !('BarcodeDetector' in window)) return

    const BarcodeDetectorClass = (window as unknown as { BarcodeDetector: new (config: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
    const barcodeDetector = new BarcodeDetectorClass({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
    })

    const scan = async () => {
      if (!scanningRef.current || !videoRef.current) return

      try {
        const barcodes = await barcodeDetector.detect(videoRef.current)
        if (barcodes.length > 0) {
          const barcode = barcodes[0].rawValue
          onScan(barcode)
          stopCamera()
          return
        }
      } catch (err) {
        console.error('Barcode detection error:', err)
      }

      requestAnimationFrame(scan)
    }

    requestAnimationFrame(scan)
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 p-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Camera className="h-5 w-5 text-indigo-400" />
            Scan Barcode
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              stopCamera()
              onClose()
            }}
            className="text-gray-400 hover:text-white hover:bg-gray-800"
            aria-label="Close scanner"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative aspect-square overflow-hidden bg-black flex items-center justify-center">
          {isScanning ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 text-gray-400 p-8 text-center">
              <Camera className="h-12 w-12 opacity-20" />
              <p>Ready to scan. Align the barcode within the frame.</p>
              {isSupported && (
                <Button onClick={startCamera} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  Start Camera
                </Button>
              )}
            </div>
          )}

          {isScanning && (
            <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-indigo-400/50 m-12 rounded-lg flex items-center justify-center">
              <div className="h-0.5 w-full bg-red-500/50 absolute top-1/2 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
            </div>
          )}

          {error && (
            <div className="absolute inset-x-0 bottom-0 bg-red-900/90 p-4 text-center text-sm text-red-100 backdrop-blur-sm">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-900 border-t border-gray-800 flex justify-center gap-4">
          {!isSupported && (
             <p className="text-xs text-gray-500 text-center">
               Your browser does not support the native Barcode Detection API.
               Try using a modern browser like Chrome or Safari on mobile.
             </p>
          )}
          {isScanning && (
            <Button
              variant="outline"
              size="sm"
              onClick={stopCamera}
              className="text-gray-400 border-gray-700 hover:bg-gray-800"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset Camera
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

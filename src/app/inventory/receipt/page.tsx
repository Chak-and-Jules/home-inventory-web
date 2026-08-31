'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAuth } from '@/components/AuthProvider'
import { useHome } from '@/components/HomeProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  FileText,
  Upload,
  Loader2,
  CheckCircle2,
  Trash2,
  PlusCircle,
  Receipt,
  AlertCircle
} from 'lucide-react'
import type { ItemDefinition, SizeUnit, Category, ReceiptLineItem, ReceiptScanResponse, ReceiptJobStatusResponse } from '@/types'

// Simple fuzzy matching function to find best matching ItemDefinition
function findBestMatch(name: string, itemDefs: ItemDefinition[]): string | null {
  if (!name || !itemDefs || itemDefs.length === 0) return null
  const cleanName = name.toLowerCase().trim()

  // Exact match
  const exactMatch = itemDefs.find(def => def.Name.toLowerCase().trim() === cleanName)
  if (exactMatch) return exactMatch.ID

  // Word inclusion match
  const inclusionMatch = itemDefs.find(def => {
    const defName = def.Name.toLowerCase().trim()
    return cleanName.includes(defName) || defName.includes(cleanName)
  })
  if (inclusionMatch) return inclusionMatch.ID

  return null
}

export default function ReceiptIntakePage() {
  const { session } = useAuth()
  const { currentHomeId } = useHome()
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>('')
  const [lineItems, setLineItems] = useState<ReceiptLineItem[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null)

  // New definition modal state
  const [newDefModalOpen, setNewDefModalOpen] = useState(false)
  const [targetItemForDef, setTargetItemForDef] = useState<ReceiptLineItem | null>(null)
  const [newDefName, setNewDefName] = useState('')
  const [newDefCategoryId, setNewDefCategoryId] = useState('')
  const [newDefSizeUnitId, setNewDefSizeUnitId] = useState('')
  const [newDefIsExpirable, setNewDefIsExpirable] = useState(false)

  // Fetch Item Definitions
  const { data: itemDefs = [] } = useQuery({
    queryKey: ['itemDefs', currentHomeId],
    queryFn: async () => {
      const res = await api.get<ItemDefinition[]>('/item-definitions', {
        headers: { 'X-Home-Id': currentHomeId },
      })
      return res.data
    },
    enabled: !!session && !!currentHomeId,
  })

  // Fetch Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', currentHomeId],
    queryFn: async () => {
      const res = await api.get<Category[]>('/categories', {
        headers: { 'X-Home-Id': currentHomeId },
      })
      return res.data
    },
    enabled: !!session && !!currentHomeId,
  })

  // Fetch Size Units
  const { data: sizeUnits = [] } = useQuery({
    queryKey: ['sizeUnits'],
    queryFn: async () => {
      const res = await api.get<SizeUnit[]>('/size-units')
      return res.data
    },
    enabled: !!session,
  })

  // Mutation to create a new Item Definition
  const createItemDefMutation = useMutation({
    mutationFn: async (payload: { name: string; category_id?: string; size_unit_id: string; is_expirable: boolean }) => {
      const res = await api.post<ItemDefinition>('/item-definitions', payload, {
        headers: { 'X-Home-Id': currentHomeId },
      })
      return res.data
    },
    onSuccess: (newDef) => {
      queryClient.invalidateQueries({ queryKey: ['itemDefs', currentHomeId] })
      if (targetItemForDef) {
        setLineItems(prev =>
          prev.map(item =>
            item.id === targetItemForDef.id
              ? { ...item, matched_item_definition_id: newDef.ID }
              : item
          )
        )
      }
      setNewDefModalOpen(false)
      setTargetItemForDef(null)
    },
  })

  // Bulk import mutation
  const bulkImportMutation = useMutation({
    mutationFn: async (itemsToImport: ReceiptLineItem[]) => {
      const results = []
      for (const item of itemsToImport) {
        if (!item.matched_item_definition_id) continue
        const res = await api.post(
          '/inventory',
          {
            item_definition_id: item.matched_item_definition_id,
            quantity: item.quantity,
          },
          { headers: { 'X-Home-Id': currentHomeId } }
        )
        results.push(res.data)
      }
      return results
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setImportSuccessCount(variables.length)
      setLineItems([])
      setSelectedFile(null)
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setErrorMessage(null)
      setImportSuccessCount(null)
    }
  }

  const handleUploadAndScan = async () => {
    if (!selectedFile || !currentHomeId) return

    setIsProcessing(true)
    setErrorMessage(null)
    setProcessingStatus(t('receipt.processing'))

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      let scannedItems: ReceiptLineItem[] = []

      const scanRes = await api.post<ReceiptScanResponse & { line_items?: ReceiptLineItem[] }>('/receipts/scan', formData, {
        headers: {
          'X-Home-Id': currentHomeId,
        },
      })

      if (scanRes.data.line_items && scanRes.data.line_items.length > 0) {
        scannedItems = scanRes.data.line_items
      } else if (scanRes.data.job_id) {
        // Poll for job completion if backend returns async job
        let attempts = 0
        while (attempts < 10) {
          await new Promise(res => setTimeout(res, 1000))
          attempts++
          const jobRes = await api.get<ReceiptJobStatusResponse>(`/receipts/jobs/${scanRes.data.job_id}`, {
            headers: { 'X-Home-Id': currentHomeId },
          })
          if (jobRes.data.status === 'completed') {
            scannedItems = jobRes.data.line_items || []
            break
          } else if (jobRes.data.status === 'failed') {
            throw new Error(jobRes.data.error || t('receipt.uploadFailed'))
          }
        }
      }

      // Perform fuzzy matching against item definitions
      const matchedItems = scannedItems.map(item => ({
        ...item,
        matched_item_definition_id: item.matched_item_definition_id || findBestMatch(item.name, itemDefs),
      }))

      setLineItems(matchedItems)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('receipt.uploadFailed')
      setErrorMessage(message)
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }

  const handleItemChange = (id: string, field: keyof ReceiptLineItem, value: unknown) => {
    setLineItems(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  const handleRemoveItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id))
  }

  const handleOpenNewDefModal = (item: ReceiptLineItem) => {
    setTargetItemForDef(item)
    setNewDefName(item.name)
    setNewDefCategoryId('')
    setNewDefSizeUnitId(sizeUnits[0]?.ID || '')
    setNewDefIsExpirable(false)
    setNewDefModalOpen(true)
  }

  const handleCreateNewDefSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDefName || !newDefSizeUnitId) return
    createItemDefMutation.mutate({
      name: newDefName,
      category_id: newDefCategoryId || undefined,
      size_unit_id: newDefSizeUnitId,
      is_expirable: newDefIsExpirable,
    })
  }

  const validItemsToImport = useMemo(() => {
    return lineItems.filter(item => !!item.matched_item_definition_id && item.quantity > 0)
  }, [lineItems])

  const handleBulkImport = () => {
    if (validItemsToImport.length === 0) return
    bulkImportMutation.mutate(validItemsToImport)
  }

  if (!currentHomeId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-gray-500 mb-4">No home selected. You need a home to scan receipts.</div>
        <Button asChild>
          <Link href="/homes">Manage Homes</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild aria-label="Go back to inventory" className="p-2 -ml-2 text-gray-500">
          <Link href="/inventory/new">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-indigo-500" />
            {t('receipt.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('receipt.description')}
          </p>
        </div>
      </div>

      {importSuccessCount !== null && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            <div>
              <h2 className="text-lg font-semibold text-green-900 dark:text-green-200">
                {t('receipt.successMessage', { count: importSuccessCount })}
              </h2>
            </div>
            <div className="flex gap-4">
              <Button onClick={() => setImportSuccessCount(null)} variant="outline">
                {t('receipt.scanAnother')}
              </Button>
              <Button asChild>
                <Link href="/">{t('layout.dashboard')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && (
        <div className="p-4 rounded-md bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Upload Box */}
      {lineItems.length === 0 && importSuccessCount === null && (
        <Card>
          <CardHeader>
            <CardTitle>{t('receipt.uploadTitle')}</CardTitle>
            <CardDescription>{t('receipt.uploadDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center hover:border-indigo-500 transition-colors">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4 flex text-sm justify-center text-gray-600 dark:text-gray-400">
                <label htmlFor="receipt-upload" className="relative cursor-pointer rounded-md font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 hover:text-indigo-500">
                  <span>{t('receipt.selectFile')}</span>
                  <input
                    id="receipt-upload"
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
              {selectedFile && (
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 font-medium flex items-center justify-center gap-1">
                  <FileText className="h-4 w-4 text-indigo-500" />
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleUploadAndScan}
                disabled={!selectedFile || isProcessing}
              >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isProcessing ? processingStatus : t('barcode.scan')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extracted Line Items Review */}
      {lineItems.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('receipt.extractedItems')}</CardTitle>
              <CardDescription>{t('receipt.reviewDesc')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setLineItems([])}>
              {t('receipt.scanAnother')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('receipt.itemName')}</TableHead>
                    <TableHead className="w-24">{t('receipt.quantity')}</TableHead>
                    <TableHead className="w-24">{t('receipt.price')}</TableHead>
                    <TableHead>{t('receipt.matchedDefinition')}</TableHead>
                    <TableHead className="text-right">{t('receipt.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input
                          value={item.name}
                          onChange={e => handleItemChange(item.id, 'name', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={e =>
                            handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price ?? ''}
                          onChange={e =>
                            handleItemChange(
                              item.id,
                              'price',
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 items-center">
                          <Select
                            value={item.matched_item_definition_id || ''}
                            onChange={e =>
                              handleItemChange(item.id, 'matched_item_definition_id', e.target.value || null)
                            }
                          >
                            <option value="">-- {t('receipt.unmatched')} --</option>
                            {itemDefs.map(def => (
                              <option key={def.ID} value={def.ID}>
                                {def.Name}
                              </option>
                            ))}
                          </Select>
                          {!item.matched_item_definition_id && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                              onClick={() => handleOpenNewDefModal(item)}
                              title={t('receipt.createNewDefinition', { name: item.name })}
                            >
                              <PlusCircle className="h-5 w-5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-500 hover:text-red-700"
                          aria-label={t('receipt.removeItem')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-800">
              <span className="text-sm text-gray-500">
                {validItemsToImport.length} / {lineItems.length} items ready to import
              </span>
              <Button
                onClick={handleBulkImport}
                disabled={validItemsToImport.length === 0 || bulkImportMutation.isPending}
              >
                {bulkImportMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {bulkImportMutation.isPending
                  ? t('receipt.importing')
                  : t('receipt.bulkImport', { count: validItemsToImport.length })}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal to create new Item Definition */}
      <Dialog open={newDefModalOpen} onOpenChange={setNewDefModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('receipt.createNewDefinition', { name: targetItemForDef?.name || '' })}</DialogTitle>
            <DialogDescription>
              Create an Item Definition so this item can be imported into inventory.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateNewDefSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="def-name">{t('categories.name')}</Label>
              <Input
                id="def-name"
                value={newDefName}
                onChange={e => setNewDefName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="def-category">{t('categories.parent')}</Label>
              <Select
                id="def-category"
                value={newDefCategoryId}
                onChange={e => setNewDefCategoryId(e.target.value)}
              >
                <option value="">{t('categories.none')}</option>
                {categories.map(cat => (
                  <option key={cat.ID} value={cat.ID}>
                    {cat.Name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="def-size-unit">Size Unit *</Label>
              <Select
                id="def-size-unit"
                value={newDefSizeUnitId}
                onChange={e => setNewDefSizeUnitId(e.target.value)}
                required
              >
                {sizeUnits.map(unit => (
                  <option key={unit.ID} value={unit.ID}>
                    {unit.Name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="def-expirable"
                checked={newDefIsExpirable}
                onChange={e => setNewDefIsExpirable(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <Label htmlFor="def-expirable" className="cursor-pointer">
                Is Expirable
              </Label>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setNewDefModalOpen(false)}>
                {t('categories.cancel')}
              </Button>
              <Button type="submit" disabled={createItemDefMutation.isPending || !newDefName}>
                {createItemDefMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('categories.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

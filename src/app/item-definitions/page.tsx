'use client';

import { useTranslation } from 'react-i18next';
import { getCategoryOptions } from '@/lib/categoryOptions';

import { useSignedUrls } from '@/hooks/useSignedUrls';
import { useAuth } from '@/components/AuthProvider';
import { useHome } from '@/components/HomeProvider';
import { api } from '@/lib/api';
import { resizeImage } from '@/lib/imageUtils';
import { uploadImageToSupabase } from '@/lib/supabase-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, Suspense, useMemo, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, Plus, Trash2, Image as ImageIcon, X, Edit, Save, Search } from 'lucide-react';
import type { Category, SizeUnit, ItemDefinition, ItemDefinitionRequest } from '@/types';
import { ImagePreview } from '@/components/ImagePreview';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';

function ItemDefinitionsContent() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const { currentHomeId } = useHome();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Redirect if search params suggest a creation intent
  useEffect(() => {
    if (searchParams.has('barcode') || searchParams.has('name')) {
      router.replace(`/item-definitions/new?${searchParams.toString()}`);
    }
  }, [searchParams, router]);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Edit State
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editSizeUnitId, setEditSizeUnitId] = useState('');
  const [editIsExpirable, setEditIsExpirable] = useState(false);
  const [editLowStockThreshold, setEditLowStockThreshold] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editSelectedImage, setEditSelectedImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string>('');
  const editIsUploadingImage = false;
  const [editOriginalImageUrl, setEditOriginalImageUrl] = useState<string | null>(null);

  // Image Popup State
  const [selectedMobileDef, setSelectedMobileDef] = useState<ItemDefinition | null>(null);

  const {
    data: itemDefs,
    isPending: defsPending,
    isError: defsError,
  } = useQuery({
    queryKey: ['itemDefs', currentHomeId],
    queryFn: async () => {
      const res = await api.get<ItemDefinition[]>('/item-definitions', {
        headers: { 'X-Home-Id': currentHomeId },
      });
      return res.data;
    },
    enabled: !!session && !!currentHomeId,
  });

  // Memoize image paths
  const imagePaths = useMemo(() => {
    if (!itemDefs) return [];
    const paths = [];
    for (let i = 0; i < itemDefs.length; i++) {
      paths.push(itemDefs[i].ImageURL);
    }
    return paths;
  }, [itemDefs]);
  const { data: signedUrls } = useSignedUrls(imagePaths);

  const { data: categories } = useQuery({
    queryKey: ['categories', currentHomeId],
    queryFn: async () => {
      const res = await api.get<Category[]>('/categories', {
        headers: { 'X-Home-Id': currentHomeId },
      });
      return res.data;
    },
    enabled: !!session && !!currentHomeId,
  });

  const { data: sizeUnits } = useQuery({
    queryKey: ['sizeUnits'],
    queryFn: async () => {
      const res = await api.get<SizeUnit[]>('/size-units');
      return res.data;
    },
    enabled: !!session && !!currentHomeId,
  });

  const categoryOptions = useMemo(() => {
    return getCategoryOptions(categories, i18n.language).map((c) => (
      <option key={c.id} value={c.id}>
        {c.label}
      </option>
    ));
  }, [categories, i18n.language]);

  const sizeUnitOptions = useMemo(() => {
    return sizeUnits?.map((u) => (
      <option key={u.ID} value={u.ID}>
        {u.Name}
      </option>
    ));
  }, [sizeUnits]);

  const updateMutation = useMutation({
    mutationFn: async (data: ItemDefinitionRequest & { id: string }) => {
      let imageUrl = data.image_url || '';
      if (editSelectedImage && currentHomeId) {
        const resized = await resizeImage(editSelectedImage);
        imageUrl = await uploadImageToSupabase(resized, editSelectedImage.name, currentHomeId);
      }
      return api.put(
        `/item-definitions/${data.id}`,
        {
          ...data,
          image_url: imageUrl,
        },
        { headers: { 'X-Home-Id': currentHomeId } },
      );
    },
    onSuccess: () => {
      setEditingId(null);
      for (const key of [
        'itemDefs',
        'inventory',
        'expiring-inventory',
        'almost-finished',
        'restock-insights',
      ])
        queryClient.invalidateQueries({ queryKey: [key, currentHomeId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/item-definitions/${id}`, {
        headers: { 'X-Home-Id': currentHomeId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itemDefs'] });
    },
  });

  const { requestDelete, deleteConfirmation } = useDeleteConfirmation(deleteMutation.mutate);

  const startEdit = (def: ItemDefinition) => {
    setEditingId(def.ID);
    setEditName(def.Name);
    setEditDescription(def.Description || '');
    setEditCategoryId(def.CategoryID || '');
    setEditSizeUnitId(def.SizeUnitID || '');
    setEditIsExpirable(def.IsExpirable);
    setEditLowStockThreshold(def.low_stock_threshold?.toString() || '');
    setEditBarcode(def.barcode || '');
    setEditSelectedImage(null);
    setEditImagePreview('');
    setEditOriginalImageUrl(def.ImageURL || null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditSelectedImage(null);
    setEditImagePreview('');
    setEditOriginalImageUrl(null);
  };

  const handleSave = (id: string) => {
    if (!editName.trim() || !editSizeUnitId) return;
    updateMutation.mutate({
      id,
      name: editName,
      description: editDescription,
      category_id: editCategoryId,
      size_unit_id: editSizeUnitId,
      is_expirable: editIsExpirable,
      barcode: editBarcode || undefined,
      low_stock_threshold: editLowStockThreshold ? Number(editLowStockThreshold) : null,
      image_url: editOriginalImageUrl || undefined,
    });
  };

  const handleEditImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert(t('ui.pleaseSelectAValidImageFile'));
        return;
      }

      setEditSelectedImage(file);
      setEditOriginalImageUrl(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        setEditImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearEditImage = () => {
    setEditSelectedImage(null);
    setEditImagePreview('');
    setEditOriginalImageUrl(null);
    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
  };

  const filteredItemDefs = useMemo(() => {
    if (!itemDefs) return [];
    if (!debouncedSearchQuery.trim()) return itemDefs;
    const query = debouncedSearchQuery.toLowerCase();
    return itemDefs.filter((def) => {
      // ⚡ Bolt Optimization: Use short-circuit evaluation to skip expensive string operations
      // once a match is found. This significantly reduces redundant .toLowerCase().includes() calls.
      return (
        def.Name?.toLowerCase().includes(query) ||
        def.Description?.toLowerCase().includes(query) ||
        def.Category?.Name?.toLowerCase().includes(query) ||
        def.barcode?.toLowerCase().includes(query) ||
        def.SizeUnit?.Name?.toLowerCase().includes(query)
      );
    });
  }, [itemDefs, debouncedSearchQuery]);

  return (
    <div className="space-y-6">
      {deleteConfirmation}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {t('ui.itemDefinitions')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {t('ui.defineTheTypesOfItemsYouWantToTrackInYourInventory')}
          </p>
        </div>
        <Button asChild>
          <Link href="/item-definitions/new">
            <Plus className="h-4 w-4 mr-2" />
            {t('ui.addDefinition')}
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder={t('ui.searchItemDefinitions')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="text-gray-500 hover:text-gray-700"
            aria-label={t('ui.clearSearch')}
          >
            {t('ui.clear')}
          </Button>
        )}
      </div>

      {defsError && (
        <p role="alert" className="text-red-600">
          {t('ui.loadFailed')}
        </p>
      )}
      {updateMutation.isError && (
        <p role="alert" className="text-red-600">
          {t('ui.updateFailed')}
        </p>
      )}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px] hidden sm:table-cell">{t('ui.image')}</TableHead>
                <TableHead>{t('ui.name')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('ui.category')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('ui.unit')}</TableHead>
                <TableHead className="text-right">{t('ui.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {defsPending && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-gray-500 dark:text-gray-400"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 rounded-full animate-pulse bg-indigo-200 dark:bg-indigo-900/40"></div>
                      <div className="w-4 h-4 rounded-full animate-pulse bg-indigo-300 dark:bg-indigo-900/60"></div>
                      <div className="w-4 h-4 rounded-full animate-pulse bg-indigo-400 dark:bg-indigo-900/80"></div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!defsPending && itemDefs?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    <Package className="mx-auto mb-3 h-8 w-8 text-gray-400 dark:text-gray-500" />
                    {t('ui.noItemDefinitionsFound')}
                  </TableCell>
                </TableRow>
              )}
              {!defsPending && itemDefs && itemDefs.length > 0 && filteredItemDefs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    {t('ui.noMatchingItemDefinitionsFound')}
                  </TableCell>
                </TableRow>
              )}
              {filteredItemDefs?.map((def) => (
                <TableRow
                  key={def.ID}
                  aria-busy={updateMutation.isPending && updateMutation.variables?.id === def.ID}
                  onClick={() => {
                    if (window.innerWidth < 640 && editingId !== def.ID) {
                      setSelectedMobileDef(def);
                    }
                  }}
                  className={[
                    editingId === def.ID
                      ? 'grid grid-cols-1 sm:table-row'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 sm:cursor-default cursor-pointer',
                    'transition-opacity',
                    updateMutation.isPending && updateMutation.variables?.id === def.ID
                      ? 'opacity-50'
                      : '',
                  ].join(' ')}
                >
                  <TableCell
                    className={
                      editingId === def.ID ? 'block sm:table-cell' : 'hidden sm:table-cell'
                    }
                  >
                    {editingId === def.ID ? (
                      <div className="relative flex items-center gap-2">
                        <input
                          ref={editFileInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleEditImageSelect}
                          className="hidden"
                          disabled={editIsUploadingImage || updateMutation.isPending}
                        />
                        {(editImagePreview || editOriginalImageUrl) && (
                          <ImagePreview
                            src={
                              editImagePreview ||
                              signedUrls?.[editOriginalImageUrl!] ||
                              editOriginalImageUrl!
                            }
                            name={def.Name}
                          />
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={t('ui.changeItemImage')}
                          disabled={updateMutation.isPending}
                          onClick={() => editFileInputRef.current?.click()}
                        >
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                        {(editSelectedImage || editOriginalImageUrl) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearEditImage();
                            }}
                            disabled={editIsUploadingImage || updateMutation.isPending}
                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700 shadow-sm border border-red-200 p-0"
                            aria-label={t('ui.clearEditImage')}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ) : def.ImageURL ? (
                      <ImagePreview
                        src={signedUrls?.[def.ImageURL] || def.ImageURL}
                        name={def.Name}
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                        <ImageIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === def.ID ? (
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder={t('ui.name')}
                          className="h-8"
                          aria-label={t('ui.name')}
                        />
                        <Input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder={t('ui.description')}
                          className="h-8 text-xs"
                          aria-label={t('ui.description')}
                        />

                        <div className="space-y-1 col-span-2">
                          <Label htmlFor={`editBarcode-${def.ID}`} className="text-xs">
                            {t('ui.barcode')}
                          </Label>
                          <Input
                            id={`editBarcode-${def.ID}`}
                            type="text"
                            placeholder={t('ui.barcode')}
                            value={editBarcode}
                            onChange={(e) => setEditBarcode(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label htmlFor={`editLowStockThreshold-${def.ID}`} className="text-xs">
                            {t('ui.lowStockThreshold')}
                          </Label>
                          <Input
                            id={`editLowStockThreshold-${def.ID}`}
                            type="number"
                            min="0"
                            step="any"
                            placeholder={t('ui.threshold')}
                            value={editLowStockThreshold}
                            onChange={(e) => setEditLowStockThreshold(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <Label className="flex items-center gap-2 cursor-pointer font-normal text-xs text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={editIsExpirable}
                            onChange={(e) => setEditIsExpirable(e.target.checked)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 h-3 w-3"
                          />
                          {t('ui.expirable')}
                        </Label>
                      </div>
                    ) : (
                      <>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {def.Name}
                        </div>
                        {def.Description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px] hidden sm:block">
                            {def.Description}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400 ring-1 ring-inset ring-indigo-700/10 dark:ring-indigo-400/20 sm:hidden">
                            {def.Category?.Name || t('ui.noCategory')}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-gray-50 dark:bg-gray-800/50 px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-400 ring-1 ring-inset ring-gray-700/10 sm:hidden">
                            {def.SizeUnit?.Name || t('ui.noUnit')}
                          </span>
                          {def.barcode && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400 ring-1 ring-inset ring-gray-500/10">
                              {def.barcode}
                            </span>
                          )}
                          {def.IsExpirable && (
                            <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-700/10 dark:ring-blue-400/20">
                              {t('ui.expirable')}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </TableCell>
                  <TableCell
                    className={
                      editingId === def.ID ? 'block sm:table-cell' : 'hidden sm:table-cell'
                    }
                  >
                    {editingId === def.ID ? (
                      <Select
                        value={editCategoryId}
                        onChange={(e) => setEditCategoryId(e.target.value)}
                        className="h-8 text-xs"
                        aria-label={t('ui.category')}
                      >
                        <option value="">{t('ui.none')}</option>
                        {categoryOptions}
                      </Select>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">
                        {def.Category?.Name || '-'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className={
                      editingId === def.ID ? 'block sm:table-cell' : 'hidden sm:table-cell'
                    }
                  >
                    {editingId === def.ID ? (
                      <Select
                        value={editSizeUnitId}
                        onChange={(e) => setEditSizeUnitId(e.target.value)}
                        className="h-8 text-xs"
                        aria-label={t('ui.sizeUnit')}
                      >
                        <option value="">{t('ui.selectUnit')}</option>
                        {sizeUnitOptions}
                      </Select>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">
                        {def.SizeUnit?.Name || '-'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {editingId === def.ID ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSave(def.ID)}
                          disabled={updateMutation.isPending || !editName.trim() || !editSizeUnitId}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 mr-1"
                        >
                          <Save className="h-4 w-4 mr-1" />
                          {t('ui.save')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelEdit}
                          className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                        >
                          <X className="h-4 w-4 mr-1" />
                          {t('ui.cancel')}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            startEdit(def);
                          }}
                          aria-label={t('ui.editDefinition', { name: def.Name })}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 mr-1"
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">{t('ui.edit')}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deleteMutation.isPending && deleteMutation.variables === def.ID}
                          onClick={(event) => {
                            event.stopPropagation();
                            requestDelete(def.ID, t('ui.deleteThisItemDefinition'));
                          }}
                          aria-label={t('ui.deleteDefinition', { name: def.Name })}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 -mr-2"
                        >
                          {deleteMutation.isPending && deleteMutation.variables === def.ID ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">{t('ui.delete')}</span>
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile Bottom Sheet Drawer for Item Definitions */}
      {selectedMobileDef && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:hidden">
          <div className="fixed inset-0" onClick={() => setSelectedMobileDef(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-t-2xl p-6 shadow-xl animate-in slide-in-from-bottom duration-300">
            {/* Grabber */}
            <div className="mx-auto w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mb-4" />
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {selectedMobileDef.Name}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedMobileDef(null)}
                aria-label={t('ui.closeDetails')}
              >
                <X className="h-5 w-5 text-gray-500" />
              </Button>
            </div>

            <div className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto">
              {selectedMobileDef.ImageURL && (
                <ImagePreview
                  src={signedUrls?.[selectedMobileDef.ImageURL] || selectedMobileDef.ImageURL}
                  name={selectedMobileDef.Name}
                  className="w-full h-48"
                />
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                    {t('ui.category')}
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {selectedMobileDef.Category?.Name || '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                    {t('ui.sizeUnit')}
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {selectedMobileDef.SizeUnit?.Name || '—'}
                  </span>
                </div>
                {selectedMobileDef.barcode && (
                  <div>
                    <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                      {t('ui.barcode')}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium font-mono">
                      {selectedMobileDef.barcode}
                    </span>
                  </div>
                )}
                <div>
                  <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                    {t('ui.expirable')}
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {selectedMobileDef.IsExpirable ? t('ui.yes') : t('ui.no')}
                  </span>
                </div>
                {selectedMobileDef.low_stock_threshold !== undefined &&
                  selectedMobileDef.low_stock_threshold !== null && (
                    <div>
                      <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                        {t('ui.lowStockThreshold')}
                      </span>
                      <span className="text-gray-900 dark:text-gray-100 font-medium">
                        {selectedMobileDef.low_stock_threshold}
                      </span>
                    </div>
                  )}
                {selectedMobileDef.Description && (
                  <div className="col-span-2">
                    <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                      {t('ui.description')}
                    </span>
                    <p className="text-gray-700 dark:text-gray-300 mt-1">
                      {selectedMobileDef.Description}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  startEdit(selectedMobileDef);
                  setSelectedMobileDef(null);
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                {t('ui.edit')}
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                disabled={
                  deleteMutation.isPending && deleteMutation.variables === selectedMobileDef.ID
                }
                onClick={() => {
                  requestDelete(selectedMobileDef.ID, t('ui.deleteThisItemDefinition'));
                  setSelectedMobileDef(null);
                }}
                aria-label={t('ui.deleteItemNamed', { name: selectedMobileDef.Name })}
              >
                {deleteMutation.isPending && deleteMutation.variables === selectedMobileDef.ID ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('ui.delete')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ItemDefinitions() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<div className="p-8">{t('ui.loading')}</div>}>
      <ItemDefinitionsContent />
    </Suspense>
  );
}

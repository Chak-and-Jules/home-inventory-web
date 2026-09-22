'use client';

import { useTranslation } from 'react-i18next';
import { getCategoryOptions } from '@/lib/categoryOptions';

import { useAuth } from '@/components/AuthProvider';
import { useHome } from '@/components/HomeProvider';
import { api } from '@/lib/api';
import { resizeImage } from '@/lib/imageUtils';
import { uploadImageToSupabase } from '@/lib/supabase-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, X, Scan, PackagePlus } from 'lucide-react';
import type { Category, SizeUnit, ItemDefinitionRequest } from '@/types';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { FormPendingOverlay } from '@/components/FormPendingOverlay';

function NewItemDefinitionContent() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const { currentHomeId } = useHome();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(() => searchParams.get('name') || '');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(() => searchParams.get('category') || '');
  const [sizeUnitId, setSizeUnitId] = useState('');
  const [isExpirable, setIsExpirable] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [barcode, setBarcode] = useState(() => searchParams.get('barcode') || '');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(() => searchParams.get('image_url') || '');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

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

  const createMutation = useMutation({
    mutationFn: async (data: ItemDefinitionRequest) => {
      let imageUrl = data.image_url || '';
      if (selectedImage) {
        if (!currentHomeId) {
          throw new Error(t('ui.homeIDIsRequiredPleaseEnsureYouHaveSelectedAHome'));
        }
        setIsUploadingImage(true);
        try {
          const resizedBlob = await resizeImage(selectedImage);
          imageUrl = await uploadImageToSupabase(resizedBlob, selectedImage.name, currentHomeId);
        } finally {
          setIsUploadingImage(false);
        }
      }
      return api.post(
        '/item-definitions',
        {
          ...data,
          image_url: imageUrl || undefined,
        },
        { headers: { 'X-Home-Id': currentHomeId } },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itemDefs'] });
      router.push('/item-definitions');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      description,
      category_id: categoryId || undefined,
      size_unit_id: sizeUnitId,
      is_expirable: isExpirable,
      barcode: barcode || undefined,
      low_stock_threshold: lowStockThreshold ? Number(lowStockThreshold) : undefined,
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert(t('ui.pleaseSelectAValidImageFile'));
        return;
      }

      setSelectedImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setImagePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!currentHomeId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-gray-500 mb-4">
          {t('ui.noHomeFoundYouNeedAHomeToAddItemDefinitions')}
        </div>
        <Button asChild>
          <Link href="/homes">{t('ui.manageHomes')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          asChild
          aria-label={t('ui.goBackToItemDefinitions')}
          className="p-2 -ml-2 text-gray-500"
        >
          <Link href="/item-definitions">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">{t('ui.back')}</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <PackagePlus className="h-6 w-6 text-indigo-500" />
            {t('ui.createNewDefinition')}
          </h1>
        </div>
      </div>

      <Card className="relative" aria-busy={createMutation.isPending || isUploadingImage}>
        <FormPendingOverlay pending={createMutation.isPending || isUploadingImage} />
        <CardHeader>
          <CardTitle>{t('ui.createNewDefinition')}</CardTitle>
          <CardDescription>{t('ui.addANewBlueprintForItemsInYourHome')}</CardDescription>
        </CardHeader>
        <CardContent>
          {createMutation.isError && (
            <p role="alert" className="text-red-600">
              {t('ui.updateFailed')}
            </p>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('ui.nameRequired')}</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('ui.egMilkBatteries')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sizeUnit">{t('ui.sizeUnitRequired')}</Label>
              <Select
                id="sizeUnit"
                value={sizeUnitId}
                onChange={(e) => setSizeUnitId(e.target.value)}
                required
              >
                <option value="">{t('ui.selectUnit')}</option>
                {sizeUnitOptions}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">{t('ui.categoryOptional')}</Label>
              <Select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">{t('ui.none')}</option>
                {categoryOptions}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">{t('ui.barcodeOptional')}</Label>
              <div className="flex gap-2">
                <Input
                  id="barcode"
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder={t('ui.scanOrEnterBarcode')}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsScannerOpen(true)}
                  aria-label={t('ui.scanBarcodeLabel')}
                >
                  <Scan className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">{t('ui.imageOptional')}</Label>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    ref={fileInputRef}
                    id="image"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageSelect}
                    disabled={isUploadingImage || createMutation.isPending}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('ui.pNGJPGOrWebPMax5MBWillBeResizedTo400x400px')}
                  </p>
                </div>
                {selectedImage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearImage}
                    disabled={isUploadingImage}
                    className="text-gray-500 dark:text-gray-400 hover:text-red-600 -mb-0"
                    aria-label={t('ui.clearSelectedImage')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {imagePreview && (
                <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md border border-gray-200 dark:border-gray-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt={t('ui.preview')}
                    className="max-h-32 rounded object-cover"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {t('ui.previewWillBeResizedBeforeUpload')}
                  </p>
                </div>
              )}
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="desc">{t('ui.description')}</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('ui.addSomeDetailsAboutThisItem')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lowStockThreshold">{t('ui.lowStockThreshold')}</Label>
              <Input
                id="lowStockThreshold"
                type="number"
                min="0"
                step="any"
                placeholder={t('ui.0')}
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-between mt-2 pt-4 border-t border-gray-100 dark:border-gray-700">
              <Label className="flex items-center gap-2 cursor-pointer font-normal text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={isExpirable}
                  onChange={(e) => setIsExpirable(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4"
                />
                {t('ui.hasExpirationDate')}
              </Label>
              <div className="flex gap-3">
                <Button type="button" variant="outline" asChild>
                  <Link href="/item-definitions">{t('ui.cancel')}</Link>
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || isUploadingImage || !name.trim() || !sizeUnitId
                  }
                >
                  {isUploadingImage
                    ? t('ui.uploadingImage')
                    : createMutation.isPending
                      ? t('ui.creating')
                      : t('ui.createDefinition')}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {isScannerOpen && (
        <BarcodeScanner
          onScan={(barcode) => {
            setBarcode(barcode);
            setIsScannerOpen(false);
          }}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </div>
  );
}

export default function NewItemDefinition() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      }
    >
      <NewItemDefinitionContent />
    </Suspense>
  );
}

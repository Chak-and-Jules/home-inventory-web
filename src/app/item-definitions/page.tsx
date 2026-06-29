'use client';
import { useSignedUrls } from '@/hooks/useSignedUrls';

import { useAuth } from '@/components/AuthProvider';
import { useHome } from '@/components/HomeProvider';
import { api } from '@/lib/api';

import { resizeImage } from '@/lib/imageUtils';
import { uploadImageToSupabase } from '@/lib/supabase-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, Suspense, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Package,
  Plus,
  Trash2,
  Image as ImageIcon,
  X,
  Edit,
  Save,
} from 'lucide-react';
import type { Category, SizeUnit, ItemDefinition } from '@/types';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

function ItemDefinitionsContent() {
  const { session } = useAuth();
  const { currentHomeId } = useHome();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sizeUnitId, setSizeUnitId] = useState('');
  const [isExpirable, setIsExpirable] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Edit State
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editSizeUnitId, setEditSizeUnitId] = useState('');
  const [editIsExpirable, setEditIsExpirable] = useState(false);
  const [editLowStockThreshold, setEditLowStockThreshold] = useState('');
  const [editSelectedImage, setEditSelectedImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string>('');
  const [editIsUploadingImage, setEditIsUploadingImage] = useState(false);
  const [editOriginalImageUrl, setEditOriginalImageUrl] = useState<
    string | null
  >(null);

  // Image Popup State
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const { data: itemDefs, isPending: defsPending } = useQuery({
    queryKey: ['itemDefs', currentHomeId],
    queryFn: async () => {
      const res = await api.get<ItemDefinition[]>('/item-definitions', {
        headers: { 'X-Home-Id': currentHomeId },
      });
      return res.data;
    },
    enabled: !!session && !!currentHomeId,
  });

  // Memoize image paths to prevent recreating the array on every render and triggering the custom hook unnecessarily
  const imagePaths = useMemo(
    () => itemDefs?.map((d) => d.ImageURL) || [],
    [itemDefs],
  );
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

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      category_id?: string;
      size_unit_id: string;
      is_expirable: boolean;
      image_url?: string;
      low_stock_threshold?: number;
    }) => {
      let imageUrl = '';
      if (selectedImage) {
        if (!currentHomeId) {
          throw new Error(
            'Home ID is required. Please ensure you have selected a home.',
          );
        }
        setIsUploadingImage(true);
        try {
          const resizedBlob = await resizeImage(selectedImage);
          imageUrl = await uploadImageToSupabase(
            resizedBlob,
            selectedImage.name,
            currentHomeId,
          );
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
      setName('');
      setDescription('');
      setCategoryId('');
      setSizeUnitId('');
      setIsExpirable(false);
      setLowStockThreshold('');
      setSelectedImage(null);
      setImagePreview('');
      queryClient.invalidateQueries({ queryKey: ['itemDefs'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      name: string;
      description?: string;
      category_id?: string;
      size_unit_id: string;
      is_expirable: boolean;
      image_url?: string;
      low_stock_threshold?: number | null;
    }) => {
      let imageUrl = data.image_url;
      if (editSelectedImage) {
        if (!currentHomeId) throw new Error('Home ID required.');
        setEditIsUploadingImage(true);
        try {
          const resizedBlob = await resizeImage(editSelectedImage);
          imageUrl = await uploadImageToSupabase(
            resizedBlob,
            editSelectedImage.name,
            currentHomeId,
          );
        } finally {
          setEditIsUploadingImage(false);
        }
      }
      return api.put(
        `/item-definitions/${data.id}`,
        {
          name: data.name,
          description: data.description,
          category_id: data.category_id || undefined,
          size_unit_id: data.size_unit_id,
          is_expirable: data.is_expirable,
          image_url: imageUrl || undefined,
        },
        { headers: { 'X-Home-Id': currentHomeId } },
      );
    },
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['itemDefs'] });
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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      description,
      category_id: categoryId || undefined,
      size_unit_id: sizeUnitId,
      is_expirable: isExpirable,
      low_stock_threshold: lowStockThreshold
        ? Number(lowStockThreshold)
        : undefined,
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
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

  const startEdit = (def: ItemDefinition) => {
    setEditingId(def.ID);
    setEditName(def.Name);
    setEditDescription(def.Description || '');
    setEditCategoryId(def.CategoryID || '');
    setEditSizeUnitId(def.SizeUnitID || '');
    setEditIsExpirable(def.IsExpirable);
    setEditLowStockThreshold(def.LowStockThreshold?.toString() || '');
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
      low_stock_threshold: editLowStockThreshold
        ? Number(editLowStockThreshold)
        : null,
      image_url: editOriginalImageUrl || undefined,
    });
  };

  const handleEditImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }

      setEditSelectedImage(file);
      setEditOriginalImageUrl(null); // clear original URL since a new file is chosen

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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Item Definitions
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Define the types of items you want to track in your inventory.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Create New Definition</CardTitle>
          <CardDescription>
            Add a new blueprint for items in your home.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleCreate}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Milk, Batteries"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sizeUnit">Size Unit *</Label>
              <Select
                id="sizeUnit"
                value={sizeUnitId}
                onChange={(e) => setSizeUnitId(e.target.value)}
                required
              >
                <option value="">Select Unit</option>
                {sizeUnits?.map((u) => (
                  <option key={u.ID} value={u.ID}>
                    {u.Name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category (Optional)</Label>
              <Select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">None</option>
                {categories?.map((c) => (
                  <option key={c.ID} value={c.ID}>
                    {c.Name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">Image (Optional)</Label>
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
                    PNG, JPG, or WebP. Max 5MB. Will be resized to 400x400px.
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
                    aria-label="Clear selected image"
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
                    alt="Preview"
                    className="max-h-32 rounded object-cover"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Preview (will be resized before upload)
                  </p>
                </div>
              )}
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add some details about this item..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
              <Input
                id="lowStockThreshold"
                type="number"
                min="0"
                step="any"
                placeholder="0"
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
                Has Expiration Date
              </Label>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  isUploadingImage ||
                  !name.trim() ||
                  !sizeUnitId
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                {isUploadingImage
                  ? "Uploading Image..."
                  : createMutation.isPending
                    ? "Creating..."
                    : "Create Definition"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                    No item definitions found.
                  </TableCell>
                </TableRow>
              )}
              {itemDefs?.map((def) => (
                <TableRow
                  key={def.ID}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <TableCell>
                    {editingId === def.ID ? (
                      <div className="relative h-10 w-10 group">
                        <input
                          ref={editFileInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleEditImageSelect}
                          className="hidden"
                          disabled={
                            editIsUploadingImage || updateMutation.isPending
                          }
                        />
                        <button
                          type="button"
                          aria-label="Change item image"
                          className={`relative h-10 w-10 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${editIsUploadingImage ? "opacity-50" : "hover:opacity-80"}`}
                          onClick={() => editFileInputRef.current?.click()}
                        >
                          {editImagePreview ? (
                            <img
                              src={editImagePreview}
                              alt="Preview"
                              className="object-cover w-full h-full"
                            />
                          ) : editOriginalImageUrl &&
                            signedUrls?.[editOriginalImageUrl] ? (
                            <img
                              src={signedUrls[editOriginalImageUrl]}
                              alt="Original"
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gray-50 dark:bg-gray-800/50">
                              <ImageIcon className="h-5 w-5 text-gray-400" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity flex items-center justify-center">
                            <Edit className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />
                          </div>
                        </button>
                        {(editSelectedImage || editOriginalImageUrl) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearEditImage();
                            }}
                            disabled={
                              editIsUploadingImage || updateMutation.isPending
                            }
                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700 shadow-sm border border-red-200 p-0"
                            aria-label="Clear edit image"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ) : def.ImageURL ? (
                      <Dialog
                        open={selectedImageUrl === def.ImageURL}
                        onOpenChange={(open) =>
                          !open && setSelectedImageUrl(null)
                        }
                      >
                        <DialogTrigger asChild>
                          <button
                            type="button"
                            aria-label={`View full image for ${def.Name}`}
                            className="relative h-10 w-10 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                            onClick={() => setSelectedImageUrl(def.ImageURL)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                def.ImageURL && signedUrls?.[def.ImageURL]
                                  ? signedUrls[def.ImageURL]
                                  : undefined
                              }
                              alt={def.Name}
                              className="object-cover w-full h-full"
                            />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md bg-transparent border-none shadow-none flex justify-center items-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              def.ImageURL && signedUrls?.[def.ImageURL]
                                ? signedUrls[def.ImageURL]
                                : undefined
                            }
                            alt={def.Name}
                            className="max-w-full max-h-[80vh] object-contain rounded-md"
                          />
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                        <ImageIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === def.ID ? (
                      <div className="space-y-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Name"
                          className="h-8"
                          aria-label="Name"
                        />
                        <Input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Description"
                          className="h-8 text-xs"
                          aria-label="Description"
                        />

                        <div className="space-y-1 col-span-2">
                          <Label
                            htmlFor={`editLowStockThreshold-${def.ID}`}
                            className="text-xs"
                          >
                            Low Stock Threshold
                          </Label>
                          <Input
                            id={`editLowStockThreshold-${def.ID}`}
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Threshold"
                            value={editLowStockThreshold}
                            onChange={(e) =>
                              setEditLowStockThreshold(e.target.value)
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                        <Label className="flex items-center gap-2 cursor-pointer font-normal text-xs text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={editIsExpirable}
                            onChange={(e) =>
                              setEditIsExpirable(e.target.checked)
                            }
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 h-3 w-3"
                          />
                          Expirable
                        </Label>
                      </div>
                    ) : (
                      <>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {def.Name}
                        </div>
                        {def.Description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                            {def.Description}
                          </div>
                        )}
                        {def.IsExpirable && (
                          <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-700/10 dark:ring-blue-400/20 mt-1">
                            Expirable
                          </span>
                        )}
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === def.ID ? (
                      <Select
                        value={editCategoryId}
                        onChange={(e) => setEditCategoryId(e.target.value)}
                        className="h-8 text-xs"
                        aria-label="Category"
                      >
                        <option value="">None</option>
                        {categories?.map((c) => (
                          <option key={c.ID} value={c.ID}>
                            {c.Name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">
                        {def.Category?.Name || "-"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === def.ID ? (
                      <Select
                        value={editSizeUnitId}
                        onChange={(e) => setEditSizeUnitId(e.target.value)}
                        className="h-8 text-xs"
                        aria-label="Size Unit"
                      >
                        <option value="">Select Unit</option>
                        {sizeUnits?.map((u) => (
                          <option key={u.ID} value={u.ID}>
                            {u.Name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">
                        {def.SizeUnit?.Name || "-"}
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
                          disabled={
                            updateMutation.isPending ||
                            !editName.trim() ||
                            !editSizeUnitId
                          }
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 mr-1"
                        >
                          <Save className="h-4 w-4 mr-1" /> Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelEdit}
                          className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                        >
                          <X className="h-4 w-4 mr-1" /> Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(def)}
                          aria-label={`Edit item definition ${def.Name}`}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 mr-1"
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={
                            deleteMutation.isPending &&
                            deleteMutation.variables === def.ID
                          }
                          onClick={() => {
                            if (confirm("Delete this item definition?")) {
                              deleteMutation.mutate(def.ID);
                            }
                          }}
                          aria-label={`Delete item definition ${def.Name}`}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 -mr-2"
                        >
                          {deleteMutation.isPending &&
                          deleteMutation.variables === def.ID ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
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
    </div>
  );
}

export default function ItemDefinitions() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <ItemDefinitionsContent />
    </Suspense>
  );
}

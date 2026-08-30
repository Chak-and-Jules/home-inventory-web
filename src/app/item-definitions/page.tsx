'use client';

import { useSignedUrls } from '@/hooks/useSignedUrls';
import { useAuth } from '@/components/AuthProvider';
import { useHome } from '@/components/HomeProvider';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, Suspense, useMemo, useEffect } from 'react';
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
import {
  Package,
  Plus,
  Trash2,
  Image as ImageIcon,
  X,
  Edit,
  Save,
  Search,
} from 'lucide-react';
import type { Category, SizeUnit, ItemDefinition, ItemDefinitionRequest } from '@/types';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

function ItemDefinitionsContent() {
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
  const [editOriginalImageUrl, setEditOriginalImageUrl] = useState<
    string | null
  >(null);

  // Image Popup State
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedMobileDef, setSelectedMobileDef] = useState<ItemDefinition | null>(null);

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
    return categories?.map((c) => (
      <option key={c.ID} value={c.ID}>
        {c.Name}
      </option>
    ));
  }, [categories]);

  const sizeUnitOptions = useMemo(() => {
    return sizeUnits?.map((u) => (
      <option key={u.ID} value={u.ID}>
        {u.Name}
      </option>
    ));
  }, [sizeUnits]);

  const updateMutation = useMutation({
    mutationFn: async (data: ItemDefinitionRequest & { id: string }) => {
      const imageUrl = data.image_url;
      // We don't support file upload directly inside inline table edit for simplicity here,
      // but we preserve original or already handled editSelectedImage
      return api.put(
        `/item-definitions/${data.id}`,
        {
          ...data,
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
    if (!searchQuery.trim()) return itemDefs;
    const query = searchQuery.toLowerCase();
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
  }, [itemDefs, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Item Definitions
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Define the types of items you want to track in your inventory.
          </p>
        </div>
        <Button asChild>
          <Link href="/item-definitions/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Definition
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search item definitions..."
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
          >
            Clear
          </Button>
        )}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px] hidden sm:table-cell">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden sm:table-cell">Unit</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Actions</TableHead>
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
              {!defsPending && itemDefs && itemDefs.length > 0 && filteredItemDefs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    No matching item definitions found.
                  </TableCell>
                </TableRow>
              )}
              {filteredItemDefs?.map((def) => (
                <TableRow
                  key={def.ID}
                  onClick={() => {
                    if (window.innerWidth < 640 && editingId !== def.ID) {
                      setSelectedMobileDef(def);
                    }
                  }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 sm:cursor-default cursor-pointer"
                >
                  <TableCell className="hidden sm:table-cell">
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
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
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
                            htmlFor={`editBarcode-${def.ID}`}
                            className="text-xs"
                          >
                            Barcode
                          </Label>
                          <Input
                            id={`editBarcode-${def.ID}`}
                            type="text"
                            placeholder="Barcode"
                            value={editBarcode}
                            onChange={(e) =>
                              setEditBarcode(e.target.value)
                            }
                            className="h-8 text-sm"
                          />
                        </div>
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
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px] hidden sm:block">
                            {def.Description}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400 ring-1 ring-inset ring-indigo-700/10 dark:ring-indigo-400/20 sm:hidden">
                            {def.Category?.Name || "No Category"}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-gray-50 dark:bg-gray-800/50 px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-400 ring-1 ring-inset ring-gray-700/10 sm:hidden">
                            {def.SizeUnit?.Name || "No Unit"}
                          </span>
                          {def.barcode && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400 ring-1 ring-inset ring-gray-500/10">
                              {def.barcode}
                            </span>
                          )}
                          {def.IsExpirable && (
                            <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-700/10 dark:ring-blue-400/20">
                              Expirable
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {editingId === def.ID ? (
                      <Select
                        value={editCategoryId}
                        onChange={(e) => setEditCategoryId(e.target.value)}
                        className="h-8 text-xs"
                        aria-label="Category"
                      >
                        <option value="">None</option>
                        {categoryOptions}
                      </Select>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">
                        {def.Category?.Name || "-"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {editingId === def.ID ? (
                      <Select
                        value={editSizeUnitId}
                        onChange={(e) => setEditSizeUnitId(e.target.value)}
                        className="h-8 text-xs"
                        aria-label="Size Unit"
                      >
                        <option value="">Select Unit</option>
                        {sizeUnitOptions}
                      </Select>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">
                        {def.SizeUnit?.Name || "-"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap hidden sm:table-cell">
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
                aria-label="Close details"
              >
                <X className="h-5 w-5 text-gray-500" />
              </Button>
            </div>

            <div className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto">
              {selectedMobileDef.ImageURL && (
                <div className="w-full h-48 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      signedUrls?.[selectedMobileDef.ImageURL] ||
                      selectedMobileDef.ImageURL
                    }
                    alt={selectedMobileDef.Name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                    Category
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {selectedMobileDef.Category?.Name || "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                    Size Unit
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {selectedMobileDef.SizeUnit?.Name || "—"}
                  </span>
                </div>
                {selectedMobileDef.barcode && (
                  <div>
                    <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                      Barcode
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium font-mono">
                      {selectedMobileDef.barcode}
                    </span>
                  </div>
                )}
                <div>
                  <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                    Expirable
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {selectedMobileDef.IsExpirable ? "Yes" : "No"}
                  </span>
                </div>
                {selectedMobileDef.low_stock_threshold !== undefined && selectedMobileDef.low_stock_threshold !== null && (
                  <div>
                    <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                      Low Stock Threshold
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      {selectedMobileDef.low_stock_threshold}
                    </span>
                  </div>
                )}
                {selectedMobileDef.Description && (
                  <div className="col-span-2">
                    <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                      Description
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
                Edit
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                disabled={
                  deleteMutation.isPending &&
                  deleteMutation.variables === selectedMobileDef.ID
                }
                onClick={() => {
                  if (confirm("Delete this item definition?")) {
                    deleteMutation.mutate(selectedMobileDef.ID, {
                      onSuccess: () => {
                        setSelectedMobileDef(null);
                      }
                    });
                  }
                }}
                aria-label={`Delete ${selectedMobileDef.Name}`}
              >
                {deleteMutation.isPending &&
                deleteMutation.variables === selectedMobileDef.ID ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
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
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <ItemDefinitionsContent />
    </Suspense>
  );
}

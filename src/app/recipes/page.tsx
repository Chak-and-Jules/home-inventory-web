'use client'

import React, { Suspense, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, cookRecipe, getMealSuggestions, getRecipes, createRecipe, updateRecipe, deleteRecipe } from '@/lib/api'
import { useAuth } from '@/components/AuthProvider'
import { useHome } from '@/components/HomeProvider'
import {
  Recipe,
  RecipeIngredientRequest,
  MealSuggestion,
  ItemDefinition,
  UserHome,
  InventoryItem,
} from '@/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ChefHat,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  ShoppingCart,
  Loader2,
  Utensils,
  BookOpen,
} from 'lucide-react'

function RecipesContent() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { currentHomeId } = useHome()
  const queryClient = useQueryClient()

  // State for recipe dialog
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [recipeName, setRecipeName] = useState('')
  const [recipeDescription, setRecipeDescription] = useState('')
  const [recipeInstructions, setRecipeInstructions] = useState('')
  const [recipeServings, setRecipeServings] = useState<number>(4)
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientRequest[]>([
    { item_definition_id: '', quantity_required: 1 },
  ])

  // Queries
  const { data: userHomes } = useQuery({
    queryKey: ['homes'],
    queryFn: async () => {
      const res = await api.get<UserHome[]>('/homes')
      return res.data
    },
    enabled: !!session,
  })

  const userRole = useMemo(() => {
    const home = userHomes?.find((h) => h.HomeID === currentHomeId)
    return home?.Role?.toLowerCase()
  }, [userHomes, currentHomeId])

  const canModify = useMemo(
    () => userRole === 'owner' || userRole === 'editor',
    [userRole]
  )

  const { data: recipes, isPending: isPendingRecipes } = useQuery({
    queryKey: ['recipes', currentHomeId],
    queryFn: () => getRecipes({ headers: { 'X-Home-Id': currentHomeId! } }),
    enabled: !!session && !!currentHomeId,
  })

  const { data: itemDefinitions } = useQuery({
    queryKey: ['itemDefinitions', currentHomeId],
    queryFn: async () => {
      const res = await api.get<ItemDefinition[]>('/item-definitions', {
        headers: { 'X-Home-Id': currentHomeId! },
      })
      return res.data
    },
    enabled: !!session && !!currentHomeId,
  })

  const { data: inventoryItems } = useQuery({
    queryKey: ['inventory', currentHomeId],
    queryFn: async () => {
      const res = await api.get<InventoryItem[]>('/inventory', {
        headers: { 'X-Home-Id': currentHomeId! },
      })
      return res.data
    },
    enabled: !!session && !!currentHomeId,
  })

  const { data: rawSuggestions, isPending: isPendingSuggestions } = useQuery({
    queryKey: ['mealSuggestions', currentHomeId],
    queryFn: () => getMealSuggestions({ headers: { 'X-Home-Id': currentHomeId! } }),
    enabled: !!session && !!currentHomeId,
  })

  // Compute fallback suggestions if backend endpoint returns raw recipes or client fallback is needed
  const suggestions = useMemo<MealSuggestion[]>(() => {
    if (rawSuggestions && rawSuggestions.length > 0) {
      return rawSuggestions
    }

    if (!recipes || !inventoryItems || !itemDefinitions) return []

    // Helper map for inventory stock by item definition
    const stockMap = new Map<string, number>()
    const expiringSet = new Set<string>()
    const now = new Date()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    inventoryItems.forEach((inv) => {
      const current = stockMap.get(inv.ItemDefinitionID) || 0
      stockMap.set(inv.ItemDefinitionID, current + inv.Quantity)

      if (inv.ExpirationDate) {
        const exp = new Date(inv.ExpirationDate)
        if (exp <= threeDaysFromNow) {
          expiringSet.add(inv.ItemDefinitionID)
        }
      }
    })

    const itemDefMap = new Map<string, ItemDefinition>()
    itemDefinitions.forEach((def) => itemDefMap.set(def.ID, def))

    return recipes.map((recipe) => {
      let isFullyAvailable = true
      let hasExpiring = false
      let maxServings = Infinity
      const missingIngredients: {
        item_definition_id: string
        item_definition_name: string
        missing_quantity: number
      }[] = []

      recipe.Ingredients?.forEach((ing) => {
        const currentStock = stockMap.get(ing.ItemDefinitionID) || 0
        const required = ing.QuantityRequired || 1
        const def = ing.ItemDefinition || itemDefMap.get(ing.ItemDefinitionID)
        const defName = def?.Name || 'Unknown Item'

        if (expiringSet.has(ing.ItemDefinitionID)) {
          hasExpiring = true
        }

        if (currentStock < required) {
          isFullyAvailable = false
          missingIngredients.push({
            item_definition_id: ing.ItemDefinitionID,
            item_definition_name: defName,
            missing_quantity: required - currentStock,
          })
          maxServings = 0
        } else {
          const possible = Math.floor(currentStock / required) * (recipe.Servings || 1)
          if (possible < maxServings) {
            maxServings = possible
          }
        }
      })

      if (maxServings === Infinity) maxServings = recipe.Servings || 1

      return {
        recipe,
        is_fully_available: isFullyAvailable,
        available_servings: isFullyAvailable ? maxServings : 0,
        has_expiring_ingredients: hasExpiring,
        missing_ingredients: missingIngredients,
      }
    })
  }, [rawSuggestions, recipes, inventoryItems, itemDefinitions])

  const fullyAvailableSuggestions = useMemo(
    () => suggestions.filter((s) => s.is_fully_available),
    [suggestions]
  )

  const partiallyAvailableSuggestions = useMemo(
    () => suggestions.filter((s) => !s.is_fully_available),
    [suggestions]
  )

  // Mutations
  const cookMutation = useMutation({
    mutationFn: (recipeId: string) =>
      cookRecipe(recipeId, {}, { headers: { 'X-Home-Id': currentHomeId! } }),
    onSuccess: (_, recipeId) => {
      const rec = recipes?.find((r) => r.ID === recipeId)
      alert(t('recipes.alerts.cookSuccess', { name: rec?.Name || '' }))
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['mealSuggestions'] })
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
    },
    onError: () => {
      alert(t('recipes.alerts.cookFailed'))
    },
  })

  const addToMealPlanMutation = useMutation({
    mutationFn: async (suggestion: MealSuggestion) => {
      const requests = suggestion.missing_ingredients.map((missing) =>
        api.post(
          '/shopping-list',
          {
            item_definition_id: missing.item_definition_id,
            name: missing.item_definition_name,
            quantity: missing.missing_quantity,
          },
          { headers: { 'X-Home-Id': currentHomeId! } }
        )
      )
      await Promise.all(requests)
    },
    onSuccess: () => {
      alert(t('recipes.alerts.addToMealPlanSuccess'))
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] })
    },
    onError: () => {
      alert(t('recipes.alerts.addToMealPlanFailed'))
    },
  })

  const createRecipeMutation = useMutation({
    mutationFn: (payload: {
      name: string
      description?: string
      instructions?: string
      servings?: number
      ingredients: RecipeIngredientRequest[]
    }) => createRecipe(payload, { headers: { 'X-Home-Id': currentHomeId! } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      queryClient.invalidateQueries({ queryKey: ['mealSuggestions'] })
      closeRecipeModal()
    },
    onError: () => {
      alert(t('recipes.alerts.failedToCreate'))
    },
  })

  const updateRecipeMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: {
        name: string
        description?: string
        instructions?: string
        servings?: number
        ingredients: RecipeIngredientRequest[]
      }
    }) => updateRecipe(id, payload, { headers: { 'X-Home-Id': currentHomeId! } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      queryClient.invalidateQueries({ queryKey: ['mealSuggestions'] })
      closeRecipeModal()
    },
    onError: () => {
      alert(t('recipes.alerts.failedToUpdate'))
    },
  })

  const deleteRecipeMutation = useMutation({
    mutationFn: (id: string) =>
      deleteRecipe(id, { headers: { 'X-Home-Id': currentHomeId! } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      queryClient.invalidateQueries({ queryKey: ['mealSuggestions'] })
    },
    onError: () => {
      alert(t('recipes.alerts.failedToDelete'))
    },
  })

  // Handlers for Recipe Dialog
  const openCreateModal = () => {
    setEditingRecipe(null)
    setRecipeName('')
    setRecipeDescription('')
    setRecipeInstructions('')
    setRecipeServings(4)
    setRecipeIngredients([{ item_definition_id: '', quantity_required: 1 }])
    setIsRecipeModalOpen(true)
  }

  const openEditModal = (recipe: Recipe) => {
    setEditingRecipe(recipe)
    setRecipeName(recipe.Name)
    setRecipeDescription(recipe.Description || '')
    setRecipeInstructions(recipe.Instructions || '')
    setRecipeServings(recipe.Servings || 4)

    if (recipe.Ingredients && recipe.Ingredients.length > 0) {
      setRecipeIngredients(
        recipe.Ingredients.map((ing) => ({
          item_definition_id: ing.ItemDefinitionID,
          quantity_required: ing.QuantityRequired,
        }))
      )
    } else {
      setRecipeIngredients([{ item_definition_id: '', quantity_required: 1 }])
    }
    setIsRecipeModalOpen(true)
  }

  const closeRecipeModal = () => {
    setIsRecipeModalOpen(false)
    setEditingRecipe(null)
  }

  const handleIngredientChange = (
    index: number,
    field: keyof RecipeIngredientRequest,
    value: string | number
  ) => {
    setRecipeIngredients((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleAddIngredientRow = () => {
    setRecipeIngredients((prev) => [
      ...prev,
      { item_definition_id: '', quantity_required: 1 },
    ])
  }

  const handleRemoveIngredientRow = (index: number) => {
    setRecipeIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipeName.trim()) return

    const validIngredients = recipeIngredients.filter(
      (ing) => ing.item_definition_id && ing.quantity_required > 0
    )

    const payload = {
      name: recipeName.trim(),
      description: recipeDescription.trim(),
      instructions: recipeInstructions.trim(),
      servings: Number(recipeServings) || 1,
      ingredients: validIngredients,
    }

    if (editingRecipe) {
      updateRecipeMutation.mutate({ id: editingRecipe.ID, payload })
    } else {
      createRecipeMutation.mutate(payload)
    }
  }

  if (isPendingRecipes || isPendingSuggestions) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ChefHat className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            {t('recipes.title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">{t('recipes.description')}</p>
        </div>
        {canModify && (
          <Button onClick={openCreateModal} className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t('recipes.actions.createRecipe')}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="suggestions" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="suggestions" className="flex items-center gap-2">
            <Utensils className="h-4 w-4" />
            {t('recipes.tabs.suggestions')}
          </TabsTrigger>
          <TabsTrigger value="recipes" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t('recipes.tabs.recipes')}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Meal Suggestions Dashboard */}
        <TabsContent value="suggestions" className="space-y-6">
          <Card className="border-indigo-100 bg-white dark:bg-gray-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-indigo-500" />
                {t('recipes.suggestions.title')}
              </CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('recipes.suggestions.description')}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {suggestions.length === 0 ? (
                <p className="text-center py-8 text-gray-500">
                  {t('recipes.suggestions.noSuggestions')}
                </p>
              ) : (
                <div className="space-y-8">
                  {/* Fully Available Section */}
                  <div>
                    <h3 className="text-md font-semibold text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5" />
                      {t('recipes.suggestions.fullyAvailable')} ({fullyAvailableSuggestions.length})
                    </h3>
                    {fullyAvailableSuggestions.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No fully available recipes with current stock.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fullyAvailableSuggestions.map((suggestion) => (
                          <Card
                            key={suggestion.recipe.ID}
                            className="border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 hover:shadow-md transition-shadow"
                          >
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                                    {suggestion.recipe.Name}
                                  </h4>
                                  {suggestion.recipe.Description && (
                                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                                      {suggestion.recipe.Description}
                                    </p>
                                  )}
                                </div>
                                <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                                  In Stock
                                </span>
                              </div>

                              {/* Expiring ingredients badge */}
                              {suggestion.has_expiring_ingredients && (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span>{t('recipes.suggestions.hasExpiringIngredients')}</span>
                                </div>
                              )}

                              <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-2 border-emerald-100 dark:border-emerald-900/30">
                                <span>
                                  {t('recipes.suggestions.availableServings', {
                                    servings: suggestion.available_servings,
                                  })}
                                </span>
                                {canModify && (
                                  <Button
                                    size="sm"
                                    onClick={() => cookMutation.mutate(suggestion.recipe.ID)}
                                    disabled={
                                      cookMutation.isPending &&
                                      cookMutation.variables === suggestion.recipe.ID
                                    }
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
                                  >
                                    {cookMutation.isPending &&
                                    cookMutation.variables === suggestion.recipe.ID ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <ChefHat className="h-3.5 w-3.5" />
                                    )}
                                    {cookMutation.isPending &&
                                    cookMutation.variables === suggestion.recipe.ID
                                      ? t('recipes.actions.cooking')
                                      : t('recipes.actions.cook')}
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Partially Available Section */}
                  <div>
                    <h3 className="text-md font-semibold text-indigo-700 dark:text-indigo-400 mb-3 flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      {t('recipes.suggestions.partiallyAvailable')} ({partiallyAvailableSuggestions.length})
                    </h3>
                    {partiallyAvailableSuggestions.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No recipes with missing ingredients.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {partiallyAvailableSuggestions.map((suggestion) => (
                          <Card
                            key={suggestion.recipe.ID}
                            className="border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 hover:shadow-md transition-shadow"
                          >
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                                    {suggestion.recipe.Name}
                                  </h4>
                                  {suggestion.recipe.Description && (
                                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                                      {suggestion.recipe.Description}
                                    </p>
                                  )}
                                </div>
                                <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                  {t('recipes.suggestions.missingCount', {
                                    count: suggestion.missing_ingredients.length,
                                  })}
                                </span>
                              </div>

                              {/* Expiring ingredients badge */}
                              {suggestion.has_expiring_ingredients && (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span>{t('recipes.suggestions.hasExpiringIngredients')}</span>
                                </div>
                              )}

                              {/* Missing ingredients list */}
                              <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1 bg-white dark:bg-gray-900 p-2 rounded border border-gray-100 dark:border-gray-800">
                                <span className="font-semibold text-gray-700 dark:text-gray-200">Missing Ingredients:</span>
                                <ul className="list-disc list-inside space-y-0.5 text-red-600 dark:text-red-400">
                                  {suggestion.missing_ingredients.map((m) => (
                                    <li key={m.item_definition_id}>
                                      {m.item_definition_name} (Needs {m.missing_quantity} more)
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="flex items-center justify-end border-t pt-2 border-gray-200 dark:border-gray-700">
                                {canModify && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => addToMealPlanMutation.mutate(suggestion)}
                                    disabled={
                                      addToMealPlanMutation.isPending &&
                                      addToMealPlanMutation.variables?.recipe.ID === suggestion.recipe.ID
                                    }
                                    className="text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center gap-1.5"
                                  >
                                    {addToMealPlanMutation.isPending &&
                                    addToMealPlanMutation.variables?.recipe.ID === suggestion.recipe.ID ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <ShoppingCart className="h-3.5 w-3.5" />
                                    )}
                                    {addToMealPlanMutation.isPending &&
                                    addToMealPlanMutation.variables?.recipe.ID === suggestion.recipe.ID
                                      ? t('recipes.actions.addingToMealPlan')
                                      : t('recipes.actions.addToMealPlan')}
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: All Recipes CRUD List */}
        <TabsContent value="recipes">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">{t('recipes.tabs.recipes')}</CardTitle>
            </CardHeader>
            <CardContent>
              {!recipes || recipes.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No recipes found. Create one to get started!</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recipes.map((recipe) => (
                    <Card key={recipe.ID} className="border border-gray-200 dark:border-gray-800">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                              {recipe.Name}
                            </h3>
                            <span className="text-xs text-gray-400">
                              {recipe.Servings ? `${recipe.Servings} Servings` : ''}
                            </span>
                          </div>
                          {canModify && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditModal(recipe)}
                                className="text-gray-500 hover:text-indigo-600"
                                aria-label={`Edit ${recipe.Name}`}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (window.confirm(t('recipes.alerts.deleteConfirm'))) {
                                    deleteRecipeMutation.mutate(recipe.ID)
                                  }
                                }}
                                disabled={
                                  deleteRecipeMutation.isPending &&
                                  deleteRecipeMutation.variables === recipe.ID
                                }
                                className="text-gray-400 hover:text-red-600"
                                aria-label={`Delete ${recipe.Name}`}
                              >
                                {deleteRecipeMutation.isPending &&
                                deleteRecipeMutation.variables === recipe.ID ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          )}
                        </div>

                        {recipe.Description && (
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {recipe.Description}
                          </p>
                        )}

                        {recipe.Instructions && (
                          <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                            <span className="font-semibold block text-gray-700 dark:text-gray-300 mb-0.5">Instructions:</span>
                            <p className="line-clamp-3 whitespace-pre-wrap">{recipe.Instructions}</p>
                          </div>
                        )}

                        {recipe.Ingredients && recipe.Ingredients.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                              Ingredients:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {recipe.Ingredients.map((ing) => (
                                <span
                                  key={ing.ID || ing.ItemDefinitionID}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
                                >
                                  {ing.ItemDefinition?.Name || 'Item'}: {ing.QuantityRequired}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recipe Modal Form */}
      <Dialog open={isRecipeModalOpen} onOpenChange={setIsRecipeModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecipe
                ? t('recipes.actions.editRecipe')
                : t('recipes.actions.createRecipe')}
            </DialogTitle>
            <DialogDescription>
              Specify details and required ingredient quantities for this recipe.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRecipe} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipeName">{t('recipes.form.name')}</Label>
              <Input
                id="recipeName"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                placeholder={t('recipes.form.namePlaceholder')}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recipeServings">{t('recipes.form.servings')}</Label>
                <Input
                  id="recipeServings"
                  type="number"
                  min="1"
                  value={recipeServings}
                  onChange={(e) => setRecipeServings(Number(e.target.value) || 1)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipeDescription">{t('recipes.form.description')}</Label>
                <Input
                  id="recipeDescription"
                  value={recipeDescription}
                  onChange={(e) => setRecipeDescription(e.target.value)}
                  placeholder={t('recipes.form.descriptionPlaceholder')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipeInstructions">{t('recipes.form.instructions')}</Label>
              <textarea
                id="recipeInstructions"
                rows={3}
                value={recipeInstructions}
                onChange={(e) => setRecipeInstructions(e.target.value)}
                placeholder={t('recipes.form.instructionsPlaceholder')}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Ingredients builder */}
            <div className="space-y-3 border-t pt-3 border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">{t('recipes.form.ingredients')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddIngredientRow}
                  className="flex items-center gap-1 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('recipes.form.addIngredient')}
                </Button>
              </div>

              {recipeIngredients.map((ing, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="flex-1 w-full">
                    <select
                      value={ing.item_definition_id}
                      onChange={(e) =>
                        handleIngredientChange(idx, 'item_definition_id', e.target.value)
                      }
                      required
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="">{t('recipes.form.selectItem')}</option>
                      {itemDefinitions?.map((def) => (
                        <option key={def.ID} value={def.ID}>
                          {def.Name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full sm:w-32">
                    <Input
                      type="number"
                      min="0.01"
                      step="any"
                      value={ing.quantity_required}
                      onChange={(e) =>
                        handleIngredientChange(
                          idx,
                          'quantity_required',
                          Number(e.target.value) || 0
                        )
                      }
                      placeholder={t('recipes.form.quantityRequired')}
                      required
                    />
                  </div>

                  {recipeIngredients.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveIngredientRow(idx)}
                      className="text-gray-400 hover:text-red-600 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter className="border-t pt-3">
              <Button type="button" variant="outline" onClick={closeRecipeModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createRecipeMutation.isPending || updateRecipeMutation.isPending
                }
                className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center min-w-[100px]"
              >
                {createRecipeMutation.isPending || updateRecipeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('recipes.form.saving')}
                  </>
                ) : (
                  t('recipes.form.save')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function RecipesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading Recipes...</div>}>
      <RecipesContent />
    </Suspense>
  )
}

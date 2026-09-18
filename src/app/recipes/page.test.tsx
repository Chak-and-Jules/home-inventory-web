import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RecipesPage from './page'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/components/AuthProvider'
import { useHome } from '@/components/HomeProvider'
import { api } from '@/lib/api'
import MockAdapter from 'axios-mock-adapter'
import enTranslations from '@/lib/i18n/locales/en/common.json'

vi.mock('react-i18next', () => ({
  useTranslation: () => {
    return {
      t: (key: string, options?: any) => {
        const keys = key.split('.')
        let value: any = enTranslations
        for (const k of keys) {
          if (value && typeof value === 'object' && k in value) {
            value = value[k]
          } else {
            return key
          }
        }
        if (typeof value === 'string' && options) {
          Object.keys(options).forEach((optKey) => {
            value = value.replace(`{{${optKey}}}`, options[optKey])
          })
        }
        return typeof value === 'string' ? value : key
      },
      i18n: {
        changeLanguage: () => Promise.resolve(),
      },
    }
  },
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/components/HomeProvider', () => ({
  useHome: vi.fn(),
}))

const mockApi = new MockAdapter(api)

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

const renderWithProvider = (ui: React.ReactNode) => {
  const queryClient = createQueryClient()
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('Recipes & Meal Suggestions Page', () => {
  const homeId = 'test-home-id'

  const mockRecipes = [
    {
      ID: 'recipe-1',
      HomeID: homeId,
      Name: 'Pasta Primavera',
      Description: 'Fresh spring pasta dish',
      Instructions: 'Boil pasta, saute veggies, mix.',
      Servings: 2,
      Ingredients: [
        {
          ID: 'ing-1',
          RecipeID: 'recipe-1',
          ItemDefinitionID: 'item-pasta',
          QuantityRequired: 1,
          ItemDefinition: { ID: 'item-pasta', Name: 'Pasta' },
        },
      ],
    },
    {
      ID: 'recipe-2',
      HomeID: homeId,
      Name: 'Omelette',
      Description: 'Egg dish',
      Instructions: 'Whisk eggs, fry in pan.',
      Servings: 1,
      Ingredients: [
        {
          ID: 'ing-2',
          RecipeID: 'recipe-2',
          ItemDefinitionID: 'item-eggs',
          QuantityRequired: 3,
          ItemDefinition: { ID: 'item-eggs', Name: 'Eggs' },
        },
      ],
    },
  ]

  const mockInventory = [
    {
      ID: 'inv-1',
      HomeID: homeId,
      ItemDefinitionID: 'item-pasta',
      Quantity: 5,
      ExpirationDate: new Date(Date.now() + 1 * 24 * 3600 * 1000).toISOString(), // Expiring soon
    },
  ]

  const mockItemDefinitions = [
    { ID: 'item-pasta', Name: 'Pasta' },
    { ID: 'item-eggs', Name: 'Eggs' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.reset()
    localStorage.clear()

    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: 'user-1' } },
    } as any)

    vi.mocked(useHome).mockReturnValue({
      currentHomeId: homeId,
    } as any)

    window.alert = vi.fn()
    window.confirm = vi.fn().mockReturnValue(true)

    mockApi.onGet('/homes').reply(200, [
      {
        HomeID: homeId,
        Role: 'owner',
        Home: { ID: homeId, Name: 'Test Household' },
      },
    ])
    mockApi.onGet('/recipes').reply(200, mockRecipes)
    mockApi.onGet('/recipes/suggestions').reply(200, [])
    mockApi.onGet('/item-definitions').reply(200, mockItemDefinitions)
    mockApi.onGet('/inventory').reply(200, mockInventory)
  })

  it('renders meal suggestions dashboard and highlights expiring ingredients', async () => {
    renderWithProvider(<RecipesPage />)

    await waitFor(() => {
      expect(screen.getByText('Smart Meal Suggestions')).toBeInTheDocument()
      expect(screen.getByText('Pasta Primavera')).toBeInTheDocument()
      expect(screen.getByText('Uses expiring soon ingredients!')).toBeInTheDocument()
    })
  })

  it('triggers cook action when cook button is clicked', async () => {
    const user = userEvent.setup()
    mockApi.onPost('/recipes/recipe-1/cook').reply(200, { message: 'Recipe cooked' })

    renderWithProvider(<RecipesPage />)

    await waitFor(() => {
      expect(screen.getByText('Pasta Primavera')).toBeInTheDocument()
    })

    const cookBtn = screen.getByRole('button', { name: 'Cook Dish' })
    await user.click(cookBtn)

    await waitFor(() => {
      expect(mockApi.history.post.length).toBe(1)
      expect(mockApi.history.post[0].url).toBe('/recipes/recipe-1/cook')
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('cooked Pasta Primavera')
      )
    })
  })

  it('allows adding missing ingredients to meal plan (shopping list)', async () => {
    const user = userEvent.setup()
    mockApi.onPost('/shopping-list').reply(201, { ID: 'shop-1' })

    renderWithProvider(<RecipesPage />)

    await waitFor(() => {
      expect(screen.getByText('Omelette')).toBeInTheDocument()
    })

    const addToMealPlanBtn = screen.getByRole('button', {
      name: 'Add Missing to Shopping List',
    })
    await user.click(addToMealPlanBtn)

    await waitFor(() => {
      expect(mockApi.history.post.length).toBe(1)
      expect(mockApi.history.post[0].url).toBe('/shopping-list')
      const body = JSON.parse(mockApi.history.post[0].data)
      expect(body).toEqual({
        item_definition_id: 'item-eggs',
        name: 'Eggs',
        quantity: 3,
      })
    })
  })

  it('creates a new recipe using the modal form', async () => {
    const user = userEvent.setup()
    mockApi.onPost('/recipes').reply(201, {
      ID: 'recipe-3',
      Name: 'Pancakes',
      Servings: 4,
    })

    renderWithProvider(<RecipesPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create Recipe' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Create Recipe' }))

    await waitFor(() => {
      expect(screen.getByLabelText(/Recipe Name/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/Recipe Name/i), 'Pancakes')
    await user.selectOptions(screen.getByRole('combobox'), 'item-eggs')

    await user.click(screen.getByRole('button', { name: 'Save Recipe' }))

    await waitFor(() => {
      expect(mockApi.history.post.length).toBe(1)
      expect(mockApi.history.post[0].url).toBe('/recipes')
      const body = JSON.parse(mockApi.history.post[0].data)
      expect(body.name).toBe('Pancakes')
    })
  })

  it('allows deleting a recipe', async () => {
    const user = userEvent.setup()
    mockApi.onDelete('/recipes/recipe-1').reply(200, { message: 'Deleted' })

    renderWithProvider(<RecipesPage />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'All Recipes' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: 'All Recipes' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete Pasta Primavera' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Delete Pasta Primavera' }))

    await waitFor(() => {
      expect(mockApi.history.delete.length).toBe(1)
      expect(mockApi.history.delete[0].url).toBe('/recipes/recipe-1')
    })
  })
})

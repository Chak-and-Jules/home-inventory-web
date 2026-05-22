import { supabase } from './supabase'

/**
 * Initializes the item-definitions storage bucket if it doesn't exist
 * This should be called once when the app loads
 */
export async function initializeStorageBucket() {
  try {
    // Check if bucket exists by listing files
    const { data, error } = await supabase.storage.from('item-definitions').list('', { limit: 1 })
    
    // If we get a 404, the bucket doesn't exist
    if (error?.message?.includes('not found')) {
      console.log('item-definitions bucket not found. Please create it in Supabase dashboard.')
      return false
    }
    
    return true
  } catch (err) {
    console.error('Error initializing storage bucket:', err)
    return false
  }
}

/**
 * Deletes an image from Supabase storage by its public URL
 * Images are stored under homeId subdirectories
 */
export async function deleteImageFromSupabase(publicUrl: string, homeId: string): Promise<boolean> {
  try {
    // Extract the file path from the URL
    // URL format: https://.../{homeId}/{timestamp}-{filename}
    const urlParts = publicUrl.split('/')
    const fileName = urlParts[urlParts.length - 1]
    const filePath = `${homeId}/${fileName}`
    
    const { error } = await supabase.storage
      .from('item-definitions')
      .remove([filePath])
    
    if (error) {
      console.error('Error deleting image:', error)
      return false
    }
    
    return true
  } catch (err) {
    console.error('Error deleting image from storage:', err)
    return false
  }
}

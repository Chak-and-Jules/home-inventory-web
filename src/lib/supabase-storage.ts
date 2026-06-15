import { log } from 'next-axiom'
import { supabase } from './supabase'

/**
 * Initializes the item-definitions storage bucket if it doesn't exist
 * This should be called once when the app loads
 */
export async function initializeStorageBucket() {
  try {
    // Check if bucket exists by listing files
    const { error } = await supabase.storage.from('item-definitions').list('', { limit: 1 })
    
    // If we get a 404, the bucket doesn't exist
    if (error?.message?.includes('not found')) {
      log.info('item-definitions bucket not found. Please create it in Supabase dashboard.')
      return false
    }
    
    return true
  } catch (err) {
    log.error('Error initializing storage bucket:', { error: err })
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
      log.error('Error deleting image:', { error })
      return false
    }
    
    return true
  } catch (err) {
    log.error('Error deleting image from storage:', { error: err })
    return false
  }
}

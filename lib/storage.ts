/**
 * Supabase Storage — NFT media upload
 *
 * Supports: image (jpg/png/gif/webp), video (mp4/webm), animated gif
 * Max size: 50MB for video, 10MB for images
 * Bucket: "nft-media" (public read, auth write)
 */

import { supabase } from './supabase'

export type MediaType = 'image' | 'video' | 'gif'

export interface UploadResult {
  success: boolean
  url?: string
  mediaType?: MediaType
  error?: string
}

const ALLOWED_TYPES: Record<string, MediaType> = {
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'gif',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
}

const MAX_SIZE_IMAGE = 10 * 1024 * 1024   // 10 MB
const MAX_SIZE_VIDEO = 50 * 1024 * 1024   // 50 MB
const BUCKET = 'nft-media'

export function getMediaType(file: File): MediaType | null {
  return ALLOWED_TYPES[file.type] || null
}

export function validateFile(file: File): string | null {
  const mediaType = getMediaType(file)
  if (!mediaType) {
    return `Unsupported file type: ${file.type}. Use JPG, PNG, GIF, WEBP, MP4, or WEBM.`
  }
  const maxSize = mediaType === 'video' ? MAX_SIZE_VIDEO : MAX_SIZE_IMAGE
  if (file.size > maxSize) {
    const limit = mediaType === 'video' ? '50MB' : '10MB'
    return `File too large. Max size for ${mediaType}: ${limit}`
  }
  return null
}

export async function uploadNftMedia(
  file: File,
  walletAddress: string
): Promise<UploadResult> {
  // Client-side validation first
  const validationError = validateFile(file)
  if (validationError) return { success: false, error: validationError }

  const mediaType = getMediaType(file)!

  // Unique filename: wallet_timestamp_random.ext
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const timestamp = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const filename = `${walletAddress.slice(0, 8)}_${timestamp}_${rand}.${ext}`
  const path = `uploads/${filename}`

  try {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (uploadError) {
      // Bucket might not exist yet
      if (uploadError.message?.includes('Bucket not found')) {
        return {
          success: false,
          error: 'Storage bucket "nft-media" not set up. Run SUPABASE_SETUP.sql and create the bucket.',
        }
      }
      throw uploadError
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)

    return {
      success: true,
      url: data.publicUrl,
      mediaType,
    }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Upload failed',
    }
  }
}

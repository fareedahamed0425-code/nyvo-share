import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";

let supabase: SupabaseClient | null = null;

try {
  if (config.supabase.url && config.supabase.key) {
    supabase = createClient(config.supabase.url, config.supabase.key);
    console.log(`[Storage] Supabase initialized at: ${config.supabase.url}, Bucket: ${config.supabase.bucket}`);

    // Verify / attempt bucket existence
    supabase.storage.getBucket(config.supabase.bucket).then(async ({ error }) => {
      if (error && supabase) {
        const createRes = await supabase.storage.createBucket(config.supabase.bucket, { public: true });
        if (!createRes.error) {
          console.log(`[Storage] Created Supabase bucket: ${config.supabase.bucket}`);
        } else {
          console.log(`[Storage] Note: If bucket '${config.supabase.bucket}' does not exist, create it in your Supabase Dashboard under Storage.`);
        }
      } else {
        console.log(`[Storage] Supabase bucket '${config.supabase.bucket}' is ready.`);
      }
    }).catch(() => {});
  }
} catch (err) {
  console.warn("[Storage] Failed to initialize Supabase client:", err);
}

export async function uploadToStorage(
  storagePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: "Supabase client not initialized" };
  }

  try {
    const { error } = await supabase.storage
      .from(config.supabase.bucket)
      .upload(storagePath, buffer, {
        contentType: mimeType || "application/octet-stream",
        upsert: true,
      });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function downloadFromStorage(
  storagePath: string
): Promise<{ data: Buffer | null; error?: string }> {
  if (!supabase) {
    return { data: null, error: "Supabase client not initialized" };
  }

  try {
    const { data, error } = await supabase.storage
      .from(config.supabase.bucket)
      .download(storagePath);

    if (error || !data) {
      return { data: null, error: error?.message || "Object not found" };
    }

    const arrayBuffer = await data.arrayBuffer();
    return { data: Buffer.from(arrayBuffer) };
  } catch (err: any) {
    return { data: null, error: err?.message || String(err) };
  }
}

export async function deleteFromStorage(
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: "Supabase client not initialized" };
  }

  try {
    const { error } = await supabase.storage
      .from(config.supabase.bucket)
      .remove([storagePath]);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export { supabase };

# Supabase Storage Configuration Guide

This guide explains how to properly configure Supabase storage for the voice generation feature.

## Supabase Storage RLS Issues

The app is encountering Row Level Security (RLS) issues with Supabase storage. Here's how to fix them:

### Option 1: Disable RLS for the Storage Bucket (Simplest)

1. Go to your Supabase dashboard
2. Navigate to Storage
3. Select the "audio-files" bucket (or create it if it doesn't exist)
4. Click on "Policies"
5. Toggle "Enable Row Level Security (RLS)" to OFF

This will allow unrestricted access to the bucket. Only do this if the audio files don't contain sensitive information.

### Option 2: Create Proper RLS Policies (More Secure)

If you need more security, create the following policies:

#### For the "audio-files" bucket:

1. Create a policy for uploads:
   - Name: "Allow authenticated uploads"
   - For operation: INSERT
   - Policy definition: `(auth.role() = 'authenticated')`

2. Create a policy for reading:
   - Name: "Allow public downloads"
   - For operation: SELECT
   - Policy definition: `true`  (allows anyone to download files)

### Environment Configuration

Make sure your `.env` file contains the following variables:

```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_key
SUPABASE_BUCKET_AUDIO=audio-files
```

## Testing the Supabase Storage Integration

After configuring your storage settings, you can test the integration with the diagnostic script:

```
python google_tts_check.py
```

The script should successfully:
1. Generate speech using Google TTS
2. Upload the audio file to Supabase
3. Return a public URL for the audio file

## Troubleshooting

If you still encounter issues:

1. Check that your Supabase project has storage enabled
2. Verify that your API key has the necessary permissions
3. Try creating the bucket manually in the Supabase dashboard
4. Make sure your environment variables are correctly set

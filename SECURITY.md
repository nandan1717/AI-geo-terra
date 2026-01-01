# Security Best Practices

## Environment Variables Setup

This project uses environment variables to keep sensitive API keys secure. **Never commit your `.env` file to Git.**

### Setup Instructions

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual API keys in the `.env` file:
   - **Firebase Configuration**: Get from [Firebase Console](https://console.firebase.google.com/) → Project Settings → General → Your apps
   - **FCM VAPID Key**: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
   - **Supabase**: Get from [Supabase Dashboard](https://app.supabase.com/) → Project Settings → API
   - **DeepSeek API**: Get from [DeepSeek Platform](https://platform.deepseek.com/)
   - **Google Gemini API**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Required Environment Variables

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# FCM VAPID Key
VITE_FCM_VAPID_KEY=your_vapid_key_here

# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# DeepSeek API
VITE_DEEPSEEK_API_KEY=your_deepseek_api_key

# Google Gemini API
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### Security Notes

- ✅ `.env` is already in `.gitignore` - it will never be committed
- ✅ Use `.env.example` as a template (safe to commit)
- ⚠️ **Never** share your `.env` file or commit it to version control
- 🔒 Regenerate any API keys that were accidentally exposed

### For Production Deployment

When deploying to platforms like Vercel, Netlify, or similar:

1. Go to your deployment platform's dashboard
2. Navigate to Environment Variables settings
3. Add all the variables from your `.env` file
4. Redeploy your application

The `VITE_` prefix is required for Vite to expose these variables to your client-side code.

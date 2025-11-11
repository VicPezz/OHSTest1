// config.example.js
// Copy this file to config.js and fill in your actual Supabase credentials
// DO NOT commit config.js to version control (it's in .gitignore)
//
// For GitHub Pages:
// - Option 1: Create config.js locally (won't work on GitHub Pages unless you commit it)
// - Option 2: Inject config inline in HTML files before calendar-app.js loads
// - Option 3: Use GitHub Actions to inject secrets during build

window.SUPABASE_CONFIG = {
  url: 'YOUR_SUPABASE_PROJECT_URL', // e.g., 'https://xxxxx.supabase.co'
  anonKey: 'YOUR_SUPABASE_ANON_KEY', // Your Supabase anon/public API key
  edgeFunctionUrl: 'YOUR_EDGE_FUNCTION_URL' // e.g., 'https://xxxxx.supabase.co/functions/v1/expand-rrules'
};

// Admin password (should be moved to server-side authentication in production)
window.ADMIN_PASSWORD = 'CHANGE_THIS_PASSWORD';


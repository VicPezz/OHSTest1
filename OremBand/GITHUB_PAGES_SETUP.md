# GitHub Pages Deployment Checklist

## ✅ Completed Preparations

1. **Fixed all absolute paths** - Changed `/path` to relative `path` for GitHub Pages compatibility
2. **Fixed image paths** - Changed Windows backslashes (`\`) to forward slashes (`/`)
3. **Fixed broken image references** - Updated media gallery images to use existing files
4. **Updated navigation links** - All links now use relative paths
5. **Removed hardcoded secrets** - Supabase config now loads from `config.js` or `window.SUPABASE_CONFIG`
6. **Created `.gitignore`** - Prevents committing `config.js` with secrets
7. **Created `README.md`** - Includes GitHub Pages setup instructions
8. **Created `config.example.js`** - Template for configuration

## 📋 Next Steps for GitHub Pages Deployment

### 1. Initialize Git Repository (if not already done)
```bash
git init
git add .
git commit -m "Initial commit - GitHub Pages ready"
```

### 2. Create GitHub Repository
- Go to GitHub and create a new repository
- Push your code:
```bash
git remote add origin https://github.com/yourusername/OremBand.git
git branch -M main
git push -u origin main
```

### 3. Enable GitHub Pages
- Go to repository Settings → Pages
- Select "Deploy from a branch"
- Choose "main" branch and "/ (root)" folder
- Click Save

### 4. Configure Supabase (for calendar to work)

**Option A: Local config.js (won't work on GitHub Pages)**
- Create `config.js` from `config.example.js`
- Add your Supabase credentials
- Use locally only

**Option B: Inline config in HTML (works on GitHub Pages)**
Add this script tag BEFORE `calendar-app.js` in both `index.html` and `calendar.html`:
```html
<script>
  window.SUPABASE_CONFIG = {
    url: 'https://your-project.supabase.co',
    anonKey: 'your-anon-key',
    edgeFunctionUrl: 'https://your-project.supabase.co/functions/v1/expand-rrules'
  };
  window.ADMIN_PASSWORD = 'your-secure-password';
</script>
```

**Option C: Use GitHub Secrets with Actions** (advanced)
- Set up GitHub Actions workflow to inject secrets during build

### 5. Verify Deployment
- Your site will be live at: `https://yourusername.github.io/OremBand/`
- Check that all links work
- Test calendar functionality (if Supabase is configured)

## ⚠️ Important Notes

- **Case Sensitivity**: GitHub Pages is case-sensitive. Ensure file names match exactly.
- **Index File**: GitHub Pages looks for `index.html` (lowercase) as the default page
- **Config Security**: Never commit `config.js` with real credentials to a public repository
- **Supabase RLS**: Ensure your Supabase Row Level Security policies allow public read access if needed

## 🔧 Troubleshooting

- **404 Errors**: Check that all paths are relative (not starting with `/`)
- **Calendar Not Loading**: Verify Supabase config is set correctly
- **Images Not Showing**: Ensure image paths use forward slashes (`/`) not backslashes (`\`)


# Orem High School Bands Website

A modern, responsive website for the Orem High School Bands program featuring event calendars, ensemble information, and media galleries.

🌐 **Live Site**: [View on GitHub Pages](https://yourusername.github.io/OremBand/)

## Features

- **Home Page**: Welcome section with announcements, upcoming events preview, and media gallery teaser
- **Calendar**: Interactive calendar with Supabase integration for event management
- **Responsive Design**: Mobile-friendly navigation and layouts
- **Modern UI**: Clean design with navy and gold color scheme matching school colors

## GitHub Pages Setup

### Quick Start

1. **Fork or clone this repository**
2. **Enable GitHub Pages**:
   - Go to your repository Settings
   - Navigate to Pages section
   - Under "Source", select "Deploy from a branch"
   - Choose "main" (or "master") branch and "/ (root)" folder
   - Click Save

3. **Configure Supabase** (for calendar functionality):
   - Create a `config.js` file in the root directory (see `config.example.js`)
   - Add your Supabase credentials:
     ```javascript
     window.SUPABASE_CONFIG = {
       url: 'https://your-project.supabase.co',
       anonKey: 'your-anon-key',
       edgeFunctionUrl: 'https://your-project.supabase.co/functions/v1/expand-rrules'
     };
     window.ADMIN_PASSWORD = 'your-secure-password';
     ```
   - **Important**: Add `config.js` to `.gitignore` (already configured)
   - For GitHub Pages, you can either:
     - **Option A**: Create `config.js` locally and don't commit it (calendar won't work on GitHub Pages)
     - **Option B**: Use GitHub Secrets and inject config via a build process
     - **Option C**: Add config inline in HTML files (less secure but works for public repos)

4. **Your site will be live at**: `https://yourusername.github.io/OremBand/`

### Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Set up the `events` table:
   ```sql
   CREATE TABLE events (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     title TEXT NOT NULL,
     description TEXT,
     location TEXT,
     starts_at TIMESTAMPTZ NOT NULL,
     ends_at TIMESTAMPTZ,
     is_all_day BOOLEAN DEFAULT false,
     is_public BOOLEAN DEFAULT true,
     rrule TEXT,
     timezone TEXT DEFAULT 'UTC',
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```
3. Configure Row Level Security (RLS) policies as needed
4. Set up an Edge Function for RRULE expansion (optional)

## File Structure

```
OremBand/
├── index.html          # Home page
├── calendar.html       # Calendar page
├── main.js            # Navigation and UI interactions
├── calendar-app.js    # Calendar application with Supabase integration
├── styles.css         # All styles
├── config.example.js  # Example configuration file
├── .gitignore         # Git ignore rules
└── Images/           # Image assets
    ├── BandLogo.png
    ├── HeroSectionImage.jpg
    └── ...
```

## Local Development

1. Clone the repository
2. Open `index.html` in a web browser, or use a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js (http-server)
   npx http-server
   ```
3. Create `config.js` from `config.example.js` and add your credentials
4. Open `http://localhost:8000` in your browser

## Security Notes

⚠️ **Important Security Considerations**:

- **Never commit `config.js`** to version control (already in `.gitignore`)
- Client-side password checks are **not secure** - implement server-side authentication for production
- Supabase anon keys are safe to expose in client-side code, but ensure RLS policies are properly configured
- For production, consider implementing proper authentication for admin functions

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive design for mobile devices
- Tested on desktop and mobile viewports

## Contributing

This is a project for Orem High School Bands. For updates or changes, please contact the maintainers.

## License

© 2025 Orem High School Bands. All Rights Reserved.

## Contact

For questions or support, contact: ckwinters@alpinedistrict.org


// ====== Supabase Setup ======
let supabase = null;

// You can configure Supabase in one of two ways:
// Option 1: Use window.SUPABASE_CONFIG (recommended - matches rest of site)
// Option 2: Set SUPABASE_URL and SUPABASE_KEY directly below
const SUPABASE_URL = window.SUPABASE_CONFIG?.url || "https://YOUR-PROJECT.supabase.co";
const SUPABASE_KEY = window.SUPABASE_CONFIG?.anonKey || "YOUR-ANON-KEY";

function initializeSupabase() {
  if (supabase) return supabase;
  
  // Check if Supabase is configured
  if (!SUPABASE_URL || SUPABASE_URL.includes("YOUR-PROJECT") || 
      !SUPABASE_KEY || SUPABASE_KEY.includes("YOUR-ANON")) {
    console.warn('Supabase config not found. Admin panel will not work.');
    alert('Supabase configuration not found. Please configure SUPABASE_URL and SUPABASE_KEY in admin.js or set window.SUPABASE_CONFIG.');
    return null;
  }

  try {
    if (typeof createClient !== 'undefined') {
      supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    } else if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
      console.warn('Supabase createClient not available');
      return null;
    }
  } catch (e) {
    console.error('Failed to initialize Supabase:', e);
    return null;
  }
  
  return supabase;
}

// ====== Admin Auth ======
const ADMIN_PASSWORD = window.ADMIN_PASSWORD || "123"; // ⚠️ Replace or load from env/server

document.addEventListener('DOMContentLoaded', function() {
  const loginSection = document.getElementById("login-section");
  const adminSection = document.getElementById("admin-section");
  const loginBtn = document.getElementById("login-btn");

  if (!loginBtn) return;

  loginBtn.addEventListener("click", () => {
    const password = document.getElementById("password").value;
    if (password === ADMIN_PASSWORD) {
      loginSection.classList.add("hidden");
      adminSection.classList.remove("hidden");
    } else {
      alert("Incorrect password.");
    }
  });

  // Allow Enter key to submit login
  const passwordInput = document.getElementById("password");
  if (passwordInput) {
    passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        loginBtn.click();
      }
    });
  }

  // ====== Add Event ======
  const eventForm = document.getElementById("event-form");
  if (eventForm) {
    eventForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Initialize Supabase
      if (!supabase) {
        initializeSupabase();
      }
      
      if (!supabase) {
        alert("Supabase not initialized. Please check configuration.");
        return;
      }

      const title = document.getElementById("event-title").value;
      const date = document.getElementById("event-date").value;
      const location = document.getElementById("event-location").value;
      const organizer = document.getElementById("event-organizer").value;
      const description = document.getElementById("event-description").value;

      // Convert date to ISO format for Supabase
      const dateObj = new Date(date);
      const startsAt = dateObj.toISOString();

      const { error } = await supabase.from("events").insert([
        { title, starts_at: startsAt, date, location, organizer, description },
      ]);

      if (error) {
        alert("Error adding event: " + error.message);
      } else {
        alert("Event added successfully!");
        e.target.reset();
      }
    });
  }

  // ====== Upload Image to Gallery ======
  const galleryForm = document.getElementById("gallery-form");
  if (galleryForm) {
    galleryForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Initialize Supabase
      if (!supabase) {
        initializeSupabase();
      }
      
      if (!supabase) {
        alert("Supabase not initialized. Please check configuration.");
        return;
      }

      const file = document.getElementById("image-file").files[0];
      const caption = document.getElementById("image-caption").value;

      if (!file) return alert("Please select an image file.");

      const filePath = `gallery/${Date.now()}_${file.name}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("gallery") // your storage bucket name
        .upload(filePath, file);

      if (uploadError) {
        alert("Upload failed: " + uploadError.message);
        return;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("gallery")
        .getPublicUrl(filePath);

      // Insert record into gallery table
      const { error: dbError } = await supabase.from("gallery").insert([
        { image_url: publicUrlData.publicUrl, caption },
      ]);

      if (dbError) {
        alert("Database insert failed: " + dbError.message);
      } else {
        alert("Image uploaded successfully!");
        e.target.reset();
      }
    });
  }
});


// Calendar client script (patched)
// TODO: Move SUPABASE_CONFIG values to a secure config or runtime injection for production.

const SUPABASE_CONFIG = {
  url: 'https://nydublhshqeejzpbsjvt.supabase.co', // Your Supabase URL
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZHVibGhzaHFlZWp6cGJzanZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDgwMjMsImV4cCI6MjA3ODM4NDAyM30.hdziOyIUahWSsqzUZOVeJ6NycCTD7rv4PVoTnW94leQ', // <-- Replace securely (do not commit to public repo)
  edgeFunctionUrl: 'https://nydublhshqeejzpbsjvt.supabase.co/functions/v1/expand-rrules' // Edge Function URL
};

// If you use module imports instead of a global injected script, you can import createClient:
// import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
// const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// Initialize Supabase client (requires Supabase JS library to be loaded as window.supabase or use module import)
let supabase = null;

function initializeSupabase() {
  // Prefer module import + createClient in production. This guard keeps compatibility with a global injected supabase.
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    try {
      supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      console.log('Supabase client initialized (global)');
      return true;
    } catch (error) {
      console.error('Failed to initialize Supabase client (global):', error);
      return false;
    }
  } else if (typeof createClient !== 'undefined') {
    // If you have a createClient in scope (e.g., module import), prefer it
    try {
      supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      console.log('Supabase client initialized (module)');
      return true;
    } catch (error) {
      console.error('Failed to initialize Supabase client (module):', error);
      return false;
    }
  } else {
    console.warn('Supabase JS library not found. Please include the Supabase JS library before this script or use a module import.');
    return false;
  }
}

// Try to initialize immediately (if script loads after Supabase)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSupabase);
} else {
  initializeSupabase();
}

// Global calendar events store
window.calendarEvents = [];

// ============================================================================
// SUPABASE EVENT FETCHING
// ============================================================================

/**
 * Fetches events from the Supabase Edge Function that expands RRULEs
 * Adds optional Authorization header when a user session exists.
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @returns {Promise<Array>} Array of occurrences with instanceId and originalEventId
 */
async function fetchEventsFromEdge(startDate, endDate) {
  const EDGE_URL = SUPABASE_CONFIG.edgeFunctionUrl;
  const start = startDate instanceof Date ? startDate.toISOString() : startDate;
  const end = endDate instanceof Date ? endDate.toISOString() : endDate;

  try {
    const url = `${EDGE_URL}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;

    // Build auth header if session exists
    let authHeader = {};
    try {
      if (supabase && supabase.auth && supabase.auth.getSession) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token || sessionData?.session?.accessToken || null;
        if (token) authHeader.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      // Non-fatal: continue without auth header
      console.warn('Could not read Supabase session for Edge Function auth header:', err?.message || err);
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch events: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    // Expecting data.occurrences array from Edge Function
    if (!Array.isArray(data.occurrences)) {
      console.warn('Edge Function response missing occurrences array, returning empty list.');
      return [];
    }

    // Map occurrences to consistent shape:
    // - instanceId: unique per occurrence (original id + starts_at)
    // - originalEventId: event id from DB
    // - date: YYYY-MM-DD (derived from starts_at, used for calendar day grouping)
    // - starts_at / ends_at: ISO timestamps preserved
    return data.occurrences.map(ev => {
      const startISO = ev.starts_at;
      const startDt = new Date(startISO);
      const dateOnly = startDt.toISOString().split('T')[0];

      return {
        instanceId: `${ev.id}_${ev.starts_at}`, // unique occurrence id
        originalEventId: ev.id, // original DB event id
        date: dateOnly,
        title: ev.title,
        description: ev.description || null,
        location: ev.location || null,
        starts_at: startISO,
        ends_at: ev.ends_at || null,
        timezone: ev.timezone || 'UTC',
        is_all_day: !!ev.is_all_day,
        is_public: ev.is_public !== undefined ? ev.is_public : true,
        extendedProps: {
          description: ev.description || null,
          location: ev.location || null,
          timezone: ev.timezone || null,
          is_public: ev.is_public
        }
      };
    });
  } catch (error) {
    console.error('Error fetching events from Edge Function:', error);
    throw error;
  }
}

/**
 * Fetches events for the visible month and updates the calendar store
 * @param {number} year
 * @param {number} month (0-11)
 */
async function loadEventsForMonth(year, month) {
  try {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    // Fetch occurrences from Edge Function
    const occurrences = await fetchEventsFromEdge(startDate, endDate);

    // Group by date
    const eventsByDate = new Map();
    occurrences.forEach(occ => {
      const dateStr = occ.date;
      if (!eventsByDate.has(dateStr)) eventsByDate.set(dateStr, []);
      eventsByDate.get(dateStr).push(occ);
    });

    // Replace events for this month only
    const monthStart = startDate.toISOString().split('T')[0];
    const monthEnd = endDate.toISOString().split('T')[0];

    window.calendarEvents = window.calendarEvents.filter(ev => {
      return ev.date < monthStart || ev.date > monthEnd;
    });

    // Add new occurrences; when multiple occurrences on same day, combine titles for existing UI
    occurrences.forEach(occ => {
      const dateStr = occ.date;
      const existingIndex = window.calendarEvents.findIndex(ev => ev.date === dateStr);

      const pushObj = {
        date: dateStr,
        title: occ.title,
        id: occ.instanceId || `${occ.originalEventId}_${occ.starts_at}`,
        originalEventId: occ.originalEventId,
        starts_at: occ.starts_at,
        ends_at: occ.ends_at,
        is_all_day: occ.is_all_day,
        extendedProps: occ.extendedProps
      };

      if (existingIndex === -1) {
        window.calendarEvents.push(pushObj);
      } else {
        // Combine titles (simple approach) if multiple events exist on same day
        const existing = window.calendarEvents[existingIndex];
        if (!existing._multiTitles) {
          existing._multiTitles = [existing.title];
        }
        existing._multiTitles.push(occ.title);
        existing.title = existing._multiTitles.join(', ');
        // Optionally store an array of occurrences for a single date
        if (!existing._occurrences) existing._occurrences = [];
        existing._occurrences.push(pushObj);
      }
    });

    // Sort events by date
    window.calendarEvents.sort((a, b) => a.date.localeCompare(b.date));

    return true;
  } catch (error) {
    console.error('Error loading events for month:', error);
    return false;
  }
}

// ============================================================================
// CalendarApp class (UI + realtime)
// ============================================================================

class CalendarApp {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.today = new Date();
    this.currentMonth = this.today.getMonth();
    this.currentYear = this.today.getFullYear();

    this.eventMap = new Map();
    this.isLoading = false;
    this.realtimeChannel = null;
    this._realtimeReloadTimeout = null;

    window.calendarInstance = this;

    this.init();
  }

  buildEventMap() {
    this.eventMap.clear();
    window.calendarEvents.forEach(event => {
      this.eventMap.set(event.date, event);
    });
  }

  async refresh() {
    await this.loadEvents();
    this.buildEventMap();
    this.render();
    refreshUpcomingEvents();
  }

  async loadEvents() {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      await loadEventsForMonth(this.currentYear, this.currentMonth);
      this.buildEventMap();
    } catch (error) {
      console.error('Failed to load events:', error);
      if (this.container) {
        const errorMsg = document.createElement('div');
        errorMsg.className = 'calendar-error';
        errorMsg.textContent = 'Failed to load events. Please refresh the page.';
        errorMsg.style.cssText = 'padding: 1rem; background: #fee; color: #c33; margin: 1rem 0; border-radius: 4px;';
        this.container.insertBefore(errorMsg, this.container.firstChild);
        setTimeout(() => errorMsg.remove(), 5000);
      }
    } finally {
      this.isLoading = false;
    }
  }

  parseLocalDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  async init() {
    await this.loadEvents();
    this.render();
    this.attachEventListeners();
    this.setupRealtimeSubscription();
  }

  setupRealtimeSubscription() {
    if (!supabase) {
      console.warn('Supabase client not available. Realtime updates disabled.');
      return;
    }

    try {
      // Listen for table changes (postgres_changes). If you migrated to broadcast triggers, adapt accordingly.
      this.realtimeChannel = supabase
        .channel('events:all')
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'events'
          },
          (payload) => {
            console.log('Realtime event received:', payload);

            // Debounce reloads to avoid flooding the Edge Function
            clearTimeout(this._realtimeReloadTimeout);
            this._realtimeReloadTimeout = setTimeout(async () => {
              try {
                await this.loadEvents();
                this.render();
                refreshUpcomingEvents();
              } catch (err) {
                console.error('Error during realtime reload:', err);
              }
            }, 300);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Realtime subscription active');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Realtime subscription error');
          }
        });
    } catch (error) {
      console.error('Failed to set up realtime subscription:', error);
    }
  }

  cleanup() {
    if (this.realtimeChannel && supabase && supabase.removeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  getMonthName(month) {
    return new Date(this.currentYear, month, 1).toLocaleString('default', { month: 'long' });
  }

  daysInMonth(month, year) {
    return new Date(year, month + 1, 0).getDate();
  }

  getFirstDayOfWeek(month, year) {
    return new Date(year, month, 1).getDay();
  }

  formatDate(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  isToday(year, month, day) {
    const today = new Date();
    return (
      year === today.getFullYear() &&
      month === today.getMonth() &&
      day === today.getDate()
    );
  }

  render() {
    const firstDay = this.getFirstDayOfWeek(this.currentMonth, this.currentYear);
    const daysInMonth = this.daysInMonth(this.currentMonth, this.currentYear);
    const monthName = this.getMonthName(this.currentMonth);

    const fragment = document.createDocumentFragment();
    const calendarEl = document.createElement('div');
    calendarEl.className = 'calendar-app';
    calendarEl.setAttribute('role', 'grid');
    calendarEl.setAttribute('aria-label', `Calendar for ${monthName} ${this.currentYear}`);

    const header = document.createElement('div');
    header.className = 'calendar-header';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'cal-nav-btn cal-prev';
    prevBtn.innerHTML = '<span aria-hidden="true">←</span>';
    prevBtn.setAttribute('aria-label', 'Previous month');

    const title = document.createElement('h2');
    title.className = 'cal-title';
    title.textContent = `${monthName} ${this.currentYear}`;

    const nextBtn = document.createElement('button');
    nextBtn.className = 'cal-nav-btn cal-next';
    nextBtn.innerHTML = '<span aria-hidden="true">→</span>';
    nextBtn.setAttribute('aria-label', 'Next month');

    const todayBtn = document.createElement('button');
    todayBtn.className = 'cal-nav-btn cal-today';
    todayBtn.textContent = 'Today';
    todayBtn.setAttribute('aria-label', 'Go to current month');

    const adminBtn = document.createElement('button');
    adminBtn.className = 'cal-nav-btn cal-admin';
    adminBtn.textContent = 'Admin';
    adminBtn.setAttribute('aria-label', 'Admin panel');

    header.appendChild(prevBtn);
    header.appendChild(title);
    header.appendChild(nextBtn);
    header.appendChild(todayBtn);
    header.appendChild(adminBtn);

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    grid.setAttribute('role', 'grid');

    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
      const headerCell = document.createElement('div');
      headerCell.className = 'calendar-day-header';
      headerCell.textContent = day;
      headerCell.setAttribute('role', 'columnheader');
      grid.appendChild(headerCell);
    });

    for (let i = 0; i < firstDay; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'calendar-day empty';
      grid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = this.formatDate(this.currentYear, this.currentMonth, day);
      const event = this.eventMap.get(dateStr);
      const isToday = this.isToday(this.currentYear, this.currentMonth, day);

      const dayCell = document.createElement('div');
      dayCell.className = `calendar-day ${event ? 'has-event' : ''} ${isToday ? 'is-today' : ''}`;
      dayCell.setAttribute('data-date', dateStr);
      dayCell.setAttribute('role', 'gridcell');
      dayCell.setAttribute('aria-label', `${monthName} ${day}, ${this.currentYear}`);

      const dayNumber = document.createElement('div');
      dayNumber.className = 'cal-day-number';
      dayNumber.textContent = day;
      dayCell.appendChild(dayNumber);

      if (event) {
        const eventEl = document.createElement('div');
        eventEl.className = 'cal-event';
        eventEl.textContent = event.title;
        eventEl.setAttribute('title', event.title);
        dayCell.appendChild(eventEl);
      }

      grid.appendChild(dayCell);
    }

    calendarEl.appendChild(header);
    calendarEl.appendChild(grid);
    fragment.appendChild(calendarEl);

    this.container.innerHTML = '';
    this.container.appendChild(fragment);

    this.attachEventListeners();
  }

  attachEventListeners() {
    const prevBtn = this.container.querySelector('.cal-prev');
    const nextBtn = this.container.querySelector('.cal-next');
    const todayBtn = this.container.querySelector('.cal-today');
    const adminBtn = this.container.querySelector('.cal-admin');

    if (prevBtn) prevBtn.onclick = () => this.navigateMonth(-1);
    if (nextBtn) nextBtn.onclick = () => this.navigateMonth(1);
    if (todayBtn) todayBtn.onclick = () => this.goToToday();
    if (adminBtn) adminBtn.onclick = () => showPasswordPrompt();

    if (prevBtn) prevBtn.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.navigateMonth(-1);
      }
    };
    if (nextBtn) nextBtn.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.navigateMonth(1);
      }
    };
  }

  async navigateMonth(direction) {
    this.currentMonth += direction;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }

    await this.loadEvents();
    this.render();
  }

  async goToToday() {
    this.currentMonth = this.today.getMonth();
    this.currentYear = this.today.getFullYear();
    await this.loadEvents();
    this.render();
  }
}

// Helper: upcoming events rendering
function refreshUpcomingEvents() {
  const upcomingList = document.getElementById('upcomingEventsList');
  if (!upcomingList || !Array.isArray(window.calendarEvents)) return;

  function parseLocalDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = window.calendarEvents
    .map(e => {
      const dateObj = parseLocalDate(e.date);
      dateObj.setHours(0, 0, 0, 0);
      return { ...e, dateObj };
    })
    .filter(e => e.dateObj >= today)
    .sort((a, b) => a.dateObj - b.dateObj)
    .slice(0, 5);

  if (upcoming.length > 0) {
    upcomingList.innerHTML = upcoming.map(e =>
      `<li>
        <time datetime="${e.date}">${e.dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time>
        <strong>${e.title}</strong>
      </li>`
    ).join('');
  } else {
    upcomingList.innerHTML = '<li style="color: var(--color-text-muted);">No upcoming events scheduled.</li>';
  }
}

// ============================================================================
// SUPABASE ADMIN FUNCTIONS (Create/Update/Delete Events)
// ============================================================================

async function createEventInSupabase(eventData) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  try {
    const { date, time, location, title } = eventData;

    let starts_at;
    let is_all_day = false;

    if (time) {
      starts_at = new Date(`${date}T${time}:00`).toISOString();
    } else {
      starts_at = new Date(`${date}T00:00:00Z`).toISOString();
      is_all_day = true;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    const { data, error } = await supabase
      .from('events')
      .insert([
        {
          title: title,
          description: null,
          location: location || null,
          starts_at: starts_at,
          ends_at: null,
          is_all_day: is_all_day,
          is_public: true,
          rrule: null,
          timezone: timezone
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating event in Supabase:', error);
    throw error;
  }
}

async function deleteEventFromSupabase(eventId) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting event from Supabase:', error);
    throw error;
  }
}

// Admin panel (client-side password prompt remains for convenience but is not secure)
function showPasswordPrompt() {
  const password = prompt('Enter admin password:');
  if (password === '1234') {
    showAdminPanel();
  } else if (password !== null) {
    alert('Incorrect password. Access denied.');
  }
}

function formatEventDate(dateStr) {
  function parseLocalDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderEventsList(container) {
  if (!window.calendarEvents || window.calendarEvents.length === 0) {
    container.innerHTML = '<p class="admin-no-events">No events scheduled.</p>';
    return;
  }

  const eventsWithIndices = window.calendarEvents.map((event, index) => ({
    ...event,
    originalIndex: index
  }));

  const sortedEvents = eventsWithIndices.sort((a, b) => a.date.localeCompare(b.date));

  container.innerHTML = sortedEvents.map((event) => `
    <div class="admin-event-item">
      <div class="admin-event-info">
        <div class="admin-event-date">${formatEventDate(event.date)}</div>
        <div class="admin-event-title">${event.title}</div>
      </div>
      <button class="admin-delete-btn" data-index="${event.originalIndex}" aria-label="Delete event">
        Delete
      </button>
    </div>
  `).join('');

  container.querySelectorAll('.admin-delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const index = parseInt(btn.getAttribute('data-index'));
      const event = window.calendarEvents[index];

      if (confirm(`Are you sure you want to delete this event?\n\n${formatEventDate(event.date)}\n${event.title}`)) {
        if (event.originalEventId && supabase) {
          try {
            btn.disabled = true;
            btn.textContent = 'Deleting...';
            await deleteEventFromSupabase(event.originalEventId);
            if (window.calendarInstance) {
              await window.calendarInstance.refresh();
            }
            renderEventsList(container);
          } catch (error) {
            alert(`Failed to delete event: ${error.message}`);
            btn.disabled = false;
            btn.textContent = 'Delete';
          }
        } else {
          window.calendarEvents.splice(index, 1);
          renderEventsList(container);
          if (window.calendarInstance) {
            window.calendarInstance.refresh();
          }
        }
      }
    };
  });
}

function showAdminPanel() {
  const overlay = document.createElement('div');
  overlay.className = 'admin-modal-overlay';
  overlay.id = 'adminModalOverlay';

  const modal = document.createElement('div');
  modal.className = 'admin-modal';

  modal.innerHTML = `
    <div class="admin-modal-header">
      <h2>Admin Panel</h2>
      <button class="admin-close-btn" aria-label="Close admin panel">&times;</button>
    </div>
    <div class="admin-modal-body">
      <div class="admin-section">
        <h3>Add New Event</h3>
        <form id="adminEventForm">
          <div class="admin-form-group">
            <label for="eventDate">Date:</label>
            <input type="date" id="eventDate" name="date" required>
          </div>
          <div class="admin-form-group">
            <label for="eventTime">Time:</label>
            <input type="time" id="eventTime" name="time">
          </div>
          <div class="admin-form-group">
            <label for="eventLocation">Location:</label>
            <input type="text" id="eventLocation" name="location" placeholder="e.g., Orem High School">
          </div>
          <div class="admin-form-group">
            <label for="eventTitle">Title:</label>
            <input type="text" id="eventTitle" name="title" placeholder="Event title" required>
          </div>
          <div class="admin-form-actions">
            <button type="submit" class="admin-submit-btn">Add Event</button>
          </div>
        </form>
      </div>
      <div class="admin-section">
        <h3>Existing Events</h3>
        <div id="adminEventsList" class="admin-events-list"></div>
      </div>
      <div class="admin-form-actions admin-modal-footer">
        <button type="button" class="admin-cancel-btn">Close</button>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const eventsList = modal.querySelector('#adminEventsList');
  renderEventsList(eventsList);

  const closeBtn = modal.querySelector('.admin-close-btn');
  const cancelBtn = modal.querySelector('.admin-cancel-btn');

  const closeModal = () => {
    document.body.removeChild(overlay);
  };

  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;
  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal();
  };

  const form = modal.querySelector('#adminEventForm');
  form.onsubmit = async (e) => {
    e.preventDefault();

    const dateInput = document.getElementById('eventDate');
    const timeInput = document.getElementById('eventTime');
    const locationInput = document.getElementById('eventLocation');
    const titleInput = document.getElementById('eventTitle');
    const submitBtn = form.querySelector('.admin-submit-btn');

    const date = dateInput.value;
    const time = timeInput.value || '';
    const location = locationInput.value.trim() || '';
    const title = titleInput.value.trim();

    if (!date || !title) {
      alert('Please fill in Date and Title fields.');
      return;
    }

    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      if (supabase) {
        await createEventInSupabase({ date, time, location, title });
        if (window.calendarInstance) await window.calendarInstance.refresh();
        renderEventsList(eventsList);
        form.reset();
        alert('Event added successfully!');
      } else {
        let eventTitle = title;
        if (time) eventTitle = `${time} - ${eventTitle}`;
        if (location) eventTitle = `${eventTitle} (${location})`;
        const newEvent = { date, title: eventTitle };
        window.calendarEvents.push(newEvent);
        if (window.calendarInstance) await window.calendarInstance.refresh();
        renderEventsList(eventsList);
        form.reset();
        alert('Event added successfully! (Note: Supabase not configured - event saved locally only)');
      }
    } catch (error) {
      console.error('Error saving event:', error);
      alert(`Failed to save event: ${error.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  };

  setTimeout(() => document.getElementById('eventDate').focus(), 100);
}

// Initialize calendar when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
  if (!supabase) {
    initializeSupabase();
  }

  const calendarContainer = document.getElementById('calendarApp');
  if (calendarContainer) {
    new CalendarApp('calendarApp');
  }
});

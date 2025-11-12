// Global Supabase client
let supabase = null;

// Initialize Supabase client
function initializeSupabase() {
  if (supabase) return supabase;
  
  if (typeof window.SUPABASE_CONFIG === 'undefined' || !window.SUPABASE_CONFIG.url) {
    console.warn('Supabase config not found. Calendar will work in local-only mode.');
    return null;
  }

  try {
    if (typeof createClient !== 'undefined') {
      supabase = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
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

// Load events for a specific month
async function loadEventsForMonth(year, month) {
  // Initialize Supabase if needed
  if (!supabase) {
    initializeSupabase();
  }

  // Initialize calendarEvents array if it doesn't exist
  if (!window.calendarEvents) {
    window.calendarEvents = [];
  }

  // Calculate month start and end dates
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

  // If Supabase is available, fetch events from database
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('starts_at', monthStart.toISOString())
        .lte('starts_at', monthEnd.toISOString())
        .order('starts_at', { ascending: true });

      if (error) {
        console.error('Error loading events:', error);
        return;
      }

      // Process and add events to calendarEvents
      if (data && data.length > 0) {
        data.forEach(event => {
          const eventDate = new Date(event.starts_at);
          const dateStr = formatDateYMD(eventDate);
          
          // Check if event already exists (avoid duplicates)
          const exists = window.calendarEvents.some(
            e => e.originalEventId === event.id && e.date === dateStr
          );
          
          if (!exists) {
            window.calendarEvents.push({
              id: event.id,
              originalEventId: event.id,
              title: event.title,
              date: dateStr,
              starts_at: event.starts_at,
              ends_at: event.ends_at,
              is_all_day: event.is_all_day || false,
              location: event.location || '',
              description: event.description || ''
            });
          }
        });
      }
    } catch (err) {
      console.error('Failed to load events from Supabase:', err);
    }
  }
}

// Helper function to format date as YYYY-MM-DD
function formatDateYMD(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Create event in Supabase
async function createEventInSupabase(eventData) {
  if (!supabase) {
    initializeSupabase();
  }

  if (!supabase) {
    throw new Error('Supabase not initialized');
  }

  const { date, time, location, title } = eventData;
  
  // Parse date and time
  const dateObj = new Date(date);
  let starts_at;
  
  if (time && time.trim()) {
    // Parse time (assuming format like "14:30" or "2:30 PM")
    const timeMatch = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const ampm = timeMatch[3];
      
      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
        if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
      }
      
      dateObj.setHours(hours, minutes, 0, 0);
    }
    starts_at = dateObj.toISOString();
  } else {
    // All-day event
    dateObj.setHours(0, 0, 0, 0);
    starts_at = dateObj.toISOString();
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      title,
      location: location || null,
      starts_at,
      is_all_day: !time || !time.trim(),
      is_public: true
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Add to calendarEvents immediately
  const dateStr = formatDateYMD(new Date(starts_at));
  window.calendarEvents.push({
    id: data.id,
    originalEventId: data.id,
    title: data.title,
    date: dateStr,
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    is_all_day: data.is_all_day,
    location: data.location || ''
  });

  return data;
}

// Delete event from Supabase
async function deleteEventFromSupabase(eventId) {
  if (!supabase) {
    initializeSupabase();
  }

  if (!supabase) {
    throw new Error('Supabase not initialized');
  }

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) {
    throw error;
  }

  // Remove from calendarEvents
  window.calendarEvents = (window.calendarEvents || []).filter(
    e => e.originalEventId !== eventId
  );
}

// Refresh upcoming events list (helper function)
function refreshUpcomingEvents() {
  const listEl = document.getElementById('upcomingEventsList');
  if (!listEl) return;

  const events = (window.calendarEvents || [])
    .filter(ev => {
      const evDate = new Date(ev.date);
      return evDate >= new Date().setHours(0, 0, 0, 0);
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  listEl.innerHTML = '';
  if (events.length === 0) {
    listEl.innerHTML = '<li>No upcoming events</li>';
    return;
  }

  events.forEach(ev => {
    const li = document.createElement('li');
    const date = new Date(ev.date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    li.textContent = `${date}: ${ev.title}`;
    listEl.appendChild(li);
  });
}

class ModernCalendar {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.today = new Date();
    this.view = 'month'; // 'month' | 'week' | 'list'
    this.currentMonth = this.today.getMonth();
    this.currentYear = this.today.getFullYear();
    this.weekStartDate = this.getWeekStart(this.today);
    this.eventMap = new Map();
    this.popover = null;

    window.calendarInstance = this;

    this.init();
  }

  async init() {
    // Ensure supabase is initialized if possible (no changes to existing supabase code)
    if (typeof initializeSupabase === 'function') {
      try { initializeSupabase(); } catch (e) {}
    }

    // load initial month
    await this.loadAndRender();
    this.bindSidebar();
  }

  async loadAndRender() {
    await this.loadEventsForCurrentView();
    this.buildEventMap();
    this.render();
    refreshUpcomingEvents(); // existing helper
  }

  async loadEventsForCurrentView() {
    // Uses your provided loadEventsForMonth(year, month)
    if (this.view === 'month') {
      await loadEventsForMonth(this.currentYear, this.currentMonth);
    } else if (this.view === 'week') {
      // load months that contain the week start/end
      const start = new Date(this.weekStartDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      // load both start month and end month to cover cross-month weeks
      await loadEventsForMonth(start.getFullYear(), start.getMonth());
      if (start.getMonth() !== end.getMonth()) {
        await loadEventsForMonth(end.getFullYear(), end.getMonth());
      }
    } else {
      // list view: fetch current month and next 2 months for a useful agenda
      await loadEventsForMonth(this.currentYear, this.currentMonth);
      const next = new Date(this.currentYear, this.currentMonth + 1, 1);
      await loadEventsForMonth(next.getFullYear(), next.getMonth());
    }
  }

  buildEventMap() {
    this.eventMap.clear();
    // window.calendarEvents is managed by your Supabase loader
    (window.calendarEvents || []).forEach(ev => {
      if (!this.eventMap.has(ev.date)) this.eventMap.set(ev.date, []);
      this.eventMap.get(ev.date).push(ev);
    });
  }

  getWeekStart(date) {
    const d = new Date(date);
    const dow = d.getDay(); // 0 (Sun) - 6 (Sat)
    d.setDate(d.getDate() - dow); // sunday start
    d.setHours(0,0,0,0);
    return d;
  }

  formatDateYMD(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth()+1).padStart(2,'0');
    const d = String(dateObj.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }

  render() {
    const container = this.container;
    container.innerHTML = '';

    const app = document.createElement('div');
    app.className = 'calendar-app';
    app.setAttribute('role','application');

    // Header
    const header = document.createElement('div');
    header.className = 'calendar-header';

    const left = document.createElement('div'); left.className = 'cal-left';
    const right = document.createElement('div'); right.className = 'cal-right';

    // nav buttons
    const prev = this.makeBtn('←', 'Previous month', () => this.gotoPrev());
    const next = this.makeBtn('→', 'Next month', () => this.gotoNext());
    const today = this.makeBtn('Today', 'Go to today', () => this.gotoToday());
    const title = document.createElement('h2'); title.className='cal-title';

    if (this.view === 'month') {
      title.textContent = `${new Date(this.currentYear, this.currentMonth, 1).toLocaleString(undefined, {month:'long', year:'numeric'})}`;
    } else if (this.view === 'week') {
      const start = this.weekStartDate;
      const end = new Date(start); end.setDate(end.getDate()+6);
      title.textContent = `${start.toLocaleDateString(undefined, {month:'short', day:'numeric'})} — ${end.toLocaleDateString(undefined, {month:'short', day:'numeric', year:end.getFullYear()!==start.getFullYear()? 'numeric': undefined})}`;
    } else {
      title.textContent = `Agenda / Upcoming`;
    }

    left.appendChild(prev);
    left.appendChild(title);
    left.appendChild(next);

    // small controls (today + view toggles + admin link (no modal) )
    const todayBtn = today;
    const adminLink = document.getElementById('openAdminBtn') || (() => {
      const a = document.createElement('a'); a.href='/admin.html'; a.textContent='Admin'; return a;
    })();
    const viewChoices = document.querySelectorAll('.view-toggle button');
    viewChoices.forEach(b => {
      b.onclick = () => this.changeView(b.id);
      // reflect active state
      const activeId = this.view === 'month' ? 'viewMonthBtn' : (this.view === 'week' ? 'viewWeekBtn' : 'viewListBtn');
      document.getElementById(activeId)?.classList?.add('active');
    });

    right.appendChild(document.getElementById('viewMonthBtn')?.cloneNode(true) || this.makeSmall('Month'));
    right.appendChild(document.getElementById('viewWeekBtn')?.cloneNode(true) || this.makeSmall('Week'));
    right.appendChild(document.getElementById('viewListBtn')?.cloneNode(true) || this.makeSmall('Agenda'));
    right.appendChild(todayBtn);

    header.appendChild(left);
    header.appendChild(right);

    app.appendChild(header);

    // content based on view
    if (this.view === 'month') {
      app.appendChild(this.renderMonthView());
    } else if (this.view === 'week') {
      app.appendChild(this.renderWeekView());
    } else {
      app.appendChild(this.renderListView());
    }

    container.appendChild(app);

    // add event listeners after render
    this.onAfterRender();
  }

  renderMonthView() {
    const gridWrap = document.createElement('div');
    gridWrap.className = 'calendar-grid';
    // headers
    const dayHeaders = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    dayHeaders.forEach(h => {
      const el = document.createElement('div');
      el.className = 'calendar-day-header';
      el.textContent = h;
      gridWrap.appendChild(el);
    });

    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth+1, 0).getDate();

    // empty cells
    for (let i=0;i<firstDay;i++){
      const empty = document.createElement('div'); empty.className='calendar-day empty'; gridWrap.appendChild(empty);
    }

    for (let d=1; d<=daysInMonth; d++){
      const dateObj = new Date(this.currentYear, this.currentMonth, d);
      const ymd = this.formatDateYMD(dateObj);
      const events = this.eventMap.get(ymd) || [];
      const cell = document.createElement('div');
      cell.className = `calendar-day ${events.length ? 'has-event' : ''} ${this.isToday(dateObj) ? 'is-today' : ''}`;
      cell.setAttribute('data-date', ymd);
      cell.setAttribute('tabindex', 0);
      cell.setAttribute('role','button');
      const dayNum = document.createElement('div'); dayNum.className='cal-day-number'; dayNum.textContent = d;
      cell.appendChild(dayNum);

      if (events.length>0) {
        // show first event
        const ev = events[0];
        const evEl = document.createElement('div');
        evEl.className = 'cal-event';
        evEl.textContent = ev.title;
        evEl.title = ev.title;
        evEl.tabIndex = 0;
        evEl.onclick = (e) => { e.stopPropagation(); this.openPopoverForDate(ymd, cell); };
        cell.appendChild(evEl);

        if (events.length > 1) {
          const badge = document.createElement('div');
          badge.className = 'multi-badge';
          badge.textContent = `+${events.length - 1}`;
          cell.appendChild(badge);
        }
      } else {
        // empty day has click to quick create
        cell.onclick = () => this.openPopoverForDate(ymd, cell);
      }

      // clicking anywhere opens popover
      cell.onclick = (e) => { e.stopPropagation(); this.openPopoverForDate(ymd, cell); };

      gridWrap.appendChild(cell);
    }

    return gridWrap;
  }

  renderWeekView() {
    const wrap = document.createElement('div');
    wrap.className = 'calendar-grid';
    // headers
    const start = new Date(this.weekStartDate);
    for (let i=0;i<7;i++){
      const date = new Date(start); date.setDate(start.getDate()+i);
      const header = document.createElement('div');
      header.className = 'calendar-day-header';
      header.textContent = date.toLocaleDateString(undefined, { weekday: 'short', month:'short', day:'numeric' });
      wrap.appendChild(header);
    }
    // rows: single row with day cells
    const cells = document.createElement('div');
    cells.style.gridColumn = '1 / -1';
    cells.style.display = 'grid';
    cells.style.gridTemplateColumns = 'repeat(7, 1fr)';
    cells.style.gap = '8px';

    for (let i=0;i<7;i++){
      const date = new Date(start); date.setDate(start.getDate()+i);
      const ymd = this.formatDateYMD(date);
      const events = this.eventMap.get(ymd) || [];
      const cell = document.createElement('div');
      cell.className = `calendar-day ${events.length ? 'has-event' : ''} ${this.isToday(date) ? 'is-today' : ''}`;
      cell.setAttribute('data-date', ymd);
      cell.onclick = () => this.openPopoverForDate(ymd, cell);
      const dayNum = document.createElement('div'); dayNum.className='cal-day-number'; dayNum.textContent = date.getDate();
      cell.appendChild(dayNum);

      // show stacked events
      events.slice(0,4).forEach(ev => {
        const evEl = document.createElement('div');
        evEl.className = 'cal-event';
        evEl.textContent = ev.title;
        evEl.onclick = (e) => { e.stopPropagation(); this.openPopoverForDate(ymd, cell); };
        cell.appendChild(evEl);
      });

      if (events.length>4) {
        const more = document.createElement('div'); more.className='multi-badge'; more.textContent = `+${events.length-4}`; cell.appendChild(more);
      }

      cells.appendChild(cell);
    }

    wrap.appendChild(cells);
    return wrap;
  }

  renderListView() {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '8px';

    // Flatten upcoming events sorted by date
    const events = [];
    (window.calendarEvents || []).forEach(ev => events.push(ev));
    events.sort((a,b) => a.date.localeCompare(b.date));

    if (events.length === 0) {
      const p = document.createElement('p'); p.style.color = 'var(--muted)'; p.textContent = 'No events found.';
      wrap.appendChild(p);
      return wrap;
    }

    events.forEach(ev => {
      const card = document.createElement('div');
      card.style.background = 'rgba(255,255,255,0.02)';
      card.style.borderRadius = '10px';
      card.style.padding = '12px';
      card.style.display = 'flex';
      card.style.justifyContent = 'space-between';
      card.style.alignItems = 'center';

      const left = document.createElement('div');
      const date = document.createElement('div'); date.style.color = 'var(--muted)'; date.textContent = new Date(ev.date).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'});
      const title = document.createElement('div'); title.style.fontWeight='600'; title.textContent = ev.title;
      left.appendChild(date); left.appendChild(title);

      const right = document.createElement('div');
      const detailsBtn = document.createElement('button'); detailsBtn.textContent = 'Details'; detailsBtn.onclick = () => this.openPopoverForDate(ev.date, card);
      right.appendChild(detailsBtn);

      card.appendChild(left); card.appendChild(right);
      wrap.appendChild(card);
    });

    return wrap;
  }

  onAfterRender() {
    // wire up view toggle buttons (sidebar view toggles exist already)
    const viewMonthBtn = document.getElementById('viewMonthBtn');
    const viewWeekBtn = document.getElementById('viewWeekBtn');
    const viewListBtn = document.getElementById('viewListBtn');

    if (viewMonthBtn) viewMonthBtn.onclick = () => this.setView('month');
    if (viewWeekBtn) viewWeekBtn.onclick = () => this.setView('week');
    if (viewListBtn) viewListBtn.onclick = () => this.setView('list');

    // keyboard navigation
    this.container.onkeydown = (e) => {
      if (e.key === 'ArrowLeft') this.gotoPrev();
      if (e.key === 'ArrowRight') this.gotoNext();
      if (e.key === 't') this.gotoToday();
      if (e.key === 'w') this.setView('week');
      if (e.key === 'm') this.setView('month');
      if (e.key === 'l') this.setView('list');
    };
  }

  isToday(dateObj) {
    const t = new Date();
    return dateObj.getFullYear() === t.getFullYear() && dateObj.getMonth() === t.getMonth() && dateObj.getDate() === t.getDate();
  }

  makeBtn(text, title, onClick) {
    const b = document.createElement('button');
    b.className = 'cal-nav-btn';
    b.type = 'button';
    b.innerHTML = text;
    b.title = title || '';
    b.onclick = onClick;
    return b;
  }

  makeSmall(label) {
    const b = document.createElement('button');
    b.className = 'cal-nav-btn';
    b.textContent = label;
    return b;
  }

  async gotoPrev() {
    if (this.view === 'month') {
      this.currentMonth--;
      if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
    } else if (this.view === 'week') {
      this.weekStartDate.setDate(this.weekStartDate.getDate() - 7);
    } else {
      // list: go back 1 month
      this.currentMonth--;
      if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
    }
    await this.loadAndRender();
    this.closePopover();
  }

  async gotoNext() {
    if (this.view === 'month') {
      this.currentMonth++;
      if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
    } else if (this.view === 'week') {
      this.weekStartDate.setDate(this.weekStartDate.getDate() + 7);
    } else {
      this.currentMonth++;
      if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
    }
    await this.loadAndRender();
    this.closePopover();
  }

  async gotoToday() {
    this.today = new Date();
    this.currentMonth = this.today.getMonth();
    this.currentYear = this.today.getFullYear();
    this.weekStartDate = this.getWeekStart(this.today);
    await this.loadAndRender();
    this.closePopover();
  }

  async setView(view) {
    this.view = view === 'week' ? 'week' : (view === 'list' ? 'list' : 'month');
    // update tab active classes
    ['viewMonthBtn','viewWeekBtn','viewListBtn'].forEach(id => document.getElementById(id)?.classList.remove('active'));
    const id = this.view === 'month' ? 'viewMonthBtn' : (this.view === 'week' ? 'viewWeekBtn' : 'viewListBtn');
    document.getElementById(id)?.classList.add('active');

    // ensure weekStartDate aligns with current month when switching to week
    if (this.view === 'week') {
      this.weekStartDate = this.getWeekStart(this.today);
    }
    await this.loadAndRender();
    this.closePopover();
  }

  changeView(btnId) {
    const map = { viewMonthBtn: 'month', viewWeekBtn: 'week', viewListBtn: 'list' };
    this.setView(map[btnId] || 'month');
  }

  // Popover for date (shows list of occurrences; supports create/delete hooks)
  openPopoverForDate(dateStr, anchorEl) {
    this.closePopover();

    const events = (this.eventMap.get(dateStr) || []).slice();
    const rect = anchorEl.getBoundingClientRect();

    const pop = document.createElement('div');
    pop.className = 'popover';
    pop.setAttribute('role','dialog');
    pop.setAttribute('aria-label', `Events for ${dateStr}`);

    const title = document.createElement('h4');
    title.textContent = new Date(dateStr).toLocaleDateString(undefined, { weekday:'long', month:'short', day:'numeric', year:'numeric' });
    pop.appendChild(title);

    if (events.length === 0) {
      const p = document.createElement('div'); p.className = 'meta'; p.textContent = 'No events on this day.';
      pop.appendChild(p);
    } else {
      events.forEach((ev, index) => {
        // Create event card container
        const eventCard = document.createElement('div');
        eventCard.style.background = 'rgba(255,255,255,0.03)';
        eventCard.style.borderRadius = '8px';
        eventCard.style.padding = '16px';
        eventCard.style.marginBottom = index < events.length - 1 ? '12px' : '0';
        eventCard.style.border = '1px solid rgba(255,255,255,0.05)';

        // Event title
        const titleEl = document.createElement('div');
        titleEl.textContent = ev.title;
        titleEl.style.fontSize = '18px';
        titleEl.style.fontWeight = '700';
        titleEl.style.marginBottom = '12px';
        titleEl.style.color = 'var(--text)';
        eventCard.appendChild(titleEl);

        // Time information section
        const timeSection = document.createElement('div');
        timeSection.style.marginBottom = '12px';
        
        if (ev.starts_at) {
          const startDate = new Date(ev.starts_at);
          const timeInfo = document.createElement('div');
          timeInfo.style.display = 'flex';
          timeInfo.style.alignItems = 'center';
          timeInfo.style.gap = '8px';
          timeInfo.style.marginBottom = '4px';
          
          const timeIcon = document.createElement('span');
          timeIcon.textContent = '🕐';
          timeIcon.style.fontSize = '14px';
          
          const timeText = document.createElement('span');
          if (ev.is_all_day) {
            timeText.textContent = 'All Day';
            timeText.style.fontWeight = '500';
          } else {
            const startTime = startDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            if (ev.ends_at) {
              const endDate = new Date(ev.ends_at);
              const endTime = endDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
              timeText.textContent = `${startTime} - ${endTime}`;
            } else {
              timeText.textContent = `Starts at ${startTime}`;
            }
          }
          timeText.style.color = 'var(--text)';
          
          timeInfo.appendChild(timeIcon);
          timeInfo.appendChild(timeText);
          timeSection.appendChild(timeInfo);
        } else if (ev.is_all_day) {
          const timeInfo = document.createElement('div');
          timeInfo.style.display = 'flex';
          timeInfo.style.alignItems = 'center';
          timeInfo.style.gap = '8px';
          const timeIcon = document.createElement('span');
          timeIcon.textContent = '🕐';
          timeIcon.style.fontSize = '14px';
          const timeText = document.createElement('span');
          timeText.textContent = 'All Day';
          timeText.style.fontWeight = '500';
          timeText.style.color = 'var(--text)';
          timeInfo.appendChild(timeIcon);
          timeInfo.appendChild(timeText);
          timeSection.appendChild(timeInfo);
        }
        
        eventCard.appendChild(timeSection);

        // Location section
        if (ev.location && ev.location.trim()) {
          const locationSection = document.createElement('div');
          locationSection.style.marginBottom = '12px';
          locationSection.style.display = 'flex';
          locationSection.style.alignItems = 'flex-start';
          locationSection.style.gap = '8px';
          
          const locationIcon = document.createElement('span');
          locationIcon.textContent = '📍';
          locationIcon.style.fontSize = '14px';
          locationIcon.style.marginTop = '2px';
          
          const locationText = document.createElement('span');
          locationText.textContent = ev.location;
          locationText.style.color = 'var(--text)';
          locationText.style.flex = '1';
          
          locationSection.appendChild(locationIcon);
          locationSection.appendChild(locationText);
          eventCard.appendChild(locationSection);
        }

        // Description section
        if (ev.description && ev.description.trim()) {
          const descSection = document.createElement('div');
          descSection.style.marginBottom = '12px';
          
          const descLabel = document.createElement('div');
          descLabel.textContent = 'Details:';
          descLabel.style.fontSize = '12px';
          descLabel.style.fontWeight = '600';
          descLabel.style.textTransform = 'uppercase';
          descLabel.style.letterSpacing = '0.5px';
          descLabel.style.color = 'var(--muted)';
          descLabel.style.marginBottom = '6px';
          
          const descText = document.createElement('div');
          descText.textContent = ev.description;
          descText.style.color = 'var(--text)';
          descText.style.lineHeight = '1.6';
          descText.style.whiteSpace = 'pre-wrap';
          descText.style.wordWrap = 'break-word';
          
          descSection.appendChild(descLabel);
          descSection.appendChild(descText);
          eventCard.appendChild(descSection);
        }

        // Action buttons container
        const actionsContainer = document.createElement('div');
        actionsContainer.style.display = 'flex';
        actionsContainer.style.gap = '8px';
        actionsContainer.style.marginTop = '12px';
        actionsContainer.style.paddingTop = '12px';
        actionsContainer.style.borderTop = '1px solid rgba(255,255,255,0.05)';

        // Delete button if available
        if (ev.originalEventId && typeof deleteEventFromSupabase === 'function' && supabase) {
          const delBtn = document.createElement('button');
          delBtn.textContent = 'Delete Event';
          delBtn.style.padding = '6px 12px';
          delBtn.style.borderRadius = '6px';
          delBtn.style.border = '1px solid rgba(255,100,100,0.3)';
          delBtn.style.background = 'rgba(255,100,100,0.1)';
          delBtn.style.color = '#ff6b6b';
          delBtn.style.cursor = 'pointer';
          delBtn.style.fontSize = '13px';
          delBtn.style.fontWeight = '500';
          delBtn.onmouseover = () => {
            delBtn.style.background = 'rgba(255,100,100,0.2)';
          };
          delBtn.onmouseout = () => {
            delBtn.style.background = 'rgba(255,100,100,0.1)';
          };
          delBtn.onclick = async (e) => {
            e.stopPropagation();
            if (!confirm(`Delete "${ev.title}"?`)) return;
            try {
              delBtn.disabled = true;
              delBtn.textContent = 'Deleting...';
              await deleteEventFromSupabase(ev.originalEventId);
              if (window.calendarInstance) await window.calendarInstance.loadAndRender();
              this.closePopover();
              alert('Event deleted successfully.');
            } catch (err) {
              alert('Delete failed: ' + (err.message || err));
              delBtn.disabled = false;
              delBtn.textContent = 'Delete Event';
            }
          };
          actionsContainer.appendChild(delBtn);
        }

        eventCard.appendChild(actionsContainer);
        pop.appendChild(eventCard);
      });
    }

    // Set popover width and max-width for better content display
    pop.style.width = '400px';
    pop.style.maxWidth = '90vw';
    pop.style.maxHeight = '80vh';
    pop.style.overflowY = 'auto';
    
    document.body.appendChild(pop);
    // position popover near anchor
    const left = Math.min(window.innerWidth - 420, rect.left + window.scrollX);
    const top = rect.bottom + window.scrollY + 8;
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;

    // close on outside click or esc
    const onClickOutside = (ev) => { if (!pop.contains(ev.target) && ev.target !== anchorEl) this.closePopover(); };
    const onKey = (ev) => { if (ev.key === 'Escape') this.closePopover(); };
    setTimeout(() => { document.addEventListener('click', onClickOutside); document.addEventListener('keydown', onKey); }, 0);

    this.popover = pop;
    this._outsideHandlers = { onClickOutside, onKey };
  }

  closePopover() {
    if (this.popover) {
      try {
        document.removeEventListener('click', this._outsideHandlers.onClickOutside);
        document.removeEventListener('keydown', this._outsideHandlers.onKey);
      } catch (e) {}
      this.popover.remove();
      this.popover = null;
    }
  }

  bindSidebar() {
    // quick-add controls in sidebar
    const dateInput = document.getElementById('quickDate');
    const titleInput = document.getElementById('quickTitle');
    const addBtn = document.getElementById('quickAddBtn');

    addBtn.onclick = async () => {
      const date = dateInput.value;
      const title = titleInput.value.trim();
      if (!date || !title) { alert('Please choose a date and enter a title.'); return; }
      addBtn.disabled = true; addBtn.textContent = 'Saving...';
      try {
        if (typeof createEventInSupabase === 'function' && supabase) {
          // uses your createEventInSupabase
          await createEventInSupabase({ date, time: '', location: '', title });
        } else {
          window.calendarEvents.push({ date, title, id: `local_${Date.now()}` });
        }
        if (window.calendarInstance) await window.calendarInstance.loadAndRender();
        dateInput.value=''; titleInput.value=''; alert('Event added');
      } catch (err) {
        alert('Failed: ' + (err.message || err));
      } finally {
        addBtn.disabled = false; addBtn.textContent = 'Add Event';
      }
    };

    // wire initial view toggle state
    const viewMonthBtn = document.getElementById('viewMonthBtn');
    const viewWeekBtn = document.getElementById('viewWeekBtn');
    const viewListBtn = document.getElementById('viewListBtn');
    if (viewMonthBtn) viewMonthBtn.onclick = () => this.setView('month');
    if (viewWeekBtn) viewWeekBtn.onclick = () => this.setView('week');
    if (viewListBtn) viewListBtn.onclick = () => this.setView('list');
  }
}

// Instantiate once DOM content is ready
document.addEventListener('DOMContentLoaded', () => {
  // Ensure your Supabase initialization is attempted (your script handles initialization)
  try { if (typeof initializeSupabase === 'function') initializeSupabase(); } catch(e){}

  if (document.getElementById('calendarApp')) {
    new ModernCalendar('calendarApp');
  }

  // If upcoming list exists, call refreshUpcomingEvents (provided previously)
  if (typeof refreshUpcomingEvents === 'function') {
    refreshUpcomingEvents();
  }
});

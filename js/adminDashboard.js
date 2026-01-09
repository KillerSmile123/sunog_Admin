// API_BASE is defined in config.js

// Use centralized auth helper if available
if (typeof AdminAuth !== 'undefined') {
  AdminAuth.requireAuth();
} else {
  fetch(`${API_BASE}/auth/verify`, { credentials: 'include' })
    .then(res => { if (!res.ok) window.location.href = 'adminLogin.html'; })
    .catch(() => { window.location.href = 'adminLogin.html'; });
}

// Map init
var map = L.map('map').setView([8.4859, 123.8048], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Dark mode toggle
const toggleBtn = document.getElementById('toggleTheme');
if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    toggleBtn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
  });
}

// -------- Fetch alerts from backend --------
async function fetchAlerts(retryCount = 0) {
  try {
    const controller = new AbortController();
    // Increase timeout to 90 seconds for Render spin-up
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    
    const response = await fetch(`${API_BASE}/get_alerts`, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.alerts || [];
  } catch (error) {
    console.error('Error fetching alerts (attempt ' + (retryCount + 1) + '):', error);
    
    // Retry once if it failed (for server wake-up)
    if (retryCount === 0 && (error.name === 'AbortError' || error.message.includes('Failed to fetch'))) {
      console.log('⏰ Server might be waking up, retrying in 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      return fetchAlerts(1); // Retry once
    }
    
    return [];
  }
}

async function updateDashboard() {
  const active = await fetchAlerts();
  let resolved = [];
  try {
    const r = await fetch(`${API_BASE}/get_resolved_alerts`, { method: 'GET', credentials: 'include' });
    if (r.ok) {
      const data = await r.json();
      resolved = data.resolved || [];
    } else {
      resolved = JSON.parse(localStorage.getItem('resolvedAlerts') || '[]');
    }
  } catch (err) {
    resolved = JSON.parse(localStorage.getItem('resolvedAlerts') || '[]');
  }
  const total = active.length + resolved.length;

  // Update stat cards
  const activeCountEl = document.getElementById("activeCount");
  const resolvedCountEl = document.getElementById("resolvedCount");
  const totalCountEl = document.getElementById("totalCount");
  
  if (activeCountEl) activeCountEl.textContent = active.length;
  if (resolvedCountEl) resolvedCountEl.textContent = resolved.length;
  if (totalCountEl) totalCountEl.textContent = total;

  // Update sidebar badge
  const badge = document.querySelector(".badge");
  if (badge) badge.textContent = active.length;

  // Fill recent alerts (last 5 active + resolved combined)
  const tableBody = document.getElementById("recentAlertsTable");
  if (tableBody) {
    tableBody.innerHTML = "";
    
    const combined = [
      ...active.map(a => ({...a, status:"Pending"})), 
      ...resolved.map(r => ({...r, status:"Resolved"}))
    ];
    
    combined.sort((a,b) => new Date(b.timestamp||b.resolvedAt) - new Date(a.timestamp||a.resolvedAt));

    combined.slice(0, 5).forEach((alert, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>#${alert.id || i+1}</td>
        <td>${alert.description || "No description"}</td>
        <td class="${alert.status==='Pending'?'status-pending':'status-resolved'}">${alert.status}</td>
        <td>${new Date(alert.timestamp || alert.resolvedAt).toLocaleString()}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // Draw route to latest active alert (if exists)
  if (active.length > 0) {
    const latestAlert = active[0]; // newest alert
    fetchAndDrawRoute('FireStation', latestAlert.location || 'Accident');
  }
}

// -------- Fetch and Draw Shortest Route --------
let currentRouteLine = null;
let startMarker = null;
let endMarker = null;

function fetchAndDrawRoute(start, end) {
  fetch(`${API_BASE}/get-shortest-route?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, {
    credentials: 'include'
  })
    .then(res => res.json())
    .then(coords => {
      if (!coords || coords.error) {
        console.error('No route found or error:', coords.error);
        return;
      }

      // Remove previous route if exists
      if (currentRouteLine) map.removeLayer(currentRouteLine);
      if (startMarker) map.removeLayer(startMarker);
      if (endMarker) map.removeLayer(endMarker);

      // Draw new polyline
      currentRouteLine = L.polyline(coords, {color: 'red'}).addTo(map);

      // Fit map to route
      map.fitBounds(currentRouteLine.getBounds());

      // Add markers
      startMarker = L.marker(coords[0]).addTo(map).bindPopup('Fire Station').openPopup();
      endMarker = L.marker(coords[coords.length - 1]).addTo(map).bindPopup('Accident').openPopup();
    })
    .catch(err => console.error('Fetch error:', err));
}

// Initial load
updateDashboard();

// Auto-refresh every 30 seconds
setInterval(updateDashboard, 30000);
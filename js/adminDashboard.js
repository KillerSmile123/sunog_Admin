// API Configuration

// Use centralized auth helper if available
if (typeof AdminAuth !== 'undefined') {
  AdminAuth.requireAuth();
} else {
  if (!localStorage.getItem('adminToken')) {
    window.location.href = 'adminLogin.html';
  }
}

// Map init
var map = L.map('map').setView([8.4859, 123.8048], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Dark mode toggle
const toggleBtn = document.getElementById('toggleTheme');
toggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  toggleBtn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
});

// -------- Dashboard Data Sync with localStorage --------
const LS_ACTIVE = "alertList";
const LS_RESOLVED = "resolvedAlerts";

function load(key) {
  return JSON.parse(localStorage.getItem(key) || "[]");
}

function updateDashboard() {
  const active = load(LS_ACTIVE);
  const resolved = load(LS_RESOLVED);
  const total = active.length + resolved.length;

  // Update stat cards
  document.getElementById("activeCount").textContent = active.length;
  document.getElementById("resolvedCount").textContent = resolved.length;
  document.getElementById("totalCount").textContent = total;

  // Update sidebar badge
  const badge = document.querySelector(".badge");
  if (badge) badge.textContent = active.length;

  // Fill recent alerts (last 5 active + resolved combined)
  const tableBody = document.getElementById("recentAlertsTable");
  tableBody.innerHTML = "";
  const combined = [...active.map(a => ({...a, status:"Pending"})), ...resolved.map(r => ({...r, status:"Resolved"}))];
  combined.sort((a,b)=> new Date(b.timestamp||b.resolvedAt) - new Date(a.timestamp||a.resolvedAt));

  combined.slice(0,5).forEach((alert, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>#${i+1}</td>
      <td>${alert.description || "No description"}</td>
      <td class="${alert.status==='Pending'?'status-pending':'status-resolved'}">${alert.status}</td>
      <td>${new Date(alert.timestamp || alert.resolvedAt).toLocaleString()}</td>
    `;
    tableBody.appendChild(tr);
  });

  // Draw route to latest active alert (if exists)
  if(active.length > 0){
    const latestAlert = active[0]; // newest alert
    fetchAndDrawRoute('FireStation', latestAlert.location || 'Accident'); // make sure your alert object has 'location'
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
      if(currentRouteLine) map.removeLayer(currentRouteLine);
      if(startMarker) map.removeLayer(startMarker);
      if(endMarker) map.removeLayer(endMarker);

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

// Auto-refresh every 10 seconds (update dashboard + route)
setInterval(updateDashboard, 10000);
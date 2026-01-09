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

// -------- Alert Markers Management --------
let alertMarkers = []; // Store all alert markers

// Function to clear all alert markers from map
function clearAlertMarkers() {
  alertMarkers.forEach(marker => map.removeLayer(marker));
  alertMarkers = [];
}

// Function to display all alerts on the map
async function displayAlertsOnMap(alerts) {
  // Clear existing markers
  clearAlertMarkers();

  if (!alerts || alerts.length === 0) {
    console.log('No alerts to display on map');
    return;
  }

  // Add marker for each alert
  for (const alert of alerts) {
    const coords = await parseAlertLocation(alert);
    
    if (coords) {
      // Create marker with red icon for active alerts
      const marker = L.marker([coords.lat, coords.lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(map);

      // Create popup content
      const popupContent = `
        <div style="min-width: 200px;">
          <h4 style="margin: 0 0 8px 0; color: #ff4444;">Alert #${alert.id || 'N/A'}</h4>
          <p style="margin: 4px 0;"><strong>Type:</strong> ${alert.type || 'Emergency'}</p>
          <p style="margin: 4px 0;"><strong>Description:</strong> ${alert.description || 'No description'}</p>
          <p style="margin: 4px 0;"><strong>Location:</strong> ${alert.location || 'Unknown'}</p>
          <p style="margin: 4px 0;"><strong>Time:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: orange;">Pending</span></p>
        </div>
      `;

      marker.bindPopup(popupContent);
      alertMarkers.push(marker);
    }
  }

  // Fit map to show all markers if there are any
  if (alertMarkers.length > 0) {
    const group = L.featureGroup(alertMarkers);
    map.fitBounds(group.getBounds().pad(0.1));
  }

  console.log(`Displayed ${alertMarkers.length} alerts on map`);
}

// Parse alert location to coordinates
async function parseAlertLocation(alert) {
  try {
    // Check if alert has direct coordinates
    if (alert.latitude && alert.longitude) {
      return {
        lat: parseFloat(alert.latitude),
        lng: parseFloat(alert.longitude)
      };
    }

    // Check if location is in "lat,lng" format
    if (alert.location && typeof alert.location === 'string' && alert.location.includes(',')) {
      const parts = alert.location.split(',');
      if (parts.length === 2) {
        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng };
        }
      }
    }

    // Try to geocode the location name
    if (alert.location && typeof alert.location === 'string') {
      return await geocodeLocation(alert.location);
    }

    // Default to center of Molave if no location found
    console.warn('No valid location for alert:', alert);
    return { lat: 8.4859, lng: 123.8048 }; // Molave center

  } catch (error) {
    console.error('Error parsing alert location:', error);
    return { lat: 8.4859, lng: 123.8048 }; // Molave center
  }
}

// Geocode location name to coordinates
async function geocodeLocation(locationName) {
  try {
    // Common locations in Molave
    const knownLocations = {
      'Molave': { lat: 8.4859, lng: 123.8048 },
      'Fire Station': { lat: 8.4859, lng: 123.8048 },
      'Town Plaza': { lat: 8.4859, lng: 123.8048 },
      'Municipal Hall': { lat: 8.4859, lng: 123.8048 }
    };

    if (knownLocations[locationName]) {
      return knownLocations[locationName];
    }

    // Use Nominatim geocoding service
    const query = encodeURIComponent(`${locationName}, Molave, Zamboanga del Sur, Philippines`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FireAlertSystem/1.0'
      }
    });
    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }

    // Fallback to Molave center
    console.warn(`Could not geocode ${locationName}, using Molave center`);
    return { lat: 8.4859, lng: 123.8048 };

  } catch (error) {
    console.error('Geocoding error:', error);
    return { lat: 8.4859, lng: 123.8048 };
  }
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

  // Display all active alerts on map
  displayAlertsOnMap(active);
}

// Initial load
updateDashboard();

// Auto-refresh every 5 seconds
setInterval(updateDashboard, 5000);
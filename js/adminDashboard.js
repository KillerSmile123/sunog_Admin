// adminDashboard.js - Fixed to match your HTML structure

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

// Alert Markers Management
let alertMarkers = [];

function clearAlertMarkers() {
  alertMarkers.forEach(marker => map.removeLayer(marker));
  alertMarkers = [];
}

async function displayAlertsOnMap(alerts) {
  clearAlertMarkers();

  if (!alerts || alerts.length === 0) {
    console.log('No alerts to display on map');
    return;
  }

  for (const alert of alerts) {
    const coords = await parseAlertLocation(alert);
    
    if (coords) {
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

      const popupContent = `
        <div style="min-width: 200px;">
          <h4 style="margin: 0 0 8px 0; color: #ff4444;">🔥 Alert #${alert.id || 'N/A'}</h4>
          <p style="margin: 4px 0;"><strong>Description:</strong> ${alert.description || 'No description'}</p>
          <p style="margin: 4px 0;"><strong>Location:</strong> ${alert.barangay || alert.location || 'Unknown'}</p>
          <p style="margin: 4px 0;"><strong>Reporter:</strong> ${alert.reporter_name || 'Anonymous'}</p>
          <p style="margin: 4px 0;"><strong>Time:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: ${alert.status === 'resolved' ? 'green' : 'orange'};">${alert.status || 'Pending'}</span></p>
        </div>
      `;

      marker.bindPopup(popupContent);
      alertMarkers.push(marker);
    }
  }

  if (alertMarkers.length > 0) {
    const group = L.featureGroup(alertMarkers);
    map.fitBounds(group.getBounds().pad(0.1));
  }

  console.log(`✅ Displayed ${alertMarkers.length} alerts on map`);
}

async function parseAlertLocation(alert) {
  try {
    // Priority 1: Use latitude and longitude if available
    if (alert.latitude && alert.longitude) {
      return {
        lat: parseFloat(alert.latitude),
        lng: parseFloat(alert.longitude)
      };
    }

    // Priority 2: Parse location string if it contains coordinates
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

    // Priority 3: Geocode barangay name
    if (alert.barangay && typeof alert.barangay === 'string') {
      return await geocodeLocation(alert.barangay);
    }

    // Priority 4: Geocode location string
    if (alert.location && typeof alert.location === 'string') {
      return await geocodeLocation(alert.location);
    }

    // Fallback: Molave center
    console.warn('⚠️ No valid location for alert:', alert);
    return { lat: 8.4859, lng: 123.8048 };

  } catch (error) {
    console.error('❌ Error parsing alert location:', error);
    return { lat: 8.4859, lng: 123.8048 };
  }
}

async function geocodeLocation(locationName) {
  try {
    const knownLocations = {
      'Molave': { lat: 8.4859, lng: 123.8048 },
      'Fire Station': { lat: 8.4859, lng: 123.8048 },
      'Town Plaza': { lat: 8.4859, lng: 123.8048 },
      'Municipal Hall': { lat: 8.4859, lng: 123.8048 }
    };

    if (knownLocations[locationName]) {
      return knownLocations[locationName];
    }

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

    console.warn(`⚠️ Could not geocode ${locationName}, using Molave center`);
    return { lat: 8.4859, lng: 123.8048 };

  } catch (error) {
    console.error('❌ Geocoding error:', error);
    return { lat: 8.4859, lng: 123.8048 };
  }
}

// ========================================
// FETCH ALERTS FROM BACKEND
// ========================================

async function fetchAlerts(retryCount = 0) {
  try {
    console.log('📡 Fetching alerts from backend...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    
    const response = await fetch(`${API_BASE}/get_alerts`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.alerts?.length || 0} alerts from backend`);
    return data.alerts || [];
  } catch (error) {
    console.error(`❌ Error fetching alerts (attempt ${retryCount + 1}):`, error);
    
    if (retryCount === 0 && (error.name === 'AbortError' || error.message.includes('Failed to fetch'))) {
      console.log('⏰ Server might be waking up, retrying in 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      return fetchAlerts(1);
    }
    
    return [];
  }
}

async function fetchResolvedAlerts() {
  try {
    console.log('📡 Fetching resolved alerts from backend...');
    
    const response = await fetch(`${API_BASE}/get_resolved_alerts`, { 
      method: 'GET', 
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.warn('⚠️ Failed to fetch resolved alerts from backend');
      return [];
    }
    
    const data = await response.json();
    console.log(`✅ Fetched ${data.resolved?.length || 0} resolved alerts from backend`);
    return data.resolved || [];
  } catch (error) {
    console.error('❌ Error fetching resolved alerts:', error);
    return [];
  }
}

// ========================================
// UPDATE DASHBOARD
// ========================================

async function updateDashboard() {
  console.log('🔄 Updating dashboard...');
  
  try {
    // Fetch all data from backend
    const active = await fetchAlerts();
    const resolved = await fetchResolvedAlerts();
    const total = active.length + resolved.length;

    console.log('📊 Dashboard stats:', { active: active.length, resolved: resolved.length, total });

    // Update stat cards
    const activeCountEl = document.getElementById("activeCount");
    const resolvedCountEl = document.getElementById("resolvedCount");
    const totalCountEl = document.getElementById("totalCount");
    
    if (activeCountEl) {
      activeCountEl.textContent = active.length;
      console.log('✅ Updated active count:', active.length);
    } else {
      console.error('❌ Element #activeCount not found!');
    }
    
    if (resolvedCountEl) {
      resolvedCountEl.textContent = resolved.length;
      console.log('✅ Updated resolved count:', resolved.length);
    } else {
      console.error('❌ Element #resolvedCount not found!');
    }
    
    if (totalCountEl) {
      totalCountEl.textContent = total;
      console.log('✅ Updated total count:', total);
    } else {
      console.error('❌ Element #totalCount not found!');
    }

    // Update sidebar badge
    const badge = document.querySelector(".badge");
    if (badge) {
      badge.textContent = active.length;
      console.log('✅ Updated sidebar badge:', active.length);
    }

    // Fill recent alerts table
    const tableBody = document.getElementById("recentAlertsTable");
    if (tableBody) {
      tableBody.innerHTML = "";
      
      if (active.length === 0 && resolved.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; padding: 40px; color: #666;">
              <div style="font-size: 48px; margin-bottom: 16px;">🔔</div>
              <div style="font-size: 16px;">No alerts to display</div>
            </td>
          </tr>
        `;
        console.log('ℹ️ No alerts to display in table');
      } else {
        const combined = [
          ...active.map(a => ({...a, status: a.status || "Pending"})), 
          ...resolved.map(r => ({...r, status: "Resolved"}))
        ];
        
        combined.sort((a, b) => 
          new Date(b.timestamp || b.resolvedAt || b.resolved_at) - 
          new Date(a.timestamp || a.resolvedAt || a.resolved_at)
        );

        combined.slice(0, 5).forEach((alert, i) => {
          const tr = document.createElement("tr");
          tr.style.cursor = "pointer";
          tr.onclick = () => window.location.href = `alerts.html?id=${alert.id}`;
          
          const statusClass = alert.status === 'Pending' || alert.status === 'Pending' 
            ? 'status-pending' 
            : 'status-resolved';
          
          const displayDate = alert.timestamp || alert.resolvedAt || alert.resolved_at;
          const formattedDate = displayDate 
            ? new Date(displayDate).toLocaleString() 
            : 'N/A';
          
          tr.innerHTML = `
            <td style="font-weight: 600;">#${alert.id || i + 1}</td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${alert.description || "No description"}
            </td>
            <td><span class="${statusClass}">${alert.status || 'Pending'}</span></td>
            <td>${formattedDate}</td>
          `;
          tableBody.appendChild(tr);
        });
        
        console.log(`✅ Rendered ${Math.min(combined.length, 5)} alerts in table`);
      }
    } else {
      console.error('❌ Element #recentAlertsTable not found!');
    }

    // Display all active alerts on map
    await displayAlertsOnMap(active);
    
    console.log('✅ Dashboard update complete!');
  } catch (error) {
    console.error('❌ Error updating dashboard:', error);
  }
}

// ========================================
// INITIALIZATION
// ========================================

console.log('🚀 Admin Dashboard initializing...');
console.log('📍 API Base:', API_BASE);

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM loaded, starting initial update...');
  updateDashboard();
});

// Also run immediately if DOM is already loaded
if (document.readyState === 'loading') {
  console.log('⏳ Waiting for DOM...');
} else {
  console.log('✅ DOM already loaded, starting initial update...');
  updateDashboard();
}

// Auto-refresh every 30 seconds (changed from 5 seconds to reduce server load)
setInterval(() => {
  console.log('🔄 Auto-refresh triggered...');
  updateDashboard();
}, 30000);

console.log('✅ Admin Dashboard script loaded!');
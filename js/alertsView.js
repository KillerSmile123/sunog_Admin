// API Configuration


// Use centralized auth helper if available
if (typeof AdminAuth !== 'undefined') {
  AdminAuth.requireAuth();
} else {
  if (!localStorage.getItem('adminToken')) {
    window.location.href = 'adminLogin.html';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("alerts-container");
  const badgeEl = document.querySelector(".badge");
  const fireStation = { lat: 8.476776975907958, lng: 123.7968330650085 };

  // ---------- Fetch alerts from backend ----------
  async function fetchAlerts() {
    try {
      const response = await fetch(`${API_BASE}/get_alerts`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.alerts || [];
    } catch (error) {
      console.error('Error fetching alerts:', error);
      alert('Failed to load alerts from server. Please refresh the page.');
      return [];
    }
  }

  function updateBadge(count) {
    if (badgeEl) badgeEl.textContent = count;
  }

  // ---------- UI ----------
  function mediaHTML(alert) {
    const API_URL = API_BASE; // For serving media files
    
    if (alert.photo_filename) {
      return `<img src="${API_URL}/uploads/${alert.photo_filename}" alt="Fire Image" class="media" style="max-width:100%;max-height:250px;border-radius:6px;">`;
    }
    if (alert.video_filename) {
      return `<video controls src="${API_URL}/uploads/${alert.video_filename}" style="max-width:100%;max-height:250px;border-radius:6px;"></video>`;
    }
    return "";
  }

  function haversineDistance(coord1, coord2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(coord2.lat - coord1.lat);
    const dLon = toRad(coord2.lng - coord1.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(coord1.lat)) *
        Math.cos(toRad(coord2.lat)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
  }

  async function render() {
    container.innerHTML = `<div class="info">Loading alerts...</div>`;
    
    const alerts = await fetchAlerts();
    container.innerHTML = "";

    if (alerts.length === 0) {
      container.innerHTML = `<div class="info">No alerts found.</div>`;
      updateBadge(0);
      return;
    }

    alerts.forEach((alert) => {
      const lat = parseFloat(alert.latitude);
      const lng = parseFloat(alert.longitude);
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
      const dist = hasCoords
        ? haversineDistance(fireStation, { lat, lng }) + " km"
        : "N/A";

      const card = document.createElement("div");
      card.className = "alert-card";
      card.dataset.id = alert.id; // Use database ID

      const mapId = "map-" + alert.id;

      card.innerHTML = `
        <div class="info"><strong>Alert ID:</strong> #${alert.id}</div>
        <div class="info"><strong>Reported:</strong> ${new Date(alert.timestamp).toLocaleString()}</div>
        <div class="info"><strong>Location:</strong> ${alert.latitude || "?"}, ${alert.longitude || "?"}</div>
        <div class="info"><strong>Distance:</strong> <span class="distance">${dist}</span></div>
        <div class="info"><strong>Description:</strong> ${alert.description || "No description"}</div>
        <div class="media-preview">${mediaHTML(alert)}</div>
        <div id="${mapId}" style="width:100%;height:200px;border-radius:8px;margin-top:10px;"></div>
        <div style="margin-top:10px;">
          <button type="button" class="resolve-btn" style="background:#e74c3c;color:#fff;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;">
            Resolve
          </button>
        </div>
      `;
      container.appendChild(card);

      if (hasCoords && window.L) {
        const map = L.map(mapId).setView([lat, lng], 14);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
        }).addTo(map);
        L.marker([fireStation.lat, fireStation.lng])
          .addTo(map)
          .bindPopup("Fire Station");
        L.marker([lat, lng]).addTo(map).bindPopup("Incident Location");
      }
    });

    updateBadge(alerts.length);
  }

  // ---------- event delegation for Resolve ----------
  container.addEventListener("click", async (e) => {
    const btn = e.target.closest(".resolve-btn");
    if (!btn) return;

    const card = btn.closest(".alert-card");
    if (!card) return;

    const alertId = card.dataset.id;

    // TODO: Call backend API to mark alert as resolved
    // For now, just remove from UI
    if (confirm('Mark this alert as resolved?')) {
      try {
        // You can add a /resolve_alert endpoint later
        // const response = await fetch(`${API_BASE}/resolve_alert/${alertId}`, {
        //   method: 'POST',
        //   credentials: 'include'
        // });
        
        // For now, just remove from UI and store in localStorage
        const resolved = JSON.parse(localStorage.getItem('resolvedAlerts') || '[]');
        const alertData = {
          id: alertId,
          resolvedAt: new Date().toISOString()
        };
        resolved.push(alertData);
        localStorage.setItem('resolvedAlerts', JSON.stringify(resolved));
        
        card.remove();
        
        // Update badge
        const remainingAlerts = document.querySelectorAll('.alert-card').length;
        updateBadge(remainingAlerts);
        
        alert('Alert marked as resolved!');
      } catch (error) {
        console.error('Error resolving alert:', error);
        alert('Failed to resolve alert. Please try again.');
      }
    }
  });

  // initial render
  render();

  // Auto-refresh every 30 seconds
  setInterval(render, 30000);
});
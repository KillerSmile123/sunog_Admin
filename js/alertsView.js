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

  // ✅ Function to generate reporter info header HTML
  function reporterHeaderHTML(alert) {
    const hasReporterInfo = alert.reporter_name || alert.barangay;
    
    if (!hasReporterInfo) {
      return `<div class="no-reporter-info">
        <i class="fas fa-info-circle"></i> Reporter information not available
      </div>`;
    }

    const reporterName = alert.reporter_name || 'Anonymous Reporter';
    const barangay = alert.barangay || 'Unknown Location';

    return `
      <div class="reporter-header">
        <div class="reporter-info">
          <h3 class="reporter-name">
            <i class="fas fa-user"></i> ${reporterName}
          </h3>
          <p class="reporter-barangay">
            <i class="fas fa-map-marker-alt"></i> Barangay ${barangay}
          </p>
        </div>
        <div style="font-size: 24px;">
          <i class="fas fa-fire"></i>
        </div>
      </div>
    `;
  }

  // ✅ Function to display incident photo/video
  function mediaHTML(alert) {
    // Use photo_url and video_url which contain Cloudinary URLs
    if (alert.photo_url) {
      return `<div class="media-preview">
        <img src="${alert.photo_url}" alt="Incident Photo" class="media">
      </div>`;
    }
    if (alert.video_url) {
      return `<div class="media-preview">
        <video controls src="${alert.video_url}" class="media"></video>
      </div>`;
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
      card.dataset.id = alert.id;

      const mapId = "map-" + alert.id;

      // ✅ Build card with reporter info at top and incident photo prominently displayed
      card.innerHTML = `
        ${reporterHeaderHTML(alert)}
        <div class="info"><strong>Alert ID:</strong> #${alert.id}</div>
        <div class="info"><strong>Reported:</strong> ${new Date(alert.timestamp).toLocaleString()}</div>
        <div class="info"><strong>Description:</strong> ${alert.description || "No description"}</div>
        ${mediaHTML(alert)}
        <div class="info"><strong>Location:</strong> ${alert.latitude || "?"}, ${alert.longitude || "?"}</div>
        <div class="info"><strong>Distance from Fire Station:</strong> <span class="distance">${dist}</span></div>
        <div id="${mapId}" style="width:100%;height:200px;border-radius:8px;margin-top:10px;"></div>
        <div style="margin-top:15px;">
          <button type="button" class="resolve-btn">
            <i class="fas fa-check"></i> Mark as Resolved
          </button>
        </div>
      `;
      container.appendChild(card);

      // Initialize map if coordinates are valid
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

    if (confirm('Mark this alert as resolved?')) {
      try {
        const res = await fetch(`${API_BASE}/resolve_alert/${encodeURIComponent(alertId)}`, {
          method: 'POST',
          credentials: 'include'
        });

        if (res.ok) {
          card.remove();
          const remainingAlerts = document.querySelectorAll('.alert-card').length;
          updateBadge(remainingAlerts);
          alert('Alert marked as resolved!');
          return;
        }

        throw new Error('server');
      } catch (error) {
        // fallback to storing resolved state locally
        try {
          const resolved = JSON.parse(localStorage.getItem('resolvedAlerts') || '[]');
          resolved.push({ id: alertId, resolvedAt: new Date().toISOString() });
          localStorage.setItem('resolvedAlerts', JSON.stringify(resolved));

          card.remove();
          const remainingAlerts = document.querySelectorAll('.alert-card').length;
          updateBadge(remainingAlerts);
          alert('Alert marked as resolved (local fallback).');
        } catch (err) {
          console.error('Error resolving alert:', err);
          alert('Failed to resolve alert. Please try again.');
        }
      }
    }
  });

  // initial render
  render();

  // Auto-refresh every 30 seconds
  setInterval(render, 30000);
});
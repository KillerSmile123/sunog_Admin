// API Configuration

// Use centralized auth helper if available
if (typeof AdminAuth !== 'undefined') {
  AdminAuth.requireAuth();
} else {
  // Fallback: verify session with backend once
  fetch(`${API_BASE}/auth/verify`, { credentials: 'include' })
    .then(res => { if (!res.ok) window.location.href = 'adminLogin.html'; })
    .catch(() => { window.location.href = 'adminLogin.html'; });
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("alerts-container");
  const badgeEl = document.querySelector(".badge");
  const fireStation = { lat: 8.476776975907958, lng: 123.7968330650085 };

  // ---------- Fetch alerts from backend with retry logic ----------
  async function fetchAlerts(retryCount = 0) {
    const maxRetries = 3;
    
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
      console.error(`Error fetching alerts (attempt ${retryCount + 1}/${maxRetries}):`, error);
      
      // Retry if we haven't exceeded max retries
      if (retryCount < maxRetries - 1) {
        console.log(`Retrying in ${(retryCount + 1) * 2} seconds...`);
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
        return fetchAlerts(retryCount + 1);
      }
      
      // Show user-friendly error after all retries failed
      container.innerHTML = `
        <div class="info" style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px;">
          <i class="fas fa-exclamation-triangle"></i> 
          <strong>Connection Error</strong><br>
          Unable to load alerts. The server might be starting up.
          <br><br>
          <button onclick="location.reload()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
            <i class="fas fa-sync"></i> Retry Now
          </button>
        </div>
      `;
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

  // ✅ Function to display incident photo/video with better error handling
  function mediaHTML(alert) {
    // Helper function to get full URL
    function getMediaURL(url) {
      if (!url) return null;
      
      // If it's already a full URL (Cloudinary), use it
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      
      // No valid URL
      return null;
    }

    const photoURL = getMediaURL(alert.photo_url);
    const videoURL = getMediaURL(alert.video_url);

    if (photoURL) {
      return `<div class="media-preview">
        <img src="${photoURL}" alt="Incident Photo" class="media" 
             onerror="this.parentElement.innerHTML='<div style=\\'padding:20px;text-align:center;color:#999;background:#f8f9fa;border-radius:8px;\\'>📷 Image could not be loaded</div>'"
             onload="console.log('✅ Image loaded successfully')">
      </div>`;
    }
    if (videoURL) {
      return `<div class="media-preview">
        <video controls src="${videoURL}" class="media" 
               onerror="this.parentElement.innerHTML='<div style=\\'padding:20px;text-align:center;color:#999;background:#f8f9fa;border-radius:8px;\\'>🎥 Video could not be loaded</div>'"></video>
      </div>`;
    }
    
    // No media provided - this is normal
    return `<div class="media-preview" style="padding:20px;text-align:center;color:#999;background:#f8f9fa;border-radius:8px;margin:10px 0;">
      📷 No photo or video submitted
    </div>`;
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
    container.innerHTML = `
      <div class="info" style="text-align: center; padding: 20px;">
        <i class="fas fa-spinner fa-spin"></i> Loading alerts...
      </div>
    `;
    
    const alerts = await fetchAlerts();
    container.innerHTML = "";

    if (alerts.length === 0) {
      container.innerHTML = `
        <div class="info" style="text-align: center; padding: 40px; color: #6c757d;">
          <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
          <h3 style="margin: 0;">No Active Alerts</h3>
          <p style="margin: 10px 0 0 0;">All clear! No fire incidents reported.</p>
        </div>
      `;
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
        setTimeout(() => {
          try {
            const map = L.map(mapId).setView([lat, lng], 14);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
              attribution: "© OpenStreetMap contributors",
            }).addTo(map);
            L.marker([fireStation.lat, fireStation.lng])
              .addTo(map)
              .bindPopup("Fire Station");
            L.marker([lat, lng]).addTo(map).bindPopup("Incident Location");
          } catch (mapError) {
            console.error('Map initialization error:', mapError);
            document.getElementById(mapId).innerHTML = '<div style="padding:20px;text-align:center;color:#999;">Map could not be loaded</div>';
          }
        }, 100);
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
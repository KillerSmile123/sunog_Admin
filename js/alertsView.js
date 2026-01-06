// ========================================
// AUTHENTICATION CHECK
// ========================================

// Use centralized auth helper if available
if (typeof AdminAuth !== 'undefined') {
  AdminAuth.requireAuth();
} else {
  // Fallback: verify session with backend once
  fetch(`${API_BASE}/auth/verify`, { credentials: 'include' })
    .then(res => { if (!res.ok) window.location.href = 'adminLogin.html'; })
    .catch(() => { window.location.href = 'adminLogin.html'; });
}

// ========================================
// MAIN APPLICATION
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("alerts-container");
  const badgeEl = document.querySelector(".badge");
  const fireStation = { lat: 8.476776975907958, lng: 123.7968330650085 };

  // Current alert data for modal operations
  let currentAlertData = null;

  // ========================================
  // MODAL FUNCTIONS (Global Scope)
  // ========================================

  window.openRespondModal = (alertId, reporterName, barangay) => {
    currentAlertData = { id: alertId, reporterName, barangay };
    const modal = document.getElementById('respond-modal');
    const infoEl = document.getElementById('respond-alert-info');
    infoEl.innerHTML = `Responding to alert from <strong>${reporterName}</strong> in <strong>Barangay ${barangay}</strong>`;
    document.getElementById('response-message').value = '';
    modal.classList.add('active');
  };

  window.closeRespondModal = () => {
    document.getElementById('respond-modal').classList.remove('active');
    currentAlertData = null;
  };

  window.openResolveModal = (alertId, reporterName, barangay) => {
    currentAlertData = { id: alertId, reporterName, barangay };
    const modal = document.getElementById('resolve-modal');
    const infoEl = document.getElementById('resolve-alert-info');
    infoEl.innerHTML = `Mark alert from <strong>${reporterName}</strong> in <strong>Barangay ${barangay}</strong> as resolved`;
    document.getElementById('resolve-time').value = '';
    modal.classList.add('active');
  };

  window.closeResolveModal = () => {
    document.getElementById('resolve-modal').classList.remove('active');
    currentAlertData = null;
  };

  window.sendResponse = async () => {
    if (!currentAlertData) return;
    
    const message = document.getElementById('response-message').value.trim();
    if (!message) {
      alert('Please enter a response message');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/respond_alert`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_id: currentAlertData.id,
          message: message
        })
      });

      if (res.ok) {
        closeRespondModal();
        alert('Response sent successfully! User has been notified.');
        render();
      } else {
        throw new Error('Failed to send response');
      }
    } catch (error) {
      console.error('Error sending response:', error);
      alert('Failed to send response. Please try again.');
    }
  };

  window.markAsResolved = async () => {
    if (!currentAlertData) return;
    
    const resolveTime = document.getElementById('resolve-time').value;
    if (!resolveTime) {
      alert('Please enter the time when the fire was resolved');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/resolve_alert_with_time`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_id: currentAlertData.id,
          resolve_time: resolveTime
        })
      });

      if (res.ok) {
        closeResolveModal();
        alert('Alert marked as resolved! User has been notified.');
        const card = document.querySelector(`[data-id="${currentAlertData.id}"]`);
        if (card) card.remove();
        const remainingAlerts = document.querySelectorAll('.alert-card').length;
        updateBadge(remainingAlerts);
      } else {
        throw new Error('Failed to resolve alert');
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
      alert('Failed to resolve alert. Please try again.');
    }
  };

  window.deleteAlert = async (alertId, reporterName) => {
    if (!confirm(`Are you sure you want to delete the alert from ${reporterName}?\n\nThe user will be notified that their alert has been removed.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/delete_alert/${encodeURIComponent(alertId)}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        alert('Alert deleted successfully! User has been notified.');
        const card = document.querySelector(`[data-id="${alertId}"]`);
        if (card) card.remove();
        const remainingAlerts = document.querySelectorAll('.alert-card').length;
        updateBadge(remainingAlerts);
      } else {
        throw new Error('Failed to delete alert');
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
      alert('Failed to delete alert. Please try again.');
    }
  };

  // ========================================
  // API FUNCTIONS
  // ========================================

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
      
      if (retryCount < maxRetries - 1) {
        console.log(`Retrying in ${(retryCount + 1) * 2} seconds...`);
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
        return fetchAlerts(retryCount + 1);
      }
      
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

  // ========================================
  // UI HELPER FUNCTIONS
  // ========================================

  function updateBadge(count) {
    if (badgeEl) badgeEl.textContent = count;
  }

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

  function mediaHTML(alert) {
    function getMediaURL(url) {
      if (!url) return null;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
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

  // ========================================
  // RENDER FUNCTION
  // ========================================

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
      const reporterName = alert.reporter_name || 'Anonymous Reporter';
      const barangay = alert.barangay || 'Unknown Location';

      card.innerHTML = `
        ${reporterHeaderHTML(alert)}
        <div class="info"><strong>Alert ID:</strong> #${alert.id}</div>
        <div class="info"><strong>Reported:</strong> ${new Date(alert.timestamp).toLocaleString()}</div>
        <div class="info"><strong>Description:</strong> ${alert.description || "No description"}</div>
        ${mediaHTML(alert)}
        <div class="info"><strong>Location:</strong> ${alert.latitude || "?"}, ${alert.longitude || "?"}</div>
        <div class="info"><strong>Distance from Fire Station:</strong> <span class="distance">${dist}</span></div>
        <div id="${mapId}" style="width:100%;height:200px;border-radius:8px;margin-top:10px;"></div>
        <div class="action-buttons">
          <button class="action-btn btn-respond" onclick="openRespondModal('${alert.id}', '${reporterName.replace(/'/g, "\\'")}', '${barangay.replace(/'/g, "\\'")}')">
            <i class="fas fa-reply"></i> Respond
          </button>
          <button class="action-btn btn-resolve" onclick="openResolveModal('${alert.id}', '${reporterName.replace(/'/g, "\\'")}', '${barangay.replace(/'/g, "\\'")}')">
            <i class="fas fa-check-circle"></i> Resolve
          </button>
          <button class="action-btn btn-delete" onclick="deleteAlert('${alert.id}', '${reporterName.replace(/'/g, "\\'")}')">
            <i class="fas fa-trash"></i> Delete
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

  // ========================================
  // INITIALIZE
  // ========================================

  // Initial render
  render();

  // Auto-refresh every 30 seconds
  setInterval(render, 30000);
});
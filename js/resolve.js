// resolve.js - Resolved Alerts View Logic

// AUTHENTICATION CHECK
if (typeof AdminAuth !== 'undefined') {
  AdminAuth.requireAuth();
} else {
  fetch(`${API_BASE}/auth/verify`, { credentials: 'include' })
    .then(res => { if (!res.ok) window.location.href = 'adminLogin.html'; })
    .catch(() => { window.location.href = 'adminLogin.html'; });
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("resolved-container");
  const fireStation = { lat: 8.476723719070502, lng: 123.7970718508905 };
  
  let currentUnresolveData = null;

  // ========================================
  // MODAL FUNCTIONS
  // ========================================

  window.openUnresolveModal = (alertId, reporterName, barangay) => {
    currentUnresolveData = { id: alertId, reporterName, barangay };
    const modal = document.getElementById('unresolve-modal');
    const infoEl = document.getElementById('unresolve-alert-info');
    infoEl.innerHTML = `Move alert from <strong>${reporterName}</strong> in <strong>Barangay ${barangay}</strong> back to active alerts?`;
    modal.classList.add('active');
  };

  window.closeUnresolveModal = () => {
    document.getElementById('unresolve-modal').classList.remove('active');
    currentUnresolveData = null;
  };

  window.confirmUnresolve = async () => {
    if (!currentUnresolveData?.id) {
      alert('Error: Alert data not found.');
      closeUnresolveModal();
      return;
    }

    const unresolveBtn = document.querySelector('#unresolve-modal .btn-primary');
    if (unresolveBtn) {
      unresolveBtn.disabled = true;
      unresolveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }

    try {
      const res = await fetch(`${API_BASE}/unresolve_alert/${encodeURIComponent(currentUnresolveData.id)}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (res.ok) {
        closeUnresolveModal();
        alert('Alert moved back to active alerts!');
        render();
        updateBadges();
      } else {
        throw new Error('Failed to unresolve alert');
      }
    } catch (error) {
      console.error('Error unresolving alert:', error);
      alert('Failed to unresolve alert. Please try again.');
      
      if (unresolveBtn) {
        unresolveBtn.disabled = false;
        unresolveBtn.innerHTML = '<i class="fas fa-undo"></i> Unresolve Alert';
      }
    }
  };

  // ========================================
  // MAP FUNCTIONS
  // ========================================

  window.loadMap = async (mapId, alertLat, alertLng) => {
    const mapDiv = document.getElementById(mapId);
    mapDiv.innerHTML = '<div style="padding:20px;text-align:center;"><i class="fas fa-spinner fa-spin"></i> Loading map...</div>';
    
    setTimeout(async () => {
      try {
        const map = L.map(mapId).setView([alertLat, alertLng], 14);
        
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
        }).addTo(map);
        
        // Add Fire Station marker (green)
        L.marker([fireStation.lat, fireStation.lng], {
          icon: L.divIcon({
            className: 'custom-fire-station-marker',
            html: '<div style="background: #28a745; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"><i class="fas fa-fire-extinguisher"></i></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          })
        }).addTo(map).bindPopup("<b>🚒 Fire Station</b>");
        
        // Add Incident marker (resolved - blue)
        L.marker([alertLat, alertLng], {
          icon: L.divIcon({
            className: 'custom-incident-marker',
            html: '<div style="background: #007bff; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"><i class="fas fa-check-circle"></i></div>',
            iconSize: [35, 35],
            iconAnchor: [17.5, 17.5]
          })
        }).addTo(map).bindPopup("<b>✅ Resolved Incident</b>");
        
        // Fit bounds to show both markers
        const bounds = L.latLngBounds(
          [fireStation.lat, fireStation.lng],
          [alertLat, alertLng]
        );
        map.fitBounds(bounds, { padding: [50, 50] });
        
      } catch (mapError) {
        console.error('Map initialization error:', mapError);
        document.getElementById(mapId).innerHTML = '<div style="padding:20px;text-align:center;color:#999;">Map could not be loaded</div>';
      }
    }, 100);
  };

  // ========================================
  // API FUNCTIONS
  // ========================================

  async function fetchResolvedAlerts() {
    try {
      const response = await fetch(`${API_BASE}/get_resolved_alerts`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`📋 Retrieved ${data.count || data.resolved?.length || 0} resolved alerts`);
      
      return data.resolved || [];
      
    } catch (error) {
      console.error('❌ Error fetching resolved alerts:', error);
      
      container.innerHTML = `
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <div style="display: flex; align-items: start; gap: 15px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 24px; color: #ff9800; margin-top: 2px;"></i>
            <div style="flex: 1;">
              <strong style="font-size: 18px; display: block; margin-bottom: 10px;">Unable to Load Resolved Alerts</strong>
              <p style="margin: 8px 0;">There was an error connecting to the server. Please check your connection and try again.</p>
              <button onclick="location.reload()" 
                      style="padding: 10px 20px; background: #007bff; color: white; border: none; 
                             border-radius: 6px; cursor: pointer; font-weight: 500; margin-top: 10px;">
                <i class="fas fa-sync"></i> Retry
              </button>
            </div>
          </div>
        </div>
      `;
      
      return [];
    }
  }

  // ========================================
  // UI HELPER FUNCTIONS
  // ========================================

  function reporterHeaderHTML(alert) {
    const reporterName = alert.reporter_name || 'Anonymous Reporter';
    const barangay = alert.barangay || 'Unknown Location';

    return `
      <div class="resolved-header">
        <div class="reporter-info">
          <h3 class="reporter-name">
            <i class="fas fa-user"></i> ${reporterName}
          </h3>
          <p class="reporter-barangay">
            <i class="fas fa-map-marker-alt"></i> Barangay ${barangay}
          </p>
        </div>
        <div class="resolved-badge">
          <i class="fas fa-check-circle"></i> RESOLVED
        </div>
      </div>
    `;
  }

  function mediaHTML(alert) {
    let photoUrls = [];
    if (alert.photo_urls && Array.isArray(alert.photo_urls)) {
      photoUrls = alert.photo_urls;
    } else if (alert.photo_url) {
      photoUrls = [alert.photo_url];
    }

    let videoUrls = [];
    if (alert.video_urls && Array.isArray(alert.video_urls)) {
      videoUrls = alert.video_urls;
    } else if (alert.video_url) {
      videoUrls = [alert.video_url];
    }

    let html = '';

    if (photoUrls.length > 0) {
      html += `<div class="media-gallery" style="margin: 10px 0;">`;
      
      if (photoUrls.length === 1) {
        html += `
          <div class="media-preview">
            <img src="${photoUrls[0]}" alt="Incident Photo" class="media" loading="lazy"
                 onclick="openImageModal('${photoUrls[0]}')"
                 style="cursor: pointer;"
                 onerror="this.parentElement.innerHTML='<div style=\\'padding:20px;text-align:center;color:#999;background:#f8f9fa;border-radius:8px;\\'>📷 Image could not be loaded</div>'">
          </div>
        `;
      } else {
        html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">`;
        photoUrls.forEach((url, index) => {
          html += `
            <div class="media-preview" style="position: relative;">
              <img src="${url}" alt="Photo ${index + 1}" 
                   style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; cursor: pointer;"
                   onclick="openImageModal('${url}')"
                   loading="lazy"
                   onerror="this.style.display='none'">
              <div style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                ${index + 1}/${photoUrls.length}
              </div>
            </div>
          `;
        });
        html += `</div>`;
      }
      html += `</div>`;
    }
    
    if (videoUrls.length > 0) {
      html += `<div class="video-gallery" style="margin: 10px 0;">`;
      videoUrls.forEach((url, index) => {
        html += `
          <div class="media-preview" style="margin-bottom: 10px;">
            <div style="background: rgba(0,0,0,0.7); color: white; padding: 6px 12px; border-radius: 4px 4px 0 0; font-size: 12px;">
              <i class="fas fa-video"></i> Video ${index + 1}/${videoUrls.length}
            </div>
            <video controls src="${url}" class="media" preload="metadata" style="width: 100%; border-radius: 0 0 8px 8px;"
                   onerror="this.parentElement.innerHTML='<div style=\\'padding:20px;text-align:center;color:#999;background:#f8f9fa;border-radius:8px;\\'>🎥 Video could not be loaded</div>'"></video>
          </div>
        `;
      });
      html += `</div>`;
    }
    
    if (!photoUrls.length && !videoUrls.length) {
      html = `<div class="media-preview" style="padding:20px;text-align:center;color:#999;background:#f8f9fa;border-radius:8px;margin:10px 0;">
        📷 No media submitted
      </div>`;
    }

    return html;
  }

  window.openImageModal = (imageUrl) => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      cursor: pointer;
    `;
    
    modal.innerHTML = `
      <img src="${imageUrl}" style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
      <button style="position: absolute; top: 20px; right: 20px; background: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">×</button>
    `;
    
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
  };

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
    // Show loading state
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #6c757d;">
        <i class="fas fa-spinner fa-spin" style="font-size: 48px; margin-bottom: 15px;"></i>
        <h3>Loading resolved alerts...</h3>
      </div>
    `;

    const resolvedAlerts = await fetchResolvedAlerts();
    
    if (resolvedAlerts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-check-circle"></i>
          <h3>No Resolved Alerts</h3>
          <p>Resolved fire incidents will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";

    resolvedAlerts.forEach((alert) => {
  const card = document.createElement("div");
  card.className = "resolved-card";
  
  // FIX: Sanitize alert.id to remove special characters
  const sanitizedId = String(alert.id).replace(/[^a-zA-Z0-9-_]/g, '');
  card.dataset.id = sanitizedId;

  const reporterName = alert.reporter_name || 'Anonymous Reporter';
  const barangay = alert.barangay || 'Unknown Location';
  const reportedTime = new Date(alert.timestamp).toLocaleString();
  const resolvedTime = alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleString() : 'Unknown';
  const resolveTimeCustom = alert.resolve_time || 'Not specified';

  const lat = parseFloat(alert.latitude);
  const lng = parseFloat(alert.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const dist = hasCoords
    ? haversineDistance(fireStation, { lat, lng }) + " km"
    : "N/A";

  // FIX: Use sanitized ID for map
  const mapId = "map-" + sanitizedId;

  card.innerHTML = `
    ${reporterHeaderHTML(alert)}
    
    <div class="info"><strong>Alert ID:</strong> #${alert.id}</div>
    <div class="info"><strong>Description:</strong> ${alert.description || "No description"}</div>
    ${mediaHTML(alert)}
    <div class="info"><strong>Location:</strong> ${alert.latitude || "?"}, ${alert.longitude || "?"}</div>
    <div class="info"><strong>Distance from Fire Station:</strong> <span class="distance">${dist}</span></div>
    
    <div class="resolved-timestamp">
      <div class="info">
        <i class="fas fa-clock"></i>
        <strong>Reported:</strong> ${reportedTime}
      </div>
      <div class="info">
        <i class="fas fa-check-circle"></i>
        <strong>Resolved:</strong> ${resolvedTime}
      </div>
      <div class="info">
        <i class="fas fa-fire-extinguisher"></i>
        <strong>Extinguished:</strong> ${resolveTimeCustom}
      </div>
    </div>

    <div id="${mapId}" class="map-container" style="height:300px;border-radius:8px;margin-top:15px;background:#e9ecef;display:flex;align-items:center;justify-content:center;">
      ${hasCoords ? `
        <button onclick="loadMap('${mapId}', ${lat}, ${lng})" 
                style="padding:12px 24px;background:#007bff;color:white;border:none;border-radius:6px;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.15);font-weight:500;transition:all 0.2s;"
                onmouseover="this.style.background='#0056b3'"
                onmouseout="this.style.background='#007bff'">
          <i class="fas fa-map-marked-alt"></i> Show Location Map
        </button>
      ` : '<div style="color:#6c757d;">Invalid coordinates</div>'}
    </div>

    <div class="action-buttons">
      <button class="action-btn btn-unresolve" onclick="openUnresolveModal('${alert.id}', '${reporterName.replace(/'/g, "\\'")}', '${barangay.replace(/'/g, "\\'")}')">
        <i class="fas fa-undo"></i> Move to Active Alerts
      </button>
    </div>
  `;
  
  container.appendChild(card);
});
  }

  // ========================================
  // UPDATE BADGES
  // ========================================
  
  async function updateBadges() {
    try {
      // Update alerts badge
      const alertsResponse = await fetch(`${API_BASE}/get_alerts`, {
        method: 'GET',
        credentials: 'include'
      });

      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        const alertsBadge = document.querySelector('.nav a[href="alerts.html"] .badge');
        if (alertsBadge) {
          alertsBadge.textContent = alertsData.count || alertsData.alerts?.length || 0;
        }
      }

      // Update spam badge
      const spamResponse = await fetch(`${API_BASE}/get_spam_alerts`, {
        method: 'GET',
        credentials: 'include'
      });

      if (spamResponse.ok) {
        const spamData = await spamResponse.json();
        const spamBadge = document.querySelector('.nav a[href="spam.html"] .badge');
        if (spamBadge) {
          spamBadge.textContent = spamData.count || spamData.spam?.length || 0;
        }
      }
    } catch (error) {
      console.error('Error updating badges:', error);
    }
  }

  // ========================================
  // LOGOUT FUNCTION
  // ========================================

  window.logout = () => {
    if (confirm('Are you sure you want to logout?')) {
      // Clear any stored credentials
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      window.location.href = 'adminLogin.html';
    }
  };

  // ========================================
  // INITIALIZE
  // ========================================

  render();
  updateBadges();
  
  // Auto-refresh every 30 seconds
  setInterval(() => {
    render();
    updateBadges();
  }, 30000);
});
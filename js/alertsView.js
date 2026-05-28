// alertsView.js - Admin Alerts View with Dijkstra Route Display

// AUTHENTICATION CHECK
if (typeof AdminAuth !== 'undefined') {
  AdminAuth.requireAuth();
} else {
  fetch(`${API_BASE}/auth/verify`, { credentials: 'include' })
    .then(res => { if (!res.ok) window.location.href = 'adminLogin.html'; })
    .catch(() => { window.location.href = 'adminLogin.html'; });
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("alerts-container");
  const badgeEl = document.querySelector(".badge");
  const fireStation = { lat: 8.476723719070502, lng: 123.7970718508905 };

  let currentAlertData = null;
  let currentAlertIds = [];
  let activeMapRoutes = {}; // Store active route layers per map

  // ========================================
  // MODAL FUNCTIONS
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
    const sendBtn = document.querySelector('#respond-modal .btn-primary');
    if (sendBtn && sendBtn.disabled) return;

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    }

    if (!currentAlertData?.id) {
      alert('Error: Alert data not found.');
      closeRespondModal();
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Response';
      }
      return;
    }

    const message = document.getElementById('response-message').value.trim();
    if (!message) {
      alert('Please enter a response message');
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Response';
      }
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

      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Response';
      }
    }
  };

  window.markAsResolved = async () => {
    if (!currentAlertData?.id) {
      alert('Error: Alert data not found. Please close and reopen the modal.');
      closeResolveModal();
      return;
    }

    const resolveTime = document.getElementById('resolve-time').value;
    if (!resolveTime) {
      alert('Please enter the time when the fire was resolved');
      return;
    }

    const resolveBtn = document.querySelector('#resolve-modal button[onclick*="markAsResolved"]');
    if (resolveBtn) {
      resolveBtn.disabled = true;
      resolveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resolving...';
    }

    const alertId = currentAlertData.id;

    try {
      const res = await fetch(`${API_BASE}/resolve_alert_with_time`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_id: alertId,
          resolve_time: resolveTime
        })
      });

      if (res.ok) {
        closeResolveModal();
        alert('Alert marked as resolved! User has been notified.');
        const card = document.querySelector(`[data-id="${alertId}"]`);
        if (card) card.remove();
        const remainingAlerts = document.querySelectorAll('.alert-card').length;
        updateBadge(remainingAlerts);
        currentAlertIds = currentAlertIds.filter(id => id !== alertId);
      } else {
        throw new Error('Failed to resolve alert');
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
      alert('Failed to resolve alert. Please try again.');

      if (resolveBtn) {
        resolveBtn.disabled = false;
        resolveBtn.innerHTML = '<i class="fas fa-check-circle"></i> Mark as Resolved';
      }
    }
  };

  window.markAsSpam = async (alertId, reporterName) => {
    if (!confirm(`Are you sure you want to mark the alert from ${reporterName} as spam?\n\nThe user will be notified that their alert has been marked as spam.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/mark_spam/${encodeURIComponent(alertId)}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (res.ok) {
        alert('Alert marked as spam successfully! User has been notified.');
        const card = document.querySelector(`[data-id="${alertId}"]`);
        if (card) card.remove();
        const remainingAlerts = document.querySelectorAll('.alert-card').length;
        updateBadge(remainingAlerts);
        currentAlertIds = currentAlertIds.filter(id => id !== alertId);
      } else {
        throw new Error('Failed to mark alert as spam');
      }
    } catch (error) {
      console.error('Error marking alert as spam:', error);
      alert('Failed to mark alert as spam. Please try again.');
    }
  };

  // ========================================
  // MAP & ROUTE FUNCTIONS
  // ========================================

  window.loadMap = async (mapId, lat, lng) => {
    const mapDiv = document.getElementById(mapId);
    mapDiv.innerHTML = '<div style="padding:20px;text-align:center;"><i class="fas fa-spinner fa-spin"></i> Loading map and calculating route...</div>';

    setTimeout(async () => {
      try {
        const map = L.map(mapId).setView([lat, lng], 14);

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
        }).addTo(map).bindPopup("<b>🚒 Fire Station</b><br>Starting Point");

        // Add Incident marker (red)
        L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'custom-incident-marker',
            html: '<div style="background: #dc3545; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); animation: pulse 2s infinite;"><i class="fas fa-fire"></i></div>',
            iconSize: [35, 35],
            iconAnchor: [17.5, 17.5]
          })
        }).addTo(map).bindPopup("<b>🔥 Fire Incident</b><br>Destination");

        // Fetch and display route
        await loadRoute(map, mapId, lat, lng);

      } catch (mapError) {
        console.error('Map initialization error:', mapError);
        document.getElementById(mapId).innerHTML = '<div style="padding:20px;text-align:center;color:#999;">Map could not be loaded</div>';
      }
    }, 100);
  };

  async function loadRoute(map, mapId, alertLat, alertLng) {
    try {
      console.log(`🗺️ Fetching route from OpenRouteService...`);

      const response = await fetch(
        `${API_BASE}/get_alert_route?lat=${alertLat}&lng=${alertLng}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.route) {
        throw new Error('No route data received');
      }

      console.log(`✅ Route: ${data.total_distance} km, ETA: ${data.estimated_duration} min`);

      // Convert route to Leaflet format
      const routeLatLngs = data.route.map(point => [point.lat, point.lng]);

      // Draw route polyline
      const routeLayer = L.polyline(routeLatLngs, {
        color: '#dc3545',
        weight: 5,
        opacity: 0.8,
        dashArray: '10, 10',
        lineJoin: 'round'
      }).addTo(map);

      // Fit map to show entire route
      map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

      // Add distance info panel
      const distanceInfo = L.control({ position: 'bottomright' });
      distanceInfo.onAdd = function () {
        const div = L.DomUtil.create('div', 'route-info-panel');
        div.innerHTML = `
                <div style="background: white; padding: 12px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-size: 13px;">
                    <div style="font-weight: bold; margin-bottom: 6px; color: #dc3545;">
                        <i class="fas fa-route"></i> Route Info
                    </div>
                    <div style="color: #666;">
                        <i class="fas fa-road"></i> Distance: <strong>${data.total_distance} km</strong>
                    </div>
                    <div style="color: #666; margin-top: 4px;">
                        <i class="fas fa-clock"></i> ETA: <strong>${data.estimated_duration} min</strong>
                    </div>
                    <div style="color: #999; font-size: 11px; margin-top: 8px; border-top: 1px solid #eee; padding-top: 6px;">
                        <i class="fas fa-map"></i> OpenStreetMap data
                    </div>
                </div>
            `;
        return div;
      };
      distanceInfo.addTo(map);

    } catch (error) {
      console.error('❌ Error loading route:', error);

      // Show error notification on map
      const errorControl = L.control({ position: 'topright' });
      errorControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'route-error');
        div.innerHTML = `
            <div style="background: #fff3cd; padding: 10px; border-radius: 6px; border-left: 4px solid #ffc107; font-size: 12px; max-width: 250px;">
              <i class="fas fa-exclamation-triangle"></i> <strong>Route Unavailable</strong><br>
              <span style="color: #666;">Could not calculate route to this location</span>
            </div>
        `;
        return div;
      };
      errorControl.addTo(map);
    }
  }

  // ========================================
  // API FUNCTIONS
  // ========================================

  async function fetchAlerts(retryCount = 0) {
    const maxRetries = 3;
    const baseDelay = 2000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

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

      const errorMsg = container.querySelector('.connection-error-banner');
      if (errorMsg) errorMsg.remove();

      return data.alerts || [];

    } catch (error) {
      const isNetworkError = error.name === 'TypeError' ||
        error.name === 'AbortError' ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('network');

      const isCORSError = error.message.includes('CORS') ||
        (error.name === 'TypeError' && error.message === 'Failed to fetch');

      console.error(`Error fetching alerts (attempt ${retryCount + 1}/${maxRetries}):`, {
        name: error.name,
        message: error.message,
        isNetworkError,
        isCORSError
      });

      if (retryCount < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, retryCount);
        showRetryMessage(retryCount + 1, maxRetries, delay);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchAlerts(retryCount + 1);
      }

      if (container.children.length === 0) {
        container.innerHTML = `
          <div class="info" style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 8px;">
            <div style="display: flex; align-items: start; gap: 15px;">
              <i class="fas fa-exclamation-triangle" style="font-size: 24px; color: #ff9800; margin-top: 2px;"></i>
              <div style="flex: 1;">
                <strong style="font-size: 18px; display: block; margin-bottom: 10px;">
                  ${isCORSError ? 'Server Configuration Error' : isNetworkError ? 'Network Connection Issue' : 'Server Connection Error'}
                </strong>
                <p style="margin: 8px 0;">
                  ${isCORSError
            ? 'There\'s a configuration issue with the server. The backend CORS settings need to be updated.'
            : isNetworkError
              ? 'Your network connection changed or was interrupted while loading alerts.'
              : 'Unable to connect to the alerts server.'}
                </p>
                <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                  <button onclick="location.reload()" 
                          style="padding: 10px 20px; background: #007bff; color: white; border: none; 
                                 border-radius: 6px; cursor: pointer; font-weight: 500;">
                    <i class="fas fa-sync"></i> Retry Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        showPersistentErrorBanner(isNetworkError, isCORSError);
      }

      return [];
    }
  }

  function showRetryMessage(attempt, maxAttempts, delay) {
    let banner = container.querySelector('.retry-banner');

    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'retry-banner';
      banner.style.cssText = `
        background: #e3f2fd; 
        border-left: 4px solid #2196f3; 
        padding: 12px 15px; 
        margin-bottom: 15px; 
        border-radius: 4px;
      `;
      container.insertBefore(banner, container.firstChild);
    }

    banner.innerHTML = `
      <i class="fas fa-sync fa-spin"></i> 
      <strong>Connection retry ${attempt}/${maxAttempts}</strong> - 
      Retrying in ${(delay / 1000).toFixed(0)} seconds...
    `;

    setTimeout(() => {
      if (banner && banner.parentElement) {
        banner.remove();
      }
    }, delay + 1000);
  }

  function showPersistentErrorBanner(isNetworkError, isCORSError) {
    let banner = container.querySelector('.connection-error-banner');

    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'connection-error-banner';
      banner.style.cssText = `
        background: ${isCORSError ? '#ffe6e6' : '#fff3cd'}; 
        border-left: 4px solid ${isCORSError ? '#dc3545' : '#ffc107'}; 
        padding: 12px 15px; 
        margin-bottom: 15px; 
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      container.insertBefore(banner, container.firstChild);
    }

    banner.innerHTML = `
      <div>
        <i class="fas fa-exclamation-triangle"></i> 
        <strong>${isCORSError ? 'Server configuration error' : isNetworkError ? 'Network issue detected' : 'Connection error'}</strong> - 
        ${isCORSError ? 'Backend CORS settings need updating.' : 'Unable to refresh alerts. Showing last known data.'}
      </div>
      <button onclick="location.reload()" 
              style="padding: 6px 12px; background: #007bff; color: white; border: none; 
                     border-radius: 4px; cursor: pointer; font-size: 13px;">
        <i class="fas fa-sync"></i> Retry
      </button>
    `;
  }

  window.checkNetworkStatus = () => {
    if (!navigator.onLine) {
      alert('❌ You are currently offline. Please check your internet connection.');
    } else {
      alert('✅ You are online. The issue may be with the server or a temporary network glitch. Try refreshing.');
    }
  };

  window.addEventListener('online', () => {
    console.log('Network reconnected - attempting to refresh alerts...');
    const banner = container.querySelector('.connection-error-banner');
    if (banner) {
      banner.style.background = '#d4edda';
      banner.style.borderColor = '#28a745';
      banner.innerHTML = `
        <div>
          <i class="fas fa-check-circle"></i> 
          <strong>Connection restored!</strong> Refreshing alerts...
        </div>
      `;
      setTimeout(() => location.reload(), 1500);
    }
  });

  window.addEventListener('offline', () => {
    console.log('Network disconnected');
    showPersistentErrorBanner(true, false);
  });

  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }
  `;
  document.head.appendChild(style);

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
    let photoUrls = [];

    // ✅ Handle JSON string from backend e.g. '["https://res.cloudinary.com/..."]'
    if (alert.photo_filename) {
      try {
        const parsed = JSON.parse(alert.photo_filename);
        photoUrls = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        photoUrls = [alert.photo_filename]; // fallback if plain URL string
      }
    } else if (alert.photo_url) {
      photoUrls = [alert.photo_url];
    } else if (alert.photo_urls && Array.isArray(alert.photo_urls)) {
      photoUrls = alert.photo_urls;
    }

    let videoUrls = [];

    // ✅ Same for videos
    if (alert.video_filename) {
      try {
        const parsed = JSON.parse(alert.video_filename);
        videoUrls = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        videoUrls = [alert.video_filename];
      }
    } else if (alert.video_url) {
      videoUrls = [alert.video_url];
    } else if (alert.video_urls && Array.isArray(alert.video_urls)) {
      videoUrls = alert.video_urls;
    }

    // ✅ If a "photo" URL is actually a video container (Android HEIF/MP4),
    // render it as a video element instead of an image
    let html = '';

    if (photoUrls.length > 0) {
      html += `<div class="media-gallery" style="margin: 10px 0;">`;

      photoUrls.forEach((url, index) => {
        const isVideoContainer = url.includes('/video/upload/');

        if (isVideoContainer) {
          // Android sent a video container disguised as a photo
          html += `
                    <div class="media-preview" style="margin-bottom: 10px;">
                        <video controls src="${url}" class="media" preload="metadata" 
                               style="width: 100%; border-radius: 8px;"
                               onerror="this.parentElement.innerHTML='<div style=\\'padding:20px;text-align:center;color:#999;background:#f8f9fa;border-radius:8px;\\'>📷 Image could not be loaded</div>'">
                        </video>
                    </div>`;
        } else {
          html += `
                    <div class="media-preview">
                        <img src="${url}" alt="Incident Photo ${index + 1}" class="media" loading="lazy"
                             onclick="openImageModal('${url}')"
                             style="cursor: pointer; width: 100%; border-radius: 8px;"
                             onerror="this.parentElement.innerHTML='<div style=\\'padding:20px;text-align:center;color:#999;background:#f8f9fa;border-radius:8px;\\'>📷 Image could not be loaded</div>'">
                    </div>`;
        }
      });

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
                    <video controls src="${url}" class="media" preload="metadata" 
                           style="width: 100%; border-radius: 0 0 8px 8px;"
                           onerror="this.parentElement.innerHTML='<div style=\\'padding:20px;text-align:center;color:#999;background:#f8f9fa;border-radius:8px;\\'>🎥 Video could not be loaded</div>'">
                    </video>
                </div>`;
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


  //Calculate the distance to the fire accident 

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
  // SMART UPDATE
  // ========================================

  async function updateAlerts() {
    const alerts = await fetchAlerts();
    localStorage.setItem('admin_alerts_cache', JSON.stringify(alerts));
    
    const newAlertIds = alerts.map(a => a.id);
    const alertsChanged = JSON.stringify(newAlertIds.sort()) !== JSON.stringify(currentAlertIds.sort());

    if (!alertsChanged && container.children.length > 0) {
      updateBadge(alerts.length);
      return;
    }

    currentAlertIds = newAlertIds;
    render(alerts);
  }

  // ========================================
  // RENDER FUNCTION
  // ========================================

  async function render(alertsData = null) {
    if (!alertsData && container.children.length === 0) {
      container.innerHTML = `
        <div class="info" style="text-align: center; padding: 20px;">
          <i class="fas fa-spinner fa-spin"></i> Loading alerts...
        </div>
      `;
    }

    const alerts = alertsData || await fetchAlerts();

    if (alerts.length === 0) {
      container.innerHTML = `
        <div class="info" style="text-align: center; padding: 40px; color: #6c757d;">
          <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
          <h3 style="margin: 0;">No Active Alerts</h3>
          <p style="margin: 10px 0 0 0;">All clear! No fire incidents reported.</p>
        </div>
      `;
      updateBadge(0);
      currentAlertIds = [];
      return;
    }

    container.innerHTML = "";

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
        <div class="info">
          <strong>Reported:</strong> ${alert.timestamp ? new Date(alert.timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }) : 'N/A'}
        </div>
        <div class="info"><strong>Description:</strong> ${alert.description || "No description"}</div>
        ${mediaHTML(alert)}
        <div class="info"><strong>Barangay:</strong> ${alert.barangay || 'Unknown'}</div>
        <div class="info"><strong>Coordinates:</strong> ${alert.latitude || "?"}, ${alert.longitude || "?"}</div>
        <div class="info"><strong>Distance from Fire Station:</strong> <span class="distance">${dist}</span></div>
        <div id="${mapId}" style="width:100%;height:300px;border-radius:8px;margin-top:10px;background:#e9ecef;display:flex;align-items:center;justify-content:center;">
          ${hasCoords ? `
            <button onclick="loadMap('${mapId}', ${lat}, ${lng})" 
                    style="padding:12px 24px;background:#dc3545;color:white;border:none;border-radius:6px;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.15);font-weight:500;transition:all 0.2s;"
                    onmouseover="this.style.background='#c82333'"
                    onmouseout="this.style.background='#dc3545'">
              <i class="fas fa-route"></i> Show Route to Fire
            </button>
          ` : '<div style="color:#6c757d;">Invalid coordinates</div>'}
        </div>
        <div class="action-buttons">
          <button class="action-btn btn-respond" onclick="openRespondModal('${alert.id}', '${reporterName.replace(/'/g, "\\'")}', '${barangay.replace(/'/g, "\\'")}')">
            <i class="fas fa-reply"></i> Respond
          </button>
          <button class="action-btn btn-resolve" onclick="openResolveModal('${alert.id}', '${reporterName.replace(/'/g, "\\'")}', '${barangay.replace(/'/g, "\\'")}')">
            <i class="fas fa-check-circle"></i> Resolve
          </button>
          <button class="action-btn btn-spam" onclick="markAsSpam('${alert.id}', '${reporterName.replace(/'/g, "\\'")}')">
          <i class="fas fa-flag"></i> Mark as Spam
           </button>
        </div>
      `;
      container.appendChild(card);
    });

    updateBadge(alerts.length);
    currentAlertIds = alerts.map(a => a.id);

    if (alerts.length > 0 && container.scrollTop === 0) {
      const firstAlert = alerts[0];
      const lat = parseFloat(firstAlert.latitude);
      const lng = parseFloat(firstAlert.longitude);
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

      if (hasCoords) {
        setTimeout(() => {
          loadMap("map-" + firstAlert.id, lat, lng);
        }, 500);
      }
    }
  }

  // ========================================
  // INITIALIZE
  // ========================================

  const cached = localStorage.getItem('admin_alerts_cache');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed.length > 0) {
        currentAlertIds = parsed.map(a => a.id);
        render(parsed);
      }
    } catch (e) {}
  }

  updateAlerts(); // Fetch fresh data immediately
  setInterval(updateAlerts, 5000);
});
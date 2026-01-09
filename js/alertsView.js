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
  // 🔥 NEW: SSE REAL-TIME CONNECTION
  // ========================================
  let eventSource = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;

  function connectSSE() {
    // Don't connect if already connected
    if (eventSource && eventSource.readyState === EventSource.OPEN) {
      console.log('SSE already connected');
      return;
    }

    console.log('🔌 Connecting to SSE...');
    
    // Using 'admin' as user_id for admin dashboard
    eventSource = new EventSource(`${API_BASE}/sse/notifications/admin`, {
      withCredentials: true
    });

    eventSource.onopen = () => {
      console.log('✅ SSE Connected!');
      reconnectAttempts = 0;
      
      // Update connection indicator if it exists
      const indicator = document.getElementById('sse-indicator');
      if (indicator) {
        indicator.textContent = '🟢 Live';
        indicator.style.color = '#28a745';
      }
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 SSE Message received:', data);

        if (data.type === 'connected') {
          console.log('SSE connection confirmed');
          return;
        }

        // When new alert is created, refresh instantly
        if (data.type === 'alert_created' || data.type === 'new_alert') {
          console.log('🚨 New alert detected - refreshing...');
          render();
          showToast('New Fire Alert!', 'A new fire alert has been reported.', 'warning');
        }

        // When alert is updated
        if (data.type === 'alert_updated') {
          console.log('🔄 Alert updated - refreshing...');
          render();
        }

      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE Error:', error);
      
      const indicator = document.getElementById('sse-indicator');
      if (indicator) {
        indicator.textContent = '🔴 Disconnected';
        indicator.style.color = '#dc3545';
      }

      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }

      // Reconnect with exponential backoff
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`🔄 Reconnecting in ${delay/1000}s... (Attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
        setTimeout(connectSSE, delay);
      } else {
        console.log('⚠️ Max reconnection attempts reached. Using polling fallback.');
      }
    };
  }

  // Toast notification helper
  function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'warning' ? '#ff9800' : '#2196F3'};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 300px;
    `;
    
    toast.innerHTML = `<strong>${title}</strong><br><span style="font-size: 14px;">${message}</span>`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (eventSource) {
      console.log('🔌 Closing SSE connection...');
      eventSource.close();
    }
  });

  // 🔥 START SSE CONNECTION
  connectSSE();

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
    // Disable button immediately to prevent double-clicks
    const sendBtn = document.querySelector('#respond-modal .btn-primary');
    if (sendBtn && sendBtn.disabled) {
      console.log('Already sending, ignoring...');
      return;
    }
    
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    }
    
    if (!currentAlertData?.id) {
      console.error('Error: currentAlertData is null');
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
    // Enhanced null check with logging
    if (!currentAlertData?.id) {
      console.error('Error: currentAlertData is null or missing id in markAsResolved');
      alert('Error: Alert data not found. Please close and reopen the modal.');
      closeResolveModal();
      return;
    }
    
    const resolveTime = document.getElementById('resolve-time').value;
    if (!resolveTime) {
      alert('Please enter the time when the fire was resolved');
      return;
    }

    // Disable button to prevent double-clicks
    const resolveBtn = document.querySelector('#resolve-modal button[onclick*="markAsResolved"]');
    if (resolveBtn) {
      resolveBtn.disabled = true;
      resolveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resolving...';
    }

    // Store ID before clearing to prevent race conditions
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
        closeResolveModal(); // This sets currentAlertData to null
        alert('Alert marked as resolved! User has been notified.');
        const card = document.querySelector(`[data-id="${alertId}"]`);
        if (card) card.remove();
        const remainingAlerts = document.querySelectorAll('.alert-card').length;
        updateBadge(remainingAlerts);
      } else {
        throw new Error('Failed to resolve alert');
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
      alert('Failed to resolve alert. Please try again.');
      
      // Re-enable button on error
      if (resolveBtn) {
        resolveBtn.disabled = false;
        resolveBtn.innerHTML = '<i class="fas fa-check-circle"></i> Mark as Resolved';
      }
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
  // LAZY MAP LOADING
  // ========================================

  window.loadMap = (mapId, lat, lng) => {
    const mapDiv = document.getElementById(mapId);
    mapDiv.innerHTML = '<div style="padding:20px;text-align:center;"><i class="fas fa-spinner fa-spin"></i> Loading map...</div>';
    
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
  };

  // ========================================
  // API FUNCTIONS
  // ========================================

  async function fetchAlerts(retryCount = 0) {
    const maxRetries = 3;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout
      
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
          Unable to load alerts. The server might be starting up (this can take 60-90 seconds).
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
        <img src="${photoURL}" alt="Incident Photo" class="media" loading="lazy"
             onerror="this.parentElement.innerHTML='<div style=\\'padding:20px;text-align:center;color:#999;background:#f8f9fa;border-radius:8px;\\'>📷 Image could not be loaded</div>'"
             onload="console.log('✅ Image loaded successfully')">
      </div>`;
    }
    if (videoURL) {
      return `<div class="media-preview">
        <video controls src="${videoURL}" class="media" preload="metadata"
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
  // RENDER FUNCTION - OPTIMIZED
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

    // FIRST PASS: Create all cards WITHOUT maps (fast rendering)
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
        <div id="${mapId}" style="width:100%;height:200px;border-radius:8px;margin-top:10px;background:#e9ecef;display:flex;align-items:center;justify-content:center;">
          ${hasCoords ? `
            <button onclick="loadMap('${mapId}', ${lat}, ${lng})" style="padding:10px 20px;background:#007bff;color:white;border:none;border-radius:5px;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
              <i class="fas fa-map-marked-alt"></i> Load Map
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
          <button class="action-btn btn-delete" onclick="deleteAlert('${alert.id}', '${reporterName.replace(/'/g, "\\'")}')">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      `;
      container.appendChild(card);
    });

    updateBadge(alerts.length);

    // Optional: Auto-load the first map after a brief delay
    if (alerts.length > 0) {
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

  // Initial render
  render();

  // Auto-refresh every 30 seconds (fallback if SSE fails)
  setInterval(render, 30000);
});
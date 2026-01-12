// alertsView.js - Admin Alerts View with Multiple Images Support

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
  const fireStation = { lat: 8.476776975907958, lng: 123.7968330650085 };

  let currentAlertData = null;
  let currentAlertIds = [];

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
        currentAlertIds = currentAlertIds.filter(id => id !== alertId);
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
  const baseDelay = 2000; // 2 seconds base
  
  try {
    // Increased timeout for Render.com cold starts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes
    
    const response = await fetch(`${API_BASE}/get_alerts`, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal
      // ❌ REMOVED: Cache-Control headers causing CORS error
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Clear any error messages on success
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
    
    // Retry logic with exponential backoff
    if (retryCount < maxRetries - 1) {
      const delay = baseDelay * Math.pow(2, retryCount); // Exponential: 2s, 4s, 8s
      
      // Show transient retry message (don't replace all content)
      showRetryMessage(retryCount + 1, maxRetries, delay);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchAlerts(retryCount + 1);
    }
    
    // After all retries failed
    if (container.children.length === 0) {
      // First load - show full error
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
              <p style="margin: 8px 0; color: #666;">
                <strong>Possible causes:</strong><br>
                ${isCORSError 
                  ? '• Backend CORS headers need updating<br>• Server restart required after config change'
                  : '• Server is waking up from sleep (60-90 seconds on free tier)<br>• Network switched between WiFi/mobile data<br>• VPN connection changed<br>• Temporary internet disruption'}
              </p>
              <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button onclick="location.reload()" 
                        style="padding: 10px 20px; background: #007bff; color: white; border: none; 
                               border-radius: 6px; cursor: pointer; font-weight: 500; 
                               box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s;"
                        onmouseover="this.style.background='#0056b3'"
                        onmouseout="this.style.background='#007bff'">
                  <i class="fas fa-sync"></i> Retry Now
                </button>
                <button onclick="checkNetworkStatus()" 
                        style="padding: 10px 20px; background: #6c757d; color: white; border: none; 
                               border-radius: 6px; cursor: pointer; font-weight: 500;">
                  <i class="fas fa-network-wired"></i> Check Connection
                </button>
              </div>
              <p style="margin-top: 15px; font-size: 13px; color: #666;">
                <i class="fas fa-info-circle"></i> Auto-retrying in background...
              </p>
            </div>
          </div>
        </div>
      `;
    } else {
      // Alerts were loaded before - show banner at top
      showPersistentErrorBanner(isNetworkError, isCORSError);
    }
    
    return [];
  }
}

// Show temporary retry message
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
      animation: slideDown 0.3s ease;
    `;
    container.insertBefore(banner, container.firstChild);
  }
  
  banner.innerHTML = `
    <i class="fas fa-sync fa-spin"></i> 
    <strong>Connection retry ${attempt}/${maxAttempts}</strong> - 
    Retrying in ${(delay/1000).toFixed(0)} seconds...
  `;
  
  // Remove after delay + 1 second
  setTimeout(() => {
    if (banner && banner.parentElement) {
      banner.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => banner.remove(), 300);
    }
  }, delay + 1000);
}

// Show persistent error banner when background updates fail
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

// Helper function to check network status
window.checkNetworkStatus = () => {
  if (!navigator.onLine) {
    alert('❌ You are currently offline. Please check your internet connection.');
  } else {
    alert('✅ You are online. The issue may be with the server or a temporary network glitch. Try refreshing.');
  }
};

// Add network status listeners
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

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
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

  // ✅ Handle multiple images and videos
  function mediaHTML(alert) {
    // Parse photo_urls
    let photoUrls = [];
    if (alert.photo_urls && Array.isArray(alert.photo_urls)) {
      photoUrls = alert.photo_urls;
    } else if (alert.photo_url) {
      photoUrls = [alert.photo_url];
    }

    // Parse video_urls
    let videoUrls = [];
    if (alert.video_urls && Array.isArray(alert.video_urls)) {
      videoUrls = alert.video_urls;
    } else if (alert.video_url) {
      videoUrls = [alert.video_url];
    }

    let html = '';

    // ✅ Display multiple photos in a gallery
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
    
    // ✅ Display multiple videos
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

  // ✅ Image modal for full-screen view
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
  // SMART UPDATE
  // ========================================

  async function updateAlerts() {
    const alerts = await fetchAlerts();
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
    const alerts = alertsData || await fetchAlerts();
    
    if (container.children.length === 0) {
      container.innerHTML = `
        <div class="info" style="text-align: center; padding: 20px;">
          <i class="fas fa-spinner fa-spin"></i> Loading alerts...
        </div>
      `;
    }

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

  render();
  setInterval(updateAlerts, 5000);
});
// spamView.js - Spam Alerts View Logic

// AUTHENTICATION CHECK
if (typeof AdminAuth !== 'undefined') {
  AdminAuth.requireAuth();
} else {
  fetch(`${API_BASE}/auth/verify`, { credentials: 'include' })
    .then(res => { if (!res.ok) window.location.href = 'adminLogin.html'; })
    .catch(() => { window.location.href = 'adminLogin.html'; });
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("spam-container");
  const spamBadge = document.getElementById("spam-badge");

  let currentRestoreData = null;
  let currentDeleteData = null;

  // ========================================
  // MODAL FUNCTIONS
  // ========================================

  window.openRestoreModal = (alertId, reporterName, barangay) => {
    currentRestoreData = { id: alertId, reporterName, barangay };
    const modal = document.getElementById('restore-modal');
    const infoEl = document.getElementById('restore-alert-info');
    infoEl.innerHTML = `Restore alert from <strong>${reporterName}</strong> in <strong>Barangay ${barangay}</strong>?`;
    modal.classList.add('active');
  };

  window.closeRestoreModal = () => {
    document.getElementById('restore-modal').classList.remove('active');
    currentRestoreData = null;
  };

  window.confirmRestore = async () => {
    if (!currentRestoreData?.id) {
      alert('Error: Alert data not found.');
      closeRestoreModal();
      return;
    }

    const restoreBtn = document.querySelector('#restore-modal .btn-primary');
    if (restoreBtn) {
      restoreBtn.disabled = true;
      restoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Restoring...';
    }

    try {
      const res = await fetch(`${API_BASE}/restore_spam_alert/${encodeURIComponent(currentRestoreData.id)}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (res.ok) {
        closeRestoreModal();
        alert('Alert restored successfully! User has been notified.');
        render();
      } else {
        throw new Error('Failed to restore alert');
      }
    } catch (error) {
      console.error('Error restoring alert:', error);
      alert('Failed to restore alert. Please try again.');
      
      if (restoreBtn) {
        restoreBtn.disabled = false;
        restoreBtn.innerHTML = '<i class="fas fa-undo"></i> Restore Alert';
      }
    }
  };

  window.openDeleteModal = (alertId, reporterName, barangay) => {
    currentDeleteData = { id: alertId, reporterName, barangay };
    const modal = document.getElementById('delete-modal');
    const infoEl = document.getElementById('delete-alert-info');
    infoEl.innerHTML = `Permanently delete alert from <strong>${reporterName}</strong> in <strong>Barangay ${barangay}</strong>?`;
    modal.classList.add('active');
  };

  window.closeDeleteModal = () => {
    document.getElementById('delete-modal').classList.remove('active');
    currentDeleteData = null;
  };

  window.confirmDelete = async () => {
    if (!currentDeleteData?.id) {
      alert('Error: Alert data not found.');
      closeDeleteModal();
      return;
    }

    const deleteBtn = document.querySelector('#delete-modal .btn-danger');
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    }

    try {
      const res = await fetch(`${API_BASE}/delete_spam_alert/${encodeURIComponent(currentDeleteData.id)}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        closeDeleteModal();
        alert('Alert permanently deleted!');
        render();
      } else {
        throw new Error('Failed to delete alert');
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
      alert('Failed to delete alert. Please try again.');
      
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete Permanently';
      }
    }
  };

  // ========================================
  // API FUNCTIONS
  // ========================================

  async function fetchSpamAlerts() {
    try {
      const response = await fetch(`${API_BASE}/get_spam_alerts`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`📋 Retrieved ${data.count} spam alerts`);
      
      return data.spam || [];
      
    } catch (error) {
      console.error('❌ Error fetching spam alerts:', error);
      return [];
    }
  }

  // ========================================
  // UI HELPER FUNCTIONS
  // ========================================

  function updateBadge(count) {
    if (spamBadge) spamBadge.textContent = count;
  }

  function reporterHeaderHTML(alert) {
    const reporterName = alert.reporter_name || 'Anonymous Reporter';
    const barangay = alert.barangay || 'Unknown Location';

    return `
      <div class="spam-header">
        <div class="reporter-info">
          <h3 class="reporter-name">
            <i class="fas fa-user"></i> ${reporterName}
          </h3>
          <p class="reporter-barangay">
            <i class="fas fa-map-marker-alt"></i> Barangay ${barangay}
          </p>
        </div>
        <div class="spam-badge">
          <i class="fas fa-ban"></i> SPAM
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

  // ========================================
  // RENDER FUNCTION
  // ========================================

  async function render() {
    const spamAlerts = await fetchSpamAlerts();
    
    if (spamAlerts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-inbox"></i>
          <h3>No Spam Alerts</h3>
          <p>Great! No alerts have been marked as spam.</p>
        </div>
      `;
      updateBadge(0);
      return;
    }

    container.innerHTML = "";

    spamAlerts.forEach((alert) => {
      const card = document.createElement("div");
      card.className = "spam-card";
      card.dataset.id = alert.id;

      const reporterName = alert.reporter_name || 'Anonymous Reporter';
      const barangay = alert.barangay || 'Unknown Location';
      const reportedTime = new Date(alert.timestamp).toLocaleString();
      const markedSpamTime = alert.markedSpamAt ? new Date(alert.markedSpamAt).toLocaleString() : 'Unknown';

      card.innerHTML = `
        ${reporterHeaderHTML(alert)}
        
        <div class="info"><strong>Alert ID:</strong> #${alert.id}</div>
        <div class="info"><strong>Description:</strong> ${alert.description || "No description"}</div>
        ${mediaHTML(alert)}
        <div class="info"><strong>Location:</strong> ${alert.latitude || "?"}, ${alert.longitude || "?"}</div>
        
        <div class="spam-timestamp">
          <div class="info">
            <i class="fas fa-clock"></i>
            <strong>Reported:</strong> ${reportedTime}
          </div>
          <div class="info">
            <i class="fas fa-ban"></i>
            <strong>Marked as Spam:</strong> ${markedSpamTime}
          </div>
        </div>

        <div class="action-buttons">
          <button class="action-btn btn-restore" onclick="openRestoreModal('${alert.id}', '${reporterName.replace(/'/g, "\\'")}', '${barangay.replace(/'/g, "\\'")}')">
            <i class="fas fa-undo"></i> Restore to Active
          </button>
          <button class="action-btn btn-delete" onclick="openDeleteModal('${alert.id}', '${reporterName.replace(/'/g, "\\'")}', '${barangay.replace(/'/g, "\\'")}')">
            <i class="fas fa-trash"></i> Delete Permanently
          </button>
        </div>
      `;
      
      container.appendChild(card);
    });

    updateBadge(spamAlerts.length);
  }

  // ========================================
  // UPDATE ALERTS BADGE (OPTIONAL)
  // ========================================
  
  async function updateAlertsBadge() {
    try {
      const response = await fetch(`${API_BASE}/get_alerts`, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const alertsBadge = document.getElementById('alerts-badge');
        if (alertsBadge) {
          alertsBadge.textContent = data.count || 0;
        }
      }
    } catch (error) {
      console.error('Error updating alerts badge:', error);
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
  updateAlertsBadge();
  
  // Auto-refresh every 30 seconds
  setInterval(() => {
    render();
    updateAlertsBadge();
  }, 30000);
});
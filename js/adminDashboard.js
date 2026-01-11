// notificationAdmin.js
// ✅ Use the correct API base from config
const NOTIFICATION_API_BASE = API_BASE;

// ========================================
// NOTIFICATION SENDER (FIXED TIMESTAMPS)
// ========================================

// Send notification to specific user
async function sendNotificationToUser(userId, title, message, type = 'info', extraData = {}) {
  try {
    // Generate timestamp on backend, not frontend
    const payload = {
      user_id: userId,
      title: title,
      message: message,
      type: type,
      ...extraData  // Include alert_id, alert_location, resolve_time
    };

    console.log('📤 Sending notification:', payload);

    const response = await fetch(`${API_BASE}/api/admin/notifications`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Notification sent successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    throw error;
  }
}

// Broadcast to all users
async function broadcastNotification(title, message, type = 'info') {
  try {
    const usersResponse = await fetch(`${API_BASE}/get_all_users`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!usersResponse.ok) {
      throw new Error('Failed to fetch users');
    }

    const users = await usersResponse.json();
    
    const promises = users.map(user => 
      sendNotificationToUser(user.id, title, message, type)
    );

    await Promise.all(promises);
    console.log(`✅ Broadcast sent to ${users.length} users`);
    return { success: true, count: users.length };
  } catch (error) {
    console.error('❌ Error broadcasting notification:', error);
    throw error;
  }
}

// ========================================
// ALERT-SPECIFIC NOTIFICATIONS (FIXED)
// ========================================

async function notifyUserAboutAlert(userId, alertId, notificationType, extraData = {}) {
  const notifications = {
    'responded': {
      title: '🚒 Fire Station Response',
      message: extraData.message || `The fire station has responded to your alert #${alertId}. Help is on the way!`,
      type: 'response',
      alert_id: alertId,
      alert_location: extraData.location || null
    },
    'resolved': {
      title: '✅ Fire Alert Resolved',
      message: `Fire at ${extraData.location || 'your location'} has been extinguished${extraData.resolveTime ? ` at ${extraData.resolveTime}` : ''}.`,
      type: 'resolved',
      alert_id: alertId,
      alert_location: extraData.location || null,
      resolve_time: extraData.resolveTime || null
    },
    'deleted': {
      title: '🗑️ Alert Removed',
      message: `Your fire alert #${alertId} at ${extraData.location || 'your location'} has been removed from the system.`,
      type: 'deleted',
      alert_id: alertId,
      alert_location: extraData.location || null
    }
  };

  const notif = notifications[notificationType];
  if (!notif) {
    console.error('Unknown notification type:', notificationType);
    return;
  }

  // Send notification with all metadata
  return sendNotificationToUser(
    userId, 
    notif.title, 
    notif.message, 
    notif.type,
    {
      alert_id: notif.alert_id,
      alert_location: notif.alert_location,
      resolve_time: notif.resolve_time
    }
  );
}

// ========================================
// HELPER FUNCTIONS FOR ADMIN ACTIONS
// ========================================

// When admin responds to alert
async function sendResponseNotification(userId, alertId, responseMessage, location) {
  return notifyUserAboutAlert(userId, alertId, 'responded', {
    message: responseMessage,
    location: location
  });
}

// When admin resolves alert
async function sendResolvedNotification(userId, alertId, resolveTime, location) {
  return notifyUserAboutAlert(userId, alertId, 'resolved', {
    resolveTime: resolveTime,
    location: location
  });
}

// When admin deletes alert
async function sendDeletedNotification(userId, alertId, location) {
  return notifyUserAboutAlert(userId, alertId, 'deleted', {
    location: location
  });
}

console.log('✅ Admin notification system loaded - connected to backend:', API_BASE);
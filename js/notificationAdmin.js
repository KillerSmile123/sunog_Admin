//notificationAdmin.js

// ========================================
// NOTIFICATION SENDER
// ========================================

async function sendNotificationToUser(userId, title, message, type = 'info') {
  try {
    const response = await fetch(`${NOTIFICATION_API_BASE}/api/notifications/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        title: title,
        message: message,
        type: type
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Notification sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

// ========================================
// BROADCAST TO ALL USERS
// ========================================

async function broadcastNotification(title, message, type = 'info') {
  try {
    // Get all users first
    const usersResponse = await fetch(`${API_BASE}/get_all_users`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!usersResponse.ok) {
      throw new Error('Failed to fetch users');
    }

    const users = await usersResponse.json();
    
    // Send notification to each user
    const promises = users.map(user => 
      sendNotificationToUser(user.id, title, message, type)
    );

    await Promise.all(promises);
    console.log(`Broadcast sent to ${users.length} users`);
    return { success: true, count: users.length };
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    throw error;
  }
}

// ========================================
// HELPER FUNCTION FOR ALERT-SPECIFIC NOTIFICATIONS
// ========================================

async function notifyUserAboutAlert(userId, alertId, notificationType, extraData = {}) {
  const notifications = {
    'responded': {
      title: 'Fire Station Response',
      message: `The fire station has responded to your alert #${alertId}. ${extraData.message || 'Help is on the way!'}`,
      type: 'info'
    },
    'resolved': {
      title: 'Alert Resolved',
      message: `Your fire alert #${alertId} has been marked as resolved. Fire was put out at ${extraData.resolveTime || 'N/A'}.`,
      type: 'success'
    },
    'deleted': {
      title: 'Alert Removed',
      message: `Your alert #${alertId} has been removed from the system.`,
      type: 'warning'
    }
  };

  const notif = notifications[notificationType];
  if (!notif) {
    console.error('Unknown notification type:', notificationType);
    return;
  }

  return sendNotificationToUser(userId, notif.title, notif.message, notif.type);
}

// ========================================
// USAGE EXAMPLES IN YOUR EXISTING CODE
// ========================================


// Example 1: After responding to an alert
async function sendResponseWithNotification() {
  const message = document.getElementById('response-message').value.trim();
  
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
    // Send notification to user
    await notifyUserAboutAlert(
      currentAlertData.userId, 
      currentAlertData.id, 
      'responded',
      { message: message }
    );
    
    alert('Response sent and user notified!');
  }
}

// Example 2: After resolving an alert
async function markAsResolvedWithNotification() {
  const resolveTime = document.getElementById('resolve-time').value;
  
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
    // Send notification to user
    await notifyUserAboutAlert(
      alert.userId,
      alertId,
      'resolved',
      { resolveTime: resolveTime }
    );
    
    alert('Alert resolved and user notified!');
  }
}

// Example 3: After deleting an alert
async function deleteAlertWithNotification(alertId, userId) {
  const res = await fetch(`${API_BASE}/delete_alert/${alertId}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (res.ok) {
    // Notify user about deletion
    await notifyUserAboutAlert(userId, alertId, 'deleted');
    
    alert('Alert deleted and user notified!');
  }
}

// Example 4: Broadcast announcement to all users
async function sendAnnouncement() {
  await broadcastNotification(
    'System Maintenance',
    'The fire alert system will be down for maintenance tonight at 10 PM.',
    'warning'
  );
  
  alert('Announcement sent to all users!');
}

// Example 5: Send custom notification
async function sendCustomNotification(userId) {
  await sendNotificationToUser(
    userId,
    'Important Notice',
    'Please check your email for updates.',
    'info'
  );
}

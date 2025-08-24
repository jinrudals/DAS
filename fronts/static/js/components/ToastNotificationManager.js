/**
 * Toast Notification Manager for Real-time Updates
 * Displays Bootstrap toast notifications for execution status changes
 */

class ToastNotificationManager {
  constructor(options = {}) {
    this.options = {
      position: 'top-end',
      autoHide: true,
      delay: 5000,
      enableBrowserNotifications: false,
      ...options
    };
    
    this.toastContainer = null;
    this.notificationPermission = 'default';
    
    this.init();
  }
  
  /**
   * Initialize the toast notification system
   */
  init() {
    this.createToastContainer();
    this.requestNotificationPermission();
  }
  
  /**
   * Create the toast container if it doesn't exist
   */
  createToastContainer() {
    this.toastContainer = document.getElementById('toast-container');
    
    if (!this.toastContainer) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.id = 'toast-container';
      this.toastContainer.className = `toast-container position-fixed p-3 ${this.options.position}`;
      this.toastContainer.style.zIndex = '1055'; // Above modals
      document.body.appendChild(this.toastContainer);
    }
  }
  
  /**
   * Request browser notification permission
   */
  async requestNotificationPermission() {
    if ('Notification' in window && this.options.enableBrowserNotifications) {
      try {
        this.notificationPermission = await Notification.requestPermission();
      } catch (error) {
        console.warn('[Toast] Browser notifications not supported:', error);
      }
    }
  }
  
  /**
   * Show execution status update notification
   */
  showExecutionUpdate(executionData) {
    const { status, criterion_name, target_name, repository_name, created } = executionData;
    
    let title, message, variant;
    
    if (created) {
      title = 'Execution Started';
      message = `${criterion_name} → ${target_name} (${repository_name})`;
      variant = 'info';
    } else {
      // Status update
      switch (status) {
        case 'SUCCESS':
          title = 'Execution Completed';
          message = `${criterion_name} → ${target_name} completed successfully`;
          variant = 'success';
          break;
        case 'FAILED':
          title = 'Execution Failed';
          message = `${criterion_name} → ${target_name} failed`;
          variant = 'danger';
          break;
        case 'RUNNING':
          title = 'Execution Running';
          message = `${criterion_name} → ${target_name} is now running`;
          variant = 'primary';
          break;
        default:
          title = 'Execution Update';
          message = `${criterion_name} → ${target_name} status: ${status}`;
          variant = 'secondary';
      }
    }
    
    this.showToast(title, message, variant, {
      executionData,
      type: 'execution_update'
    });
    
    // Show browser notification if enabled and permitted
    if (this.options.enableBrowserNotifications && this.notificationPermission === 'granted') {
      this.showBrowserNotification(title, message);
    }
  }
  
  /**
   * Show batch operation update notification
   */
  showBatchUpdate(batchData) {
    const { batch_size, jenkins_submitted, created } = batchData;
    
    let title, message, variant;
    
    if (created) {
      title = 'Batch Created';
      message = `Created batch with ${batch_size} executions`;
      variant = 'info';
    } else if (jenkins_submitted) {
      title = 'Batch Submitted';
      message = `Batch with ${batch_size} executions submitted to Jenkins`;
      variant = 'success';
    } else {
      title = 'Batch Updated';
      message = `Batch status updated (${batch_size} executions)`;
      variant = 'secondary';
    }
    
    this.showToast(title, message, variant, {
      batchData,
      type: 'batch_update'
    });
  }
  
  /**
   * Show connection status notification
   */
  showConnectionStatus(connected, data = {}) {
    if (connected) {
      this.showToast(
        'Connected',
        'Real-time updates enabled',
        'success',
        { type: 'connection', ...data }
      );
    } else {
      this.showToast(
        'Connection Lost',
        'Attempting to reconnect...',
        'warning',
        { type: 'connection', ...data }
      );
    }
  }
  
  /**
   * Create and show a Bootstrap toast notification
   */
  showToast(title, message, variant = 'primary', data = {}) {
    const toastId = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const toastHtml = `
      <div class="toast align-items-center text-bg-${variant} border-0" role="alert" aria-live="assertive" aria-atomic="true" id="${toastId}">
        <div class="d-flex">
          <div class="toast-body">
            <div class="fw-bold">${this.escapeHtml(title)}</div>
            <div class="small">${this.escapeHtml(message)}</div>
          </div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>
    `;
    
    const toastElement = document.createElement('div');
    toastElement.innerHTML = toastHtml;
    const toast = toastElement.firstElementChild;
    
    // Store data on the toast element for potential use
    toast._notificationData = data;
    
    this.toastContainer.appendChild(toast);
    
    // Initialize Bootstrap toast
    const bsToast = new bootstrap.Toast(toast, {
      autohide: this.options.autoHide,
      delay: this.options.delay
    });
    
    // Remove element after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
      toast.remove();
    });
    
    bsToast.show();
    
    return toast;
  }
  
  /**
   * Show browser notification (if permission granted)
   */
  showBrowserNotification(title, message) {
    if ('Notification' in window && this.notificationPermission === 'granted') {
      try {
        const notification = new Notification(title, {
          body: message,
          icon: '/static/images/favicon.ico', // Adjust path as needed
          badge: '/static/images/badge.png'   // Adjust path as needed
        });
        
        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
        
        return notification;
      } catch (error) {
        console.warn('[Toast] Failed to show browser notification:', error);
      }
    }
    return null;
  }
  
  /**
   * Clear all toast notifications
   */
  clearAll() {
    const toasts = this.toastContainer.querySelectorAll('.toast');
    toasts.forEach(toast => {
      const bsToast = bootstrap.Toast.getInstance(toast);
      if (bsToast) {
        bsToast.hide();
      } else {
        toast.remove();
      }
    });
  }
  
  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Set notification preferences
   */
  setPreferences(preferences) {
    this.options = { ...this.options, ...preferences };
    
    if (preferences.enableBrowserNotifications && this.notificationPermission === 'default') {
      this.requestNotificationPermission();
    }
  }
  
  /**
   * Get current notification preferences
   */
  getPreferences() {
    return {
      ...this.options,
      notificationPermission: this.notificationPermission
    };
  }
  
  /**
   * Static method to create notification manager
   */
  static create(options = {}) {
    return new ToastNotificationManager(options);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToastNotificationManager;
}
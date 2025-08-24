/**
 * WebSocket Manager for Real-time Execution Updates
 * Handles WebSocket connections, reconnection logic, and event broadcasting
 */

class WebSocketManager {
  constructor(projectName) {
    this.projectName = projectName;
    this.socket = null;
    this.isConnecting = false;
    this.isManualClose = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    this.pingInterval = null;
    
    // Event listeners for different types of updates
    this.eventListeners = {
      'connection_established': [],
      'execution_update': [],
      'batch_operation_update': [],
      'connection_lost': [],
      'connection_error': []
    };
    
    this.init();
  }
  
  init() {
    this.connect();
  }
  
  /**
   * Establish WebSocket connection
   */
  connect() {
    if (this.isConnecting || (this.socket && this.socket.readyState === WebSocket.OPEN)) {
      return;
    }
    
    this.isConnecting = true;
    this.isManualClose = false;
    
    // Determine WebSocket URL (ws or wss based on current protocol)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/execution-updates/${this.projectName}/`;
    
    console.log(`[WebSocket] Connecting to: ${wsUrl}`);
    
    try {
      this.socket = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      this.isConnecting = false;
      this.handleConnectionError();
    }
  }
  
  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.socket.onopen = (event) => {
      console.log('[WebSocket] Connected successfully');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
      // Start ping/pong to maintain connection
      this.startPingPong();
      
      this.emit('connection_established', {
        projectName: this.projectName,
        timestamp: new Date()
      });
    };
    
    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };
    
    this.socket.onclose = (event) => {
      console.log(`[WebSocket] Connection closed: ${event.code} - ${event.reason}`);
      this.isConnecting = false;
      this.stopPingPong();
      
      if (!this.isManualClose) {
        this.emit('connection_lost', {
          code: event.code,
          reason: event.reason,
          timestamp: new Date()
        });
        
        // Attempt to reconnect
        this.scheduleReconnect();
      }
    };
    
    this.socket.onerror = (event) => {
      console.error('[WebSocket] Error occurred:', event);
      this.handleConnectionError();
    };
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    const { type } = data;
    
    switch (type) {
      case 'connection_established':
        console.log(`[WebSocket] ${data.message}`);
        break;
        
      case 'pong':
        // Handle pong response (connection alive)
        console.debug('[WebSocket] Pong received');
        break;
        
      case 'execution_update':
        this.emit('execution_update', data.execution_data);
        break;
        
      case 'batch_operation_update':
        this.emit('batch_operation_update', data.batch_data);
        break;
        
      default:
        console.warn('[WebSocket] Unknown message type:', type);
    }
  }
  
  /**
   * Start ping/pong to maintain connection
   */
  startPingPong() {
    this.stopPingPong(); // Clear any existing interval
    
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }));
      }
    }, 30000); // Ping every 30 seconds
  }
  
  /**
   * Stop ping/pong interval
   */
  stopPingPong() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  /**
   * Handle connection errors
   */
  handleConnectionError() {
    this.emit('connection_error', {
      attempts: this.reconnectAttempts,
      timestamp: new Date()
    });
    
    if (!this.isManualClose) {
      this.scheduleReconnect();
    }
  }
  
  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      return;
    }
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  /**
   * Manually close the WebSocket connection
   */
  disconnect() {
    this.isManualClose = true;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.stopPingPong();
    
    if (this.socket) {
      this.socket.close(1000, 'Manual disconnect');
      this.socket = null;
    }
  }
  
  /**
   * Add event listener for WebSocket events
   */
  addEventListener(eventType, callback) {
    if (this.eventListeners[eventType]) {
      this.eventListeners[eventType].push(callback);
    } else {
      console.warn(`[WebSocket] Unknown event type: ${eventType}`);
    }
  }
  
  /**
   * Remove event listener
   */
  removeEventListener(eventType, callback) {
    if (this.eventListeners[eventType]) {
      const index = this.eventListeners[eventType].indexOf(callback);
      if (index > -1) {
        this.eventListeners[eventType].splice(index, 1);
      }
    }
  }
  
  /**
   * Emit event to all registered listeners
   */
  emit(eventType, data) {
    if (this.eventListeners[eventType]) {
      this.eventListeners[eventType].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WebSocket] Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }
  
  /**
   * Get current connection status
   */
  getConnectionStatus() {
    if (!this.socket) return 'disconnected';
    
    switch (this.socket.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }
  
  /**
   * Static method to create and initialize WebSocket manager
   */
  static create(projectName) {
    return new WebSocketManager(projectName);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebSocketManager;
}
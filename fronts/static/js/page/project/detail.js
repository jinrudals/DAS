/**
 * Project Detail Page - Modular JavaScript Components
 * Initializes all interactive components for the project detail page
 */

// Import component classes
// Note: In a production environment, these would be proper ES modules
// For now, the classes are loaded via separate script tags

/**
 * Initialize all components when DOM is ready
 */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Execution Detail Modal
    if (typeof ExecutionDetailModal !== 'undefined') {
        const executionModal = ExecutionDetailModal.init('executionDetailModal');
        window.executionModal = executionModal; // Make available globally if needed
    }
    
    // Initialize Table Sorter for all tables
    if (typeof TableSorter !== 'undefined') {
        const tableSorter = TableSorter.init();
        window.tableSorter = tableSorter; // Make available globally if needed
        
        // Listen for table sort events (optional analytics/logging)
        document.addEventListener('tableSorted', function(event) {
            console.log('Table sorted:', event.detail);
        });
    }
    
    // Initialize Table Column Filter for all tables
    if (typeof TableColumnFilter !== 'undefined') {
        const tables = document.querySelectorAll('.status-table');
        tables.forEach(table => {
            const columnFilter = TableColumnFilter.init(table);
            // Store reference for potential access
            table.columnFilter = columnFilter;
        });
        
        // Listen for table filter events (optional analytics/logging)
        document.addEventListener('tableFiltered', function(event) {
            console.log('Table filtered:', event.detail);
        });
    }
    
    // Initialize Jenkins Mode
    if (typeof JenkinsMode !== 'undefined') {
        const jenkinsMode = JenkinsMode.init();
        window.jenkinsMode = jenkinsMode; // Make available globally if needed
        
        // Listen for Jenkins mode events
        document.addEventListener('jenkinsModeEnabled', function() {
            console.log('Jenkins mode enabled');
            // Disable modal links while in Jenkins mode
            if (window.executionModal) {
                window.executionModal.setJenkinsMode(true);
            }
        });
        
        document.addEventListener('jenkinsModeDisabled', function() {
            console.log('Jenkins mode disabled');
            // Re-enable modal links
            if (window.executionModal) {
                window.executionModal.setJenkinsMode(false);
            }
        });
    }
    
    // Initialize project filters functionality
    initializeProjectFilters();
    
    // Initialize tab functionality with proper accessibility
    initializeTabNavigation();
    
    // Initialize tooltips if Bootstrap is available
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
    
    // Initialize WebSocket components for real-time updates
    initializeRealTimeUpdates();
    
    console.log('Project detail page components initialized');
});

/**
 * Initialize project filters functionality
 */
function initializeProjectFilters() {
    const filterForm = document.querySelector('.das-filter-form');
    if (!filterForm) return;
    
    // Auto-submit form when filter values change
    const autoSubmitInputs = filterForm.querySelectorAll('select[data-auto-submit="true"]');
    autoSubmitInputs.forEach(input => {
        input.addEventListener('change', function() {
            // Add a small delay to prevent rapid submissions
            setTimeout(() => {
                filterForm.submit();
            }, 100);
        });
    });
    
    // Handle date filter with validation
    const dateInput = filterForm.querySelector('input[type="date"]');
    if (dateInput) {
        dateInput.addEventListener('change', function() {
            // Basic date validation
            const selectedDate = new Date(this.value);
            const today = new Date();
            
            if (selectedDate > today) {
                console.warn('Selected date is in the future');
                // Could show a warning message here
            }
            
            // Auto-submit after validation
            setTimeout(() => {
                filterForm.submit();
            }, 100);
        });
    }
}

/**
 * Initialize tab navigation with proper accessibility
 */
function initializeTabNavigation() {
    const tabButtons = document.querySelectorAll('[data-bs-toggle="pill"]');
    
    tabButtons.forEach(button => {
        button.addEventListener('shown.bs.tab', function(event) {
            const targetId = this.getAttribute('data-bs-target');
            const targetPanel = document.querySelector(targetId);
            
            if (targetPanel) {
                // Update browser URL hash if tab has a meaningful ID
                if (targetId !== '#all-criteria') {
                    history.replaceState(null, null, targetId);
                }
                
                // Announce tab change to screen readers
                const tabName = this.textContent.trim();
                announceToScreenReader(`Switched to ${tabName} tab`);
                
                // Focus first interactive element in the tab panel
                const firstFocusable = targetPanel.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (firstFocusable) {
                    setTimeout(() => {
                        firstFocusable.focus();
                    }, 100);
                }
            }
        });
    });
    
    // Handle URL hash navigation
    if (window.location.hash) {
        const hashTarget = document.querySelector(`[data-bs-target="${window.location.hash}"]`);
        if (hashTarget) {
            const tab = new bootstrap.Tab(hashTarget);
            tab.show();
        }
    }
}

/**
 * Utility function to announce messages to screen readers
 */
function announceToScreenReader(message) {
    let liveRegion = document.getElementById('page-announcements');
    
    if (!liveRegion) {
        liveRegion = document.createElement('div');
        liveRegion.id = 'page-announcements';
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        document.body.appendChild(liveRegion);
    }
    
    // Clear and set new message
    liveRegion.textContent = '';
    setTimeout(() => {
        liveRegion.textContent = message;
    }, 100);
}

/**
 * Error handling for component initialization
 */
window.addEventListener('error', function(event) {
    if (event.filename && event.filename.includes('detail.js')) {
        console.error('Error in project detail page:', event.error);
        // Could implement user-friendly error reporting here
    }
});

/**
 * Initialize real-time WebSocket updates
 */
function initializeRealTimeUpdates() {
    // Get project name from page context (assuming it's available in a data attribute or global variable)
    const projectName = getProjectNameFromPage();
    if (!projectName) {
        console.warn('Project name not found, real-time updates disabled');
        return;
    }
    
    // Initialize WebSocket Manager
    if (typeof WebSocketManager !== 'undefined') {
        const wsManager = WebSocketManager.create(projectName);
        window.wsManager = wsManager; // Make available globally
        
        // Initialize Toast Notification Manager
        if (typeof ToastNotificationManager !== 'undefined') {
            const toastManager = ToastNotificationManager.create({
                position: 'top-end',
                autoHide: true,
                delay: 4000,
                enableBrowserNotifications: false // User can enable this later
            });
            window.toastManager = toastManager;
            
            // Set up WebSocket event listeners
            setupWebSocketEventListeners(wsManager, toastManager);
        } else {
            console.warn('ToastNotificationManager not available');
        }
    } else {
        console.warn('WebSocketManager not available, real-time updates disabled');
    }
}

/**
 * Set up WebSocket event listeners for real-time updates
 */
function setupWebSocketEventListeners(wsManager, toastManager) {
    // Connection established
    wsManager.addEventListener('connection_established', function(data) {
        console.log(`Real-time updates connected for project: ${data.projectName}`);
        toastManager.showConnectionStatus(true, data);
        updateConnectionIndicator(true);
    });
    
    // Connection lost
    wsManager.addEventListener('connection_lost', function(data) {
        console.warn('Real-time connection lost:', data);
        toastManager.showConnectionStatus(false, data);
        updateConnectionIndicator(false);
    });
    
    // Connection error
    wsManager.addEventListener('connection_error', function(data) {
        console.error('WebSocket connection error:', data);
        updateConnectionIndicator(false);
    });
    
    // Execution updates
    wsManager.addEventListener('execution_update', function(executionData) {
        console.log('Execution update received:', executionData);
        
        // Show toast notification
        toastManager.showExecutionUpdate(executionData);
        
        // Update execution matrix
        updateExecutionMatrix(executionData);
        
        // Update any open execution detail modals
        updateExecutionDetailModal(executionData);
    });
    
    // Batch operation updates
    wsManager.addEventListener('batch_operation_update', function(batchData) {
        console.log('Batch update received:', batchData);
        
        // Show toast notification
        toastManager.showBatchUpdate(batchData);
        
        // Update batch progress indicators if visible
        updateBatchProgress(batchData);
    });
}

/**
 * Update the execution matrix with real-time data
 */
function updateExecutionMatrix(executionData) {
    const { 
        criterion_name, 
        target_name, 
        status, 
        build_number,
        branch,
        workflow_type 
    } = executionData;
    
    console.log(`Updating matrix cell: ${target_name} x ${criterion_name} → ${status}`);
    
    // Find the execution cell in the matrix
    const matrixCell = findExecutionCell(criterion_name, target_name);
    if (!matrixCell) {
        console.warn(`Matrix cell not found for ${criterion_name} → ${target_name}`);
        // Log just a few sample cells to see the data format
        const sampleCells = document.querySelectorAll('td[data-target][data-criterion]');
        if (sampleCells.length > 0) {
            console.log('Sample cell data:', sampleCells[0].getAttribute('data-target'), 'x', sampleCells[0].getAttribute('data-criterion'));
        }
        return;
    }
    
    console.log(`Found matrix cell:`, matrixCell);
    
    // Update cell status
    updateCellStatus(matrixCell, status, build_number, branch);
    
    // Add visual feedback animation
    animateCellUpdate(matrixCell);
    
    // Update any associated percentage displays
    updateExecutionPercentage(criterion_name, target_name, status);
    
    console.log(`Matrix cell updated successfully for ${target_name} x ${criterion_name}`);
}

/**
 * Find execution cell in the matrix
 */
function findExecutionCell(criterionName, targetName) {
    // Find the cell using data attributes from the execution table structure
    const selector = `td[data-target="${targetName}"][data-criterion="${criterionName}"]`;
    return document.querySelector(selector);
}

/**
 * Update cell status with new execution data
 */
function updateCellStatus(cell, status, buildNumber, branch) {
    // Update the data-sort attribute for sorting
    cell.setAttribute('data-sort', status);
    
    // Find the status badge within the cell
    const statusBadge = cell.querySelector('.status-badge');
    if (!statusBadge) {
        console.warn('Status badge not found in cell');
        return;
    }
    
    // Update the badge's data-status attribute
    statusBadge.setAttribute('data-status', status);
    
    // Update the badge's aria-label
    statusBadge.setAttribute('aria-label', `Status: ${status}`);
    
    // Update the icon based on status
    const icon = statusBadge.querySelector('i');
    if (icon) {
        // Remove all existing icon classes
        icon.className = 'me-1';
        
        // Add appropriate icon class based on status
        switch (status.toLowerCase()) {
            case 'success':
                icon.classList.add('bi', 'bi-check-circle-fill');
                break;
            case 'failed':
                icon.classList.add('bi', 'bi-x-circle-fill');
                break;
            case 'pending':
                icon.classList.add('bi', 'bi-clock-fill');
                break;
            case 'running':
                icon.classList.add('bi', 'bi-arrow-repeat');
                break;
            case 'requested':
                icon.classList.add('bi', 'bi-hourglass-split');
                break;
            case 'waiting':
                icon.classList.add('bi', 'bi-pause-circle-fill');
                break;
            default:
                icon.classList.add('bi', 'bi-question-circle-fill');
                break;
        }
    }
    
    // Update the status text (everything after the icon)
    const textNodes = Array.from(statusBadge.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE);
    
    if (textNodes.length > 0) {
        // Update the last text node (which contains the status text)
        textNodes[textNodes.length - 1].textContent = status;
    } else {
        // If no text node exists, add one
        statusBadge.appendChild(document.createTextNode(status));
    }
}

/**
 * Animate cell update for visual feedback
 */
function animateCellUpdate(cell) {
    // Add pulse animation class
    cell.classList.add('cell-updated');
    
    // Remove animation class after animation completes
    setTimeout(() => {
        cell.classList.remove('cell-updated');
    }, 2000);
}

/**
 * Update execution percentage displays
 */
function updateExecutionPercentage(criterionName, targetName, status) {
    // This would calculate and update percentage displays if they exist
    // Implementation depends on the specific UI structure
    const percentageElements = document.querySelectorAll('.execution-percentage');
    percentageElements.forEach(element => {
        // Update logic would go here based on the UI structure
        console.log(`Updating percentage for ${criterionName} → ${targetName}: ${status}`);
    });
}

/**
 * Update execution detail modal if open
 */
function updateExecutionDetailModal(executionData) {
    if (window.executionModal && typeof executionModal.updateFromWebSocket === 'function') {
        executionModal.updateFromWebSocket(executionData);
    }
}

/**
 * Update batch progress indicators
 */
function updateBatchProgress(batchData) {
    const batchProgressElements = document.querySelectorAll(`[data-batch-id="${batchData.id}"]`);
    batchProgressElements.forEach(element => {
        // Update batch progress based on the UI structure
        if (batchData.jenkins_submitted) {
            element.classList.add('submitted');
        }
    });
}

/**
 * Update connection status indicator
 */
function updateConnectionIndicator(connected) {
    // Remove the connection status indicator - no longer needed
    const indicator = document.getElementById('websocket-status');
    if (indicator) {
        indicator.remove();
    }
}

/**
 * Get project name from page context
 */
function getProjectNameFromPage() {
    // Try multiple ways to get project name
    
    // Method 1: From project context data attribute
    const projectContext = document.getElementById('project-context');
    if (projectContext && projectContext.dataset.projectName) {
        return projectContext.dataset.projectName;
    }
    
    // Method 2: From data attribute on body or main container
    const bodyProjectName = document.body.dataset.projectName;
    if (bodyProjectName) return bodyProjectName;
    
    // Method 3: From page URL
    const urlMatch = window.location.pathname.match(/\/project\/([^\/]+)/);
    if (urlMatch) return decodeURIComponent(urlMatch[1]);
    
    // Method 4: From page title or heading
    const projectHeading = document.querySelector('h1, h2, .project-name');
    if (projectHeading) {
        const headingText = projectHeading.textContent.trim();
        // Extract project name if it's in a recognizable format
        const projectMatch = headingText.match(/Project:\s*(.+)/i);
        if (projectMatch) return projectMatch[1].trim();
    }
    
    // Method 5: From global JavaScript variable if set
    if (typeof window.PROJECT_NAME !== 'undefined') {
        return window.PROJECT_NAME;
    }
    
    return null;
}

/**
 * Cleanup function for page unload
 */
window.addEventListener('beforeunload', function() {
    // Cleanup WebSocket connection
    if (window.wsManager) {
        window.wsManager.disconnect();
    }
    
    // Clear any remaining toast notifications
    if (window.toastManager) {
        window.toastManager.clearAll();
    }
});
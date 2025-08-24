/**
 * Table Sorter Component
 * Handles table sorting functionality with accessibility support
 */

class TableSorter {
  constructor(containerSelector = document) {
    this.container = typeof containerSelector === 'string' 
      ? document.querySelector(containerSelector) 
      : containerSelector;
    
    this.sortStates = new Map(); // Track sort state per table
    this.isJenkinsModeActive = false; // Track Jenkins mode state
    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.setupJenkinsModeListeners();
  }
  
  setupEventListeners() {
    // Event delegation for sortable header text
    this.container.addEventListener('click', (event) => {
      const sortableText = event.target.closest('.sortable-text');
      if (sortableText && !this.isJenkinsModeActive) {
        this.handleSort(sortableText);
      }
    });
    
    // Keyboard support
    this.container.addEventListener('keydown', (event) => {
      const sortableText = event.target.closest('.sortable-text');
      if (sortableText && !this.isJenkinsModeActive && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        this.handleSort(sortableText);
      }
    });
  }
  
  setupJenkinsModeListeners() {
    // Listen for Jenkins mode events
    document.addEventListener('jenkinsModeEnabled', () => {
      this.setJenkinsMode(true);
    });
    
    document.addEventListener('jenkinsModeDisabled', () => {
      this.setJenkinsMode(false);
    });
  }
  
  setJenkinsMode(enabled) {
    this.isJenkinsModeActive = enabled;
    
    // Update visual state of sortable headers
    const sortableTexts = this.container.querySelectorAll('.sortable-text');
    sortableTexts.forEach(sortableText => {
      if (enabled) {
        sortableText.classList.add('sorting-disabled');
        sortableText.setAttribute('aria-disabled', 'true');
        sortableText.style.cursor = 'default';
      } else {
        sortableText.classList.remove('sorting-disabled');
        sortableText.removeAttribute('aria-disabled');
        sortableText.style.cursor = 'pointer';
      }
    });
  }
  
  handleSort(sortButton) {
    const table = sortButton.closest('table');
    if (!table) return;
    
    const tableId = table.id || this.generateTableId(table);
    const columnIndex = this.getColumnIndex(sortButton);
    
    // Get current sort state
    const currentState = this.sortStates.get(tableId) || { 
      column: columnIndex, 
      ascending: true 
    };
    
    // Toggle direction if same column, otherwise reset to ascending
    const ascending = currentState.column === columnIndex 
      ? !currentState.ascending 
      : true;
    
    // Update sort state
    this.sortStates.set(tableId, { column: columnIndex, ascending });
    
    // Perform sort
    this.sortTable(table, columnIndex, ascending);
    
    // Update UI indicators
    this.updateSortIndicators(table, sortButton, ascending);
    
    // Announce to screen readers
    this.announceSort(sortButton, ascending);
  }
  
  getColumnIndex(sortButton) {
    const th = sortButton.closest('th');
    if (!th) return 0;
    
    const row = th.closest('tr');
    return Array.from(row.children).indexOf(th);
  }
  
  sortTable(table, columnIndex, ascending = true) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    // Sort rows based on column content
    rows.sort((a, b) => {
      const cellA = a.children[columnIndex];
      const cellB = b.children[columnIndex];
      
      if (!cellA || !cellB) return 0;
      
      // Get sort value (data attribute or text content)
      const valueA = this.getSortValue(cellA);
      const valueB = this.getSortValue(cellB);
      
      // Handle different data types
      const comparison = this.compareValues(valueA, valueB);
      
      return ascending ? comparison : -comparison;
    });
    
    // Re-append sorted rows
    rows.forEach(row => tbody.appendChild(row));
    
    // Trigger custom event
    table.dispatchEvent(new CustomEvent('tableSorted', {
      detail: { columnIndex, ascending, rowCount: rows.length }
    }));
  }
  
  getSortValue(cell) {
    // Priority: data-sort attribute > data-target attribute > text content
    if (cell.dataset.sort) {
      return cell.dataset.sort;
    }
    
    if (cell.dataset.target) {
      return cell.dataset.target;
    }
    
    // For cells with status badges, extract status text
    const statusBadge = cell.querySelector('.status-badge');
    if (statusBadge) {
      const status = statusBadge.dataset.status || statusBadge.textContent.trim();
      // Prioritize status for sorting: SUCCESS > PENDING > RUNNING > FAILED > others
      const statusPriority = {
        'SUCCESS': '1',
        'PENDING': '2', 
        'RUNNING': '3',
        'FAILED': '4',
        'REQUESTED': '5',
        'WAITING': '6'
      };
      return statusPriority[status] || '9_' + status;
    }
    
    return cell.textContent.trim();
  }
  
  compareValues(a, b) {
    // Try numeric comparison first
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    
    // Fall back to string comparison
    return a.localeCompare(b, undefined, { 
      numeric: true, 
      sensitivity: 'base' 
    });
  }
  
  updateSortIndicators(table, activeSortable, ascending) {
    // Reset all sort indicators in the table
    const allSortableTexts = table.querySelectorAll('.sortable-text');
    allSortableTexts.forEach(sortableText => {
      const th = sortableText.closest('th');
      if (th) {
        th.removeAttribute('aria-sort');
        sortableText.classList.remove('sort-asc', 'sort-desc');
      }
    });
    
    // Set active sort indicator
    const activeTh = activeSortable.closest('th');
    if (activeTh) {
      activeTh.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
      activeSortable.classList.add(ascending ? 'sort-asc' : 'sort-desc');
    }
  }
  
  announceSort(sortableText, ascending) {
    const th = sortableText.closest('th');
    if (!th) return;
    
    const columnName = th.textContent.trim().replace(/\s+/g, ' ');
    const direction = ascending ? 'ascending' : 'descending';
    
    // Create announcement for screen readers
    const announcement = `Table sorted by ${columnName} in ${direction} order`;
    this.announceToScreenReader(announcement);
  }
  
  announceToScreenReader(message) {
    // Create or update live region for announcements
    let liveRegion = document.getElementById('sort-announcements');
    
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'sort-announcements';
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
  
  generateTableId(table) {
    // Generate a unique ID for tables without one
    const id = `table-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    table.id = id;
    return id;
  }
  
  // Public API methods
  sortByColumn(tableSelector, columnIndex, ascending = true) {
    const table = typeof tableSelector === 'string' 
      ? document.querySelector(tableSelector) 
      : tableSelector;
    
    if (!table) return;
    
    this.sortTable(table, columnIndex, ascending);
    
    // Update indicators if sort button exists
    const th = table.querySelector(`thead tr th:nth-child(${columnIndex + 1})`);
    const sortButton = th?.querySelector('.sorting');
    if (sortButton) {
      this.updateSortIndicators(table, sortButton, ascending);
    }
  }
  
  getSortState(tableSelector) {
    const table = typeof tableSelector === 'string' 
      ? document.querySelector(tableSelector) 
      : tableSelector;
    
    if (!table) return null;
    
    const tableId = table.id || this.generateTableId(table);
    return this.sortStates.get(tableId) || null;
  }
  
  // Static method to initialize sorter
  static init(containerSelector) {
    return new TableSorter(containerSelector);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TableSorter;
}
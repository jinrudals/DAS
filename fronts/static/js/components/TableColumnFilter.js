/**
 * Table Column Filter Component
 * Orchestrates dropdown-based filtering for all table columns
 */

class TableColumnFilter {
  constructor(tableSelector, options = {}) {
    this.table = typeof tableSelector === 'string' 
      ? document.querySelector(tableSelector) 
      : tableSelector;
    
    if (!this.table) {
      console.warn('TableColumnFilter: Table not found');
      return;
    }
    
    this.options = {
      filterClass: 'das-filter-hidden',
      debounceMs: 150,
      ...options
    };
    
    // Filter state management
    this.filterState = {
      target: new Set(),
      owner: new Set(), 
      criteria: {} // Will be populated with criterion names as keys
    };
    
    // Cache for performance
    this.filterOptions = {
      target: new Set(),
      owner: new Set(),
      criteria: {} // criterion name -> Set of unique statuses
    };
    
    // References to filter dropdowns
    this.filterDropdowns = new Map();
    
    // Debounced filter function
    this.debouncedApplyFilters = this.debounce(
      this.applyFilters.bind(this), 
      this.options.debounceMs
    );
    
    this.init();
  }
  
  init() {
    this.extractFilterOptions();
    this.createFilterDropdowns();
    this.setupEventListeners();
    
    // Announce initialization
    this.announceToScreenReader('Column filters initialized');
  }
  
  extractFilterOptions() {
    const tbody = this.table.querySelector('tbody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr[data-target-name]');
    
    // Extract unique targets
    rows.forEach(row => {
      const targetName = row.dataset.targetName;
      if (targetName) {
        this.filterOptions.target.add(targetName);
      }
    });
    
    // Extract unique owners
    rows.forEach(row => {
      const ownerCell = row.querySelector('.sticky-col-2');
      if (ownerCell) {
        const ownerText = ownerCell.textContent.trim();
        if (ownerText && ownerText !== '—' && ownerText !== '-') {
          this.filterOptions.owner.add(ownerText);
        }
      }
    });
    
    // Extract unique statuses per criterion
    const criterionHeaders = this.table.querySelectorAll('th[data-criterion]:not([data-criterion="__row__"]):not([data-criterion="__owner__"])');
    
    criterionHeaders.forEach(header => {
      const criterion = header.dataset.criterion;
      this.filterOptions.criteria[criterion] = new Set();
      this.filterState.criteria[criterion] = new Set();
      
      // Find all status badges for this criterion
      const criterionCells = this.table.querySelectorAll(`td[data-criterion="${criterion}"]`);
      criterionCells.forEach(cell => {
        const statusBadges = cell.querySelectorAll('.status-badge[data-status]');
        if (statusBadges.length > 0) {
          statusBadges.forEach(badge => {
            const status = badge.dataset.status;
            if (status) {
              this.filterOptions.criteria[criterion].add(status);
            }
          });
        } else {
          // Cell with no executions
          this.filterOptions.criteria[criterion].add('N/A');
        }
      });
    });
  }
  
  createFilterDropdowns() {
    // Create target filter dropdown
    const targetHeader = this.table.querySelector('th[data-criterion="__row__"]');
    if (targetHeader && this.filterOptions.target.size > 0) {
      this.createFilterDropdown(targetHeader, 'target', Array.from(this.filterOptions.target).sort());
    }
    
    // Create owner filter dropdown
    const ownerHeader = this.table.querySelector('th[data-criterion="__owner__"]');
    if (ownerHeader && this.filterOptions.owner.size > 0) {
      this.createFilterDropdown(ownerHeader, 'owner', Array.from(this.filterOptions.owner).sort());
    }
    
    // Create criterion filter dropdowns
    Object.keys(this.filterOptions.criteria).forEach(criterion => {
      const header = this.table.querySelector(`th[data-criterion="${criterion}"]`);
      if (header && this.filterOptions.criteria[criterion].size > 0) {
        const statuses = Array.from(this.filterOptions.criteria[criterion]).sort();
        this.createFilterDropdown(header, 'criteria', statuses, criterion);
      }
    });
  }
  
  createFilterDropdown(headerElement, filterType, options, criterion = null) {
    const filterId = criterion ? `${filterType}-${criterion}` : filterType;
    const dropdownId = `filter-dropdown-${filterId}`;
    
    // Create filter button
    const filterButton = document.createElement('button');
    filterButton.className = 'btn btn-outline-secondary btn-sm ms-2 das-column-filter';
    filterButton.type = 'button';
    filterButton.dataset.filterId = filterId;
    filterButton.setAttribute('aria-expanded', 'false');
    filterButton.setAttribute('aria-label', `Filter ${criterion || filterType}`);
    filterButton.innerHTML = `
      <i class="bi bi-funnel" aria-hidden="true"></i>
      <span class="das-filter-badge d-none">0</span>
    `;
    
    // Create dropdown menu
    const dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'dropdown-menu das-column-filter-dropdown';
    dropdownMenu.id = dropdownId;
    dropdownMenu.setAttribute('role', 'menu');
    dropdownMenu.style.display = 'none'; // Initially hidden
    
    // Create dropdown content
    const dropdownContent = this.createDropdownContent(filterType, options, criterion);
    dropdownMenu.appendChild(dropdownContent);
    
    // Append dropdown to body to avoid z-index issues
    document.body.appendChild(dropdownMenu);
    
    // Create dropdown container (just the button)
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'dropdown d-inline';
    dropdownContainer.appendChild(filterButton);
    
    // Append to header
    headerElement.appendChild(dropdownContainer);
    
    // Store reference
    this.filterDropdowns.set(filterId, {
      button: filterButton,
      menu: dropdownMenu,
      container: dropdownContainer,
      filterType,
      criterion,
      options
    });
  }
  
  createDropdownContent(filterType, options, criterion) {
    const container = document.createElement('div');
    container.className = 'das-filter-dropdown-content';
    
    // Header with select all/clear all
    const header = document.createElement('div');
    header.className = 'das-filter-header border-bottom p-2';
    header.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <small class="text-muted fw-medium">Filter ${criterion || filterType}</small>
        <div>
          <button type="button" class="btn btn-link btn-sm p-0 me-2 das-select-all" 
                  aria-label="Select all ${criterion || filterType} options">
            All
          </button>
          <button type="button" class="btn btn-link btn-sm p-0 das-clear-all"
                  aria-label="Clear all ${criterion || filterType} selections">
            Clear
          </button>
        </div>
      </div>
    `;
    
    // Options list
    const optionsList = document.createElement('div');
    optionsList.className = 'das-filter-options';
    optionsList.setAttribute('role', 'group');
    optionsList.setAttribute('aria-label', `${criterion || filterType} filter options`);
    
    options.forEach(option => {
      const optionElement = document.createElement('div');
      optionElement.className = 'form-check px-3 py-1';
      
      const checkboxId = `filter-${filterType}-${criterion || 'default'}-${option.replace(/\W/g, '-')}`;
      
      optionElement.innerHTML = `
        <label class="form-check-label d-flex align-items-center w-100 m-0" for="${checkboxId}">
          <input class="form-check-input me-2 das-filter-option" 
                 type="checkbox" 
                 id="${checkboxId}"
                 value="${option}"
                 data-filter-type="${filterType}"
                 ${criterion ? `data-criterion="${criterion}"` : ''}
                 aria-label="Include ${option}">
          <span class="flex-grow-1 text-truncate">${option}</span>
        </label>
      `;
      
      optionsList.appendChild(optionElement);
    });
    
    container.appendChild(header);
    container.appendChild(optionsList);
    
    return container;
  }
  
  setupEventListeners() {
    // Handle filter button clicks (custom dropdown toggle)
    this.table.addEventListener('click', (event) => {
      if (event.target.closest('.das-column-filter')) {
        event.preventDefault();
        const button = event.target.closest('.das-column-filter');
        const filterId = button.dataset.filterId;
        this.toggleDropdown(filterId);
      } else if (event.target.classList.contains('das-select-all')) {
        this.handleSelectAll(event.target);
      } else if (event.target.classList.contains('das-clear-all')) {
        this.handleClearAll(event.target);
      }
    });
    
    // Handle filter option changes
    document.addEventListener('change', (event) => {
      if (event.target.classList.contains('das-filter-option')) {
        this.handleFilterChange(event.target);
      }
    });
    
    // Handle select all/clear all buttons in body-appended dropdowns
    document.addEventListener('click', (event) => {
      if (event.target.classList.contains('das-select-all')) {
        this.handleSelectAll(event.target);
      } else if (event.target.classList.contains('das-clear-all')) {
        this.handleClearAll(event.target);
      }
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.das-column-filter') && 
          !event.target.closest('.das-column-filter-dropdown')) {
        this.closeAllDropdowns();
      }
    });
    
    // Listen for Jenkins mode changes
    document.addEventListener('jenkinsModeEnabled', () => {
      this.setFiltersEnabled(false);
    });
    
    document.addEventListener('jenkinsModeDisabled', () => {
      this.setFiltersEnabled(true);
    });
  }
  
  handleFilterChange(checkbox) {
    const filterType = checkbox.dataset.filterType;
    const criterion = checkbox.dataset.criterion;
    const value = checkbox.value;
    const isChecked = checkbox.checked;
    
    // Update filter state
    if (filterType === 'criteria' && criterion) {
      // Ensure the Set exists for this criterion
      if (!this.filterState.criteria[criterion]) {
        this.filterState.criteria[criterion] = new Set();
      }
      
      if (isChecked) {
        this.filterState.criteria[criterion].add(value);
      } else {
        this.filterState.criteria[criterion].delete(value);
      }
    } else {
      // Ensure the Set exists for this filter type
      if (!this.filterState[filterType]) {
        this.filterState[filterType] = new Set();
      }
      
      if (isChecked) {
        this.filterState[filterType].add(value);
      } else {
        this.filterState[filterType].delete(value);
      }
    }
    
    // Update badge
    this.updateFilterBadge(filterType, criterion);
    
    // Apply filters
    this.debouncedApplyFilters();
  }
  
  handleSelectAll(button) {
    const dropdown = button.closest('.das-column-filter-dropdown');
    const checkboxes = dropdown.querySelectorAll('.das-filter-option');
    
    checkboxes.forEach(checkbox => {
      if (!checkbox.checked) {
        checkbox.checked = true;
        this.handleFilterChange(checkbox);
      }
    });
  }
  
  handleClearAll(button) {
    const dropdown = button.closest('.das-column-filter-dropdown');
    const checkboxes = dropdown.querySelectorAll('.das-filter-option');
    
    checkboxes.forEach(checkbox => {
      if (checkbox.checked) {
        checkbox.checked = false;
        this.handleFilterChange(checkbox);
      }
    });
  }
  
  updateFilterBadge(filterType, criterion) {
    const filterId = criterion ? `${filterType}-${criterion}` : filterType;
    const filterInfo = this.filterDropdowns.get(filterId);
    
    if (!filterInfo) return;
    
    let activeCount = 0;
    if (filterType === 'criteria' && criterion) {
      activeCount = this.filterState.criteria[criterion].size;
    } else {
      activeCount = this.filterState[filterType].size;
    }
    
    const badge = filterInfo.button.querySelector('.das-filter-badge');
    if (activeCount > 0) {
      badge.textContent = activeCount;
      badge.classList.remove('d-none');
      filterInfo.button.classList.add('active');
    } else {
      badge.classList.add('d-none');
      filterInfo.button.classList.remove('active');
    }
  }
  
  applyFilters() {
    const tbody = this.table.querySelector('tbody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr[data-target-name]');
    let visibleCount = 0;
    
    rows.forEach(row => {
      if (this.shouldShowRow(row)) {
        row.classList.remove(this.options.filterClass);
        visibleCount++;
      } else {
        row.classList.add(this.options.filterClass);
      }
    });
    
    // Announce filter results
    this.announceToScreenReader(`Showing ${visibleCount} of ${rows.length} rows`);
    
    // Trigger custom event
    this.table.dispatchEvent(new CustomEvent('tableFiltered', {
      detail: { visibleRows: visibleCount, totalRows: rows.length }
    }));
  }
  
  shouldShowRow(row) {
    // Check target filter
    if (this.filterState.target.size > 0) {
      const rowTarget = row.dataset.targetName;
      if (!this.filterState.target.has(rowTarget)) {
        return false;
      }
    }
    
    // Check owner filter
    if (this.filterState.owner.size > 0) {
      const ownerCell = row.querySelector('.sticky-col-2');
      const ownerText = ownerCell ? ownerCell.textContent.trim() : '';
      if (!this.filterState.owner.has(ownerText)) {
        return false;
      }
    }
    
    // Check criteria filters
    for (const [criterion, selectedStatuses] of Object.entries(this.filterState.criteria)) {
      if (selectedStatuses.size > 0) {
        const criterionCell = row.querySelector(`td[data-criterion="${criterion}"]`);
        if (!criterionCell) continue;
        
        const statusBadges = criterionCell.querySelectorAll('.status-badge[data-status]');
        
        if (statusBadges.length === 0) {
          // No executions, check if "N/A" is selected
          if (!selectedStatuses.has('N/A')) {
            return false;
          }
        } else {
          // Has executions, check if ANY match selected statuses
          const hasMatch = Array.from(statusBadges).some(badge => 
            selectedStatuses.has(badge.dataset.status)
          );
          if (!hasMatch) {
            return false;
          }
        }
      }
    }
    
    return true;
  }
  
  setFiltersEnabled(enabled) {
    this.filterDropdowns.forEach(filterInfo => {
      filterInfo.button.disabled = !enabled;
      if (!enabled) {
        filterInfo.button.setAttribute('aria-disabled', 'true');
      } else {
        filterInfo.button.removeAttribute('aria-disabled');
      }
    });
  }
  
  clearAllFilters() {
    // Clear all filter state
    this.filterState.target.clear();
    this.filterState.owner.clear();
    Object.keys(this.filterState.criteria).forEach(criterion => {
      this.filterState.criteria[criterion].clear();
    });
    
    // Uncheck all checkboxes
    this.table.querySelectorAll('.das-filter-option').forEach(checkbox => {
      checkbox.checked = false;
    });
    
    // Update all badges
    this.filterDropdowns.forEach((filterInfo) => {
      this.updateFilterBadge(filterInfo.filterType, filterInfo.criterion);
    });
    
    // Apply filters (show all rows)
    this.applyFilters();
    
    this.announceToScreenReader('All filters cleared');
  }
  
  getFilterState() {
    return {
      target: Array.from(this.filterState.target),
      owner: Array.from(this.filterState.owner),
      criteria: Object.fromEntries(
        Object.entries(this.filterState.criteria).map(([k, v]) => [k, Array.from(v)])
      )
    };
  }
  
  setFilterState(state) {
    // Update internal state
    this.filterState.target = new Set(state.target || []);
    this.filterState.owner = new Set(state.owner || []);
    
    Object.keys(this.filterState.criteria).forEach(criterion => {
      this.filterState.criteria[criterion] = new Set(state.criteria?.[criterion] || []);
    });
    
    // Update UI
    this.table.querySelectorAll('.das-filter-option').forEach(checkbox => {
      const filterType = checkbox.dataset.filterType;
      const criterion = checkbox.dataset.criterion;
      const value = checkbox.value;
      
      let shouldBeChecked = false;
      if (filterType === 'criteria' && criterion) {
        shouldBeChecked = this.filterState.criteria[criterion].has(value);
      } else {
        shouldBeChecked = this.filterState[filterType].has(value);
      }
      
      checkbox.checked = shouldBeChecked;
    });
    
    // Update badges
    this.filterDropdowns.forEach((filterInfo) => {
      this.updateFilterBadge(filterInfo.filterType, filterInfo.criterion);
    });
    
    // Apply filters
    this.applyFilters();
  }
  
  announceToScreenReader(message) {
    let liveRegion = document.getElementById('column-filter-announcements');
    
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'column-filter-announcements';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }
    
    liveRegion.textContent = '';
    setTimeout(() => {
      liveRegion.textContent = message;
    }, 100);
  }
  
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  toggleDropdown(filterId) {
    const filterInfo = this.filterDropdowns.get(filterId);
    if (!filterInfo) return;
    
    const { button, menu } = filterInfo;
    const isOpen = menu.style.display !== 'none';
    
    // Close all other dropdowns first
    this.closeAllDropdowns();
    
    if (!isOpen) {
      // Position and show dropdown
      this.positionDropdown(button, menu);
      menu.style.display = 'block';
      menu.classList.add('show');
      button.setAttribute('aria-expanded', 'true');
      button.classList.add('active');
    }
  }
  
  closeAllDropdowns() {
    this.filterDropdowns.forEach(filterInfo => {
      const { button, menu } = filterInfo;
      menu.style.display = 'none';
      menu.classList.remove('show');
      button.setAttribute('aria-expanded', 'false');
      button.classList.remove('active');
    });
  }
  
  positionDropdown(button, menu) {
    const buttonRect = button.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // Position dropdown below button
    menu.style.position = 'absolute';
    menu.style.top = (buttonRect.bottom + scrollTop + 2) + 'px';
    menu.style.left = (buttonRect.left + scrollLeft) + 'px';
    menu.style.zIndex = '1060';
    
    // Ensure dropdown doesn't go off screen
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Adjust horizontal position if needed
    if (buttonRect.left + menu.offsetWidth > viewportWidth) {
      menu.style.left = (buttonRect.right + scrollLeft - menu.offsetWidth) + 'px';
    }
    
    // Adjust vertical position if needed
    if (buttonRect.bottom + menu.offsetHeight > viewportHeight) {
      menu.style.top = (buttonRect.top + scrollTop - menu.offsetHeight - 2) + 'px';
    }
  }
  
  // Static method to initialize
  static init(tableSelector, options) {
    return new TableColumnFilter(tableSelector, options);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TableColumnFilter;
}
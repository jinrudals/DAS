/**
 * Jenkins Mode Component
 * Handles Jenkins integration, cell selection, and submission
 */

class JenkinsMode {
  constructor(options = {}) {
    this.options = {
      triggerSelector: '#to-jenkins',
      controlsSelector: '#jenkins-controls',
      submitSelector: '#jenkins-submit',
      cancelSelector: '#jenkins-cancel',
      branchInputSelector: '#branch-input',
      typeSelectSelector: 'select[name="type"]',
      tableSelector: '.status-table',
      cellSelector: 'td[data-target][data-criterion]:not([data-criterion="__row__"]):not([data-criterion="__owner__"])',
      headerSelector: 'th[data-criterion]:not([data-criterion="__row__"]):not([data-criterion="__owner__"])',
      ...options
    };
    
    this.isActive = false;
    this.clickedCells = new Set();
    this.loadingStates = new Map();
    
    this.init();
  }
  
  init() {
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Jenkins mode toggle
    const triggerBtn = document.querySelector(this.options.triggerSelector);
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => this.enableJenkinsMode());
    }
    
    // Cancel button
    const cancelBtn = document.querySelector(this.options.cancelSelector);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.disableJenkinsMode());
    }
    
    // Submit button
    const submitBtn = document.querySelector(this.options.submitSelector);
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.submitSelection());
    }
    
    // Cell interactions (using event delegation)
    document.addEventListener('click', (event) => {
      if (!this.isActive) return;
      
      const cell = event.target.closest(this.options.cellSelector);
      const header = event.target.closest(this.options.headerSelector);
      const sortableText = event.target.closest('.sortable-text');
      const targetOwnerCell = event.target.closest('td[data-criterion="__row__"], td[data-criterion="__owner__"]');
      
      if (cell) {
        this.toggleCell(cell);
      } else if (header) {
        this.toggleColumn(header);
      } else if (sortableText) {
        // Handle clicks on sortable text (which is inside headers)
        const headerElement = sortableText.closest('th[data-criterion]');
        if (headerElement && this.isValidCriterionHeader(headerElement)) {
          this.toggleColumn(headerElement);
        }
      } else if (targetOwnerCell) {
        // Handle target/owner cell clicks - select entire row (fix for DAS-6)
        this.toggleRow(targetOwnerCell);
      }
    });
    
    // Keyboard support
    document.addEventListener('keydown', (event) => {
      if (!this.isActive) return;
      
      if (event.key === 'Enter' || event.key === ' ') {
        const cell = event.target.closest(this.options.cellSelector);
        const header = event.target.closest(this.options.headerSelector);
        const targetOwnerCell = event.target.closest('td[data-criterion="__row__"], td[data-criterion="__owner__"]');
        
        if (cell || header || targetOwnerCell) {
          event.preventDefault();
          if (cell) this.toggleCell(cell);
          if (header) this.toggleColumn(header);
          if (targetOwnerCell) this.toggleRow(targetOwnerCell);
        }
      }
    });
  }
  
  enableJenkinsMode() {
    this.isActive = true;
    
    // Update UI
    const triggerBtn = document.querySelector(this.options.triggerSelector);
    const controls = document.querySelector(this.options.controlsSelector);
    
    if (triggerBtn) {
      triggerBtn.classList.remove('btn-outline-primary');
      triggerBtn.classList.add('btn-primary');
      triggerBtn.setAttribute('aria-pressed', 'true');
    }
    
    if (controls) {
      controls.style.display = 'block';
    }
    
    // Disable modal links
    const tables = document.querySelectorAll(this.options.tableSelector);
    tables.forEach(table => {
      const links = table.querySelectorAll('a');
      links.forEach(link => {
        link.style.pointerEvents = 'none';
        link.classList.add('text-muted');
        link.setAttribute('tabindex', '-1');
      });
      
      // Add clickable indicators
      const headers = table.querySelectorAll(this.options.headerSelector);
      headers.forEach(header => {
        header.classList.add('jenkins-clickable');
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-label', `Select all cells in ${header.textContent.trim()} column`);
      });
      
      const cells = table.querySelectorAll(this.options.cellSelector);
      cells.forEach(cell => {
        cell.classList.add('jenkins-clickable');
        cell.setAttribute('role', 'button');
        cell.setAttribute('tabindex', '0');
        cell.setAttribute('aria-label', `Select cell for ${cell.dataset.target} - ${cell.dataset.criterion}`);
      });
      
      // Mark target/owner cells as clickable but not selectable (fix for DAS-6)
      const targetOwnerCells = table.querySelectorAll('td[data-criterion="__row__"], td[data-criterion="__owner__"]');
      targetOwnerCells.forEach(cell => {
        cell.classList.add('jenkins-row-clickable');
        cell.style.cursor = 'pointer';
        cell.setAttribute('role', 'button');
        cell.setAttribute('tabindex', '0');
        cell.setAttribute('aria-label', `Click to select all criteria for ${cell.dataset.target || 'this row'}`);
      });
    });
    
    // Announce mode change
    this.announceToScreenReader('Jenkins mode enabled. Click cells or column headers to select.');
    
    // Trigger custom event
    document.dispatchEvent(new CustomEvent('jenkinsModeEnabled'));
  }
  
  disableJenkinsMode() {
    this.isActive = false;
    this.clickedCells.clear();
    
    // Update UI
    const triggerBtn = document.querySelector(this.options.triggerSelector);
    const controls = document.querySelector(this.options.controlsSelector);
    
    if (triggerBtn) {
      triggerBtn.classList.remove('btn-primary');
      triggerBtn.classList.add('btn-outline-primary');
      triggerBtn.setAttribute('aria-pressed', 'false');
    }
    
    if (controls) {
      controls.style.display = 'none';
    }
    
    // Re-enable modal links and clean up
    const tables = document.querySelectorAll(this.options.tableSelector);
    tables.forEach(table => {
      const links = table.querySelectorAll('a');
      links.forEach(link => {
        link.style.pointerEvents = 'auto';
        link.classList.remove('text-muted');
        link.removeAttribute('tabindex');
      });
      
      // Remove clickable indicators
      const clickableElements = table.querySelectorAll('.jenkins-clickable');
      clickableElements.forEach(element => {
        element.classList.remove('jenkins-clickable');
        element.removeAttribute('role');
        element.removeAttribute('tabindex');
        element.removeAttribute('aria-label');
      });
      
      // Remove all selected cell highlights (fix for DAS-5)
      const selectedCells = table.querySelectorAll('.table-success');
      selectedCells.forEach(cell => {
        cell.classList.remove('table-success');
        cell.setAttribute('aria-selected', 'false');
      });
      
      // Clean up target/owner cell indicators (fix for DAS-6)
      const targetOwnerCells = table.querySelectorAll('.jenkins-row-clickable');
      targetOwnerCells.forEach(cell => {
        cell.classList.remove('jenkins-row-clickable');
        cell.style.cursor = '';
        cell.removeAttribute('role');
        cell.removeAttribute('tabindex');
        cell.removeAttribute('aria-label');
      });
    });
    
    // Update selection count display
    this.updateSelectionCount();
    
    // Announce mode change
    this.announceToScreenReader('Jenkins mode disabled. All selections cleared.');
    
    // Trigger custom event
    document.dispatchEvent(new CustomEvent('jenkinsModeDisabled'));
  }
  
  toggleCell(cell) {
    const target = cell.dataset.target;
    const criterion = cell.dataset.criterion;
    console.log('Jenkins Mode: toggleCell called with target:', target, 'criterion:', criterion);
    
    const key = this.getCellKey(target, criterion);
    console.log('Jenkins Mode: Generated key:', key);
    
    if (this.clickedCells.has(key)) {
      console.log('Jenkins Mode: Removing cell from selection');
      this.clickedCells.delete(key);
      cell.classList.remove('table-success');
      cell.setAttribute('aria-selected', 'false');
    } else {
      console.log('Jenkins Mode: Adding cell to selection');
      this.clickedCells.add(key);
      cell.classList.add('table-success');
      cell.setAttribute('aria-selected', 'true');
    }
    
    console.log('Jenkins Mode: clickedCells size after toggle:', this.clickedCells.size);
    this.updateSelectionCount();
  }
  
  toggleColumn(header) {
    const criterion = header.dataset.criterion;
    console.log('Jenkins Mode: toggleColumn called for criterion:', criterion);
    
    const clickedTargets = this.getClickedTargets();
    
    // Find all cells in this column
    let cells;
    if (clickedTargets.length > 0) {
      // Only toggle cells for already selected targets
      const selectors = clickedTargets.map(target => 
        `${this.options.cellSelector}[data-target="${target}"][data-criterion="${criterion}"]`
      );
      cells = document.querySelectorAll(selectors.join(', '));
    } else {
      // Toggle all visible cells in the column
      cells = document.querySelectorAll(
        `${this.options.cellSelector}[data-criterion="${criterion}"]`
      );
    }
    
    console.log('Jenkins Mode: Found cells:', cells.length);
    
    // Filter to visible cells only
    const visibleCells = Array.from(cells).filter(cell => {
      const row = cell.closest('tr');
      return row && getComputedStyle(row).display !== 'none';
    });
    
    console.log('Jenkins Mode: Visible cells:', visibleCells.length);
    console.log('Jenkins Mode: Current selection count before toggle:', this.clickedCells.size);
    
    // Group cells by target-criterion to determine toggle behavior
    const cellGroups = new Map();
    visibleCells.forEach(cell => {
      const key = this.getCellKey(cell.dataset.target, cell.dataset.criterion);
      if (!cellGroups.has(key)) {
        cellGroups.set(key, []);
      }
      cellGroups.get(key).push(cell);
    });
    
    console.log('Jenkins Mode: Cell groups:', cellGroups.size);
    
    // For each unique target-criterion combination, determine if we should select or deselect
    cellGroups.forEach((cellsInGroup, key) => {
      const isCurrentlySelected = this.clickedCells.has(key);
      const shouldSelect = !isCurrentlySelected;
      
      console.log(`Jenkins Mode: Processing group ${key}, currently selected: ${isCurrentlySelected}, will select: ${shouldSelect}`);
      
      if (shouldSelect) {
        // Select this target-criterion combination
        this.clickedCells.add(key);
        cellsInGroup.forEach(cell => {
          cell.classList.add('table-success');
          cell.setAttribute('aria-selected', 'true');
        });
      } else {
        // Deselect this target-criterion combination
        this.clickedCells.delete(key);
        cellsInGroup.forEach(cell => {
          cell.classList.remove('table-success');
          cell.setAttribute('aria-selected', 'false');
        });
      }
    });
    
    console.log('Jenkins Mode: Selection count after toggle:', this.clickedCells.size);
    console.log('Jenkins Mode: Selected cells:', Array.from(this.clickedCells));
    this.updateSelectionCount();
  }
  
  toggleRow(targetOwnerCell) {
    const target = targetOwnerCell.dataset.target;
    console.log('Jenkins Mode: toggleRow called for target:', target);
    
    if (!target) {
      console.warn('Jenkins Mode: No target found for row toggle');
      return;
    }
    
    const clickedCriteria = this.getClickedCriteria();
    
    // Find criteria cells in this row
    let cells;
    if (clickedCriteria.length > 0) {
      // Only toggle cells for already selected criteria
      const selectors = clickedCriteria.map(criterion => 
        `${this.options.cellSelector}[data-target="${target}"][data-criterion="${criterion}"]`
      );
      cells = document.querySelectorAll(selectors.join(', '));
    } else {
      // Toggle all visible cells in the row
      cells = document.querySelectorAll(
        `${this.options.cellSelector}[data-target="${target}"]`
      );
    }
    
    console.log('Jenkins Mode: Found row criteria cells:', cells.length);
    
    // Filter to visible cells only
    const visibleCells = Array.from(cells).filter(cell => {
      const row = cell.closest('tr');
      return row && getComputedStyle(row).display !== 'none';
    });
    
    console.log('Jenkins Mode: Visible row criteria cells:', visibleCells.length);
    
    if (visibleCells.length === 0) {
      console.warn('Jenkins Mode: No visible criteria cells found for target:', target);
      return;
    }
    
    // Determine if we should select or deselect all cells in this row
    const cellKeys = visibleCells.map(cell => this.getCellKey(cell.dataset.target, cell.dataset.criterion));
    const selectedCount = cellKeys.filter(key => this.clickedCells.has(key)).length;
    const shouldSelect = selectedCount < visibleCells.length;
    
    console.log(`Jenkins Mode: Row selection - should select: ${shouldSelect}, selected: ${selectedCount}/${visibleCells.length}`);
    
    // Toggle all criteria cells in the row
    visibleCells.forEach(cell => {
      const key = this.getCellKey(cell.dataset.target, cell.dataset.criterion);
      
      if (shouldSelect) {
        // Select this cell
        if (!this.clickedCells.has(key)) {
          this.clickedCells.add(key);
          cell.classList.add('table-success');
          cell.setAttribute('aria-selected', 'true');
        }
      } else {
        // Deselect this cell
        if (this.clickedCells.has(key)) {
          this.clickedCells.delete(key);
          cell.classList.remove('table-success');
          cell.setAttribute('aria-selected', 'false');
        }
      }
    });
    
    console.log('Jenkins Mode: Row toggle complete, selection count:', this.clickedCells.size);
    this.updateSelectionCount();
  }
  
  getCellKey(target, criterion) {
    return `${target}|||${criterion}`;
  }
  
  isValidCriterionHeader(headerElement) {
    const criterion = headerElement.dataset.criterion;
    return criterion && criterion !== '__row__' && criterion !== '__owner__';
  }
  
  getClickedTargets() {
    return [...new Set(Array.from(this.clickedCells).map(key => key.split('|||')[0]))];
  }
  
  getClickedCriteria() {
    return [...new Set(Array.from(this.clickedCells).map(key => key.split('|||')[1]))];
  }
  
  updateSelectionCount() {
    const count = this.clickedCells.size;
    const triggerBtn = document.querySelector(this.options.triggerSelector);
    
    if (triggerBtn) {
      const countText = count > 0 ? ` (${count})` : '';
      const originalText = triggerBtn.textContent.replace(/ \(\d+\)/, '');
      triggerBtn.textContent = originalText + countText;
    }
  }
  
  async submitSelection() {
    console.log('Jenkins Mode: Submit called with selection count:', this.clickedCells.size);
    console.log('Jenkins Mode: Selected cells for submission:', Array.from(this.clickedCells));
    
    if (this.clickedCells.size === 0) {
      alert('Please select at least one cell before submitting.');
      return;
    }
    
    const branchInput = document.querySelector(this.options.branchInputSelector);
    const typeSelect = document.querySelector(this.options.typeSelectSelector);
    
    const branchInfo = branchInput?.value || '';
    const workflowType = typeSelect?.value || '';
    
    const submitData = Array.from(this.clickedCells).map(cellKey => {
      const [target, criterion] = cellKey.split('|||');
      return {
        target,
        criterion,
        branch: branchInfo,
        workflow_type: workflowType
      };
    });
    
    // Show loading state
    this.setSubmitLoading(true);
    
    try {
      const response = await fetch('/api/jenkins-submit/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': this.getCsrfToken()
        },
        body: JSON.stringify(submitData)
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      await this.handleSubmitSuccess(result);
      
      // Announce success
      this.announceToScreenReader(`Successfully submitted ${this.clickedCells.size} selections to Jenkins.`);
      
    } catch (error) {
      console.error('Error submitting to Jenkins:', error);
      this.handleSubmitError(error);
      
      // Announce error
      this.announceToScreenReader('Error submitting selections. Please try again.');
      
    } finally {
      this.setSubmitLoading(false);
    }
  }
  
  async handleSubmitSuccess(result) {
    if (!result.data || !Array.isArray(result.data)) {
      throw new Error('Invalid response format');
    }
    
    // Update cells with new status
    result.data.forEach(item => {
      const cell = document.querySelector(
        `${this.options.cellSelector}[data-target="${item.target}"][data-criterion="${item.criterion_name}"]`
      );
      
      if (cell) {
        this.updateCellStatus(cell, item);
      }
    });
    
    // Exit Jenkins mode
    this.disableJenkinsMode();
  }
  
  updateCellStatus(cell, data) {
    const status = data.status || 'UNKNOWN';
    const badgeClass = this.getStatusBadgeClass(status);
    const owners = data.owners || '-';
    const tooltipLog = data.log_content || 'No logs available';
    
    const newContent = `
      <div class="mb-1">
        <a href="#"
           class="text-decoration-none"
           data-bs-toggle="modal"
           data-bs-target="#executionDetailModal"
           data-pk="${data.id || ''}"
           data-status="${status}"
           data-date="${data.executed_at || '-'}"
           data-branch="${data.branch || '-'}"
           data-commit="${data.commit || '-'}"
           data-path="${data.execution_path || '-'}"
           data-log="${tooltipLog}"
           data-owner="${owners}">
          <span class="badge status-badge ${badgeClass}" data-status="${status}">
            ${status}
          </span>
        </a>
      </div>
    `;
    
    cell.innerHTML = newContent;
  }
  
  getStatusBadgeClass(status) {
    const statusMap = {
      'SUCCESS': 'bg-success',
      'FAILED': 'bg-danger',
      'PENDING': 'bg-warning text-dark',
      'RUNNING': 'bg-primary',
      'UNKNOWN': 'bg-secondary'
    };
    
    return statusMap[status] || 'bg-secondary';
  }
  
  handleSubmitError(error) {
    const message = error.message || 'An error occurred while submitting to Jenkins.';
    alert(`Submission Error: ${message}`);
  }
  
  setSubmitLoading(loading) {
    const submitBtn = document.querySelector(this.options.submitSelector);
    
    if (!submitBtn) return;
    
    if (loading) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Submitting...';
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Submit';
    }
  }
  
  getCsrfToken() {
    const value = `; ${document.cookie}`;
    const parts = value.split('; csrftoken=');
    if (parts.length === 2) {
      return decodeURIComponent(parts.pop().split(';').shift());
    }
    return '';
  }
  
  announceToScreenReader(message) {
    // Create or update live region for announcements
    let liveRegion = document.getElementById('jenkins-announcements');
    
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'jenkins-announcements';
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
  
  // Public API methods
  getSelectedCells() {
    return Array.from(this.clickedCells);
  }
  
  clearSelection() {
    this.clickedCells.clear();
    
    // Remove visual selection
    const selectedCells = document.querySelectorAll('.table-success');
    selectedCells.forEach(cell => {
      cell.classList.remove('table-success');
      cell.setAttribute('aria-selected', 'false');
    });
    
    this.updateSelectionCount();
  }
  
  isJenkinsModeActive() {
    return this.isActive;
  }
  
  // Static method to initialize Jenkins mode
  static init(options) {
    return new JenkinsMode(options);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JenkinsMode;
}
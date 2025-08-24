/**
 * Execution Detail Modal Component
 * Handles modal display, data loading, and error states
 */

class ExecutionDetailModal {
  constructor(modalId = 'executionDetailModal') {
    this.modalId = modalId;
    this.modal = null;
    this.jenkinsMode = false;
    this.loadingTimeout = null;
    
    this.init();
  }
  
  init() {
    this.modal = document.getElementById(this.modalId);
    if (!this.modal) {
      console.warn(`Modal with ID ${this.modalId} not found`);
      return;
    }
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Bootstrap modal events
    this.modal.addEventListener('show.bs.modal', (event) => {
      this.handleModalShow(event);
    });
    
    this.modal.addEventListener('hidden.bs.modal', () => {
      this.handleModalHidden();
    });
  }
  
  handleModalShow(event) {
    if (this.jenkinsMode) {
      event.preventDefault();
      return;
    }
    
    const trigger = event.relatedTarget;
    if (!trigger) return;
    
    // Show loading state immediately
    this.showLoadingState();
    
    // Get execution ID from trigger
    const executionId = trigger.dataset.pk;
    
    // Store repository data from trigger for immediate display
    this.repositoryData = {
      name: trigger.dataset.repositoryName || '',
      url: trigger.dataset.repositoryUrl || ''
    };
    
    if (executionId) {
      this.loadExecutionDetails(executionId);
    } else {
      this.showError('No execution ID provided');
    }
  }
  
  handleModalHidden() {
    // Reset modal state
    this.hideAllStates();
  }
  
  showLoadingState() {
    this.hideAllStates();
    const loadingEl = this.modal.querySelector(`#${this.modalId}-loading`);
    if (loadingEl) {
      loadingEl.classList.remove('d-none');
    }
  }
  
  showErrorState(message = 'An error occurred') {
    this.hideAllStates();
    const errorEl = this.modal.querySelector(`#${this.modalId}-error`);
    if (errorEl) {
      errorEl.classList.remove('d-none');
      const errorText = errorEl.querySelector('.alert p');
      if (errorText) {
        errorText.textContent = message;
      }
    }
  }
  
  showContentState() {
    this.hideAllStates();
    const contentEl = this.modal.querySelector(`#${this.modalId}-content`);
    if (contentEl) {
      contentEl.classList.remove('d-none');
    }
  }
  
  hideAllStates() {
    const states = ['loading', 'error', 'content'];
    states.forEach(state => {
      const el = this.modal.querySelector(`#${this.modalId}-${state}`);
      if (el) {
        el.classList.add('d-none');
      }
    });
  }
  
  async loadExecutionDetails(executionId) {
    // Set loading timeout
    this.loadingTimeout = setTimeout(() => {
      this.showError('Request timeout. Please try again.');
    }, 30000); // 30 second timeout
    
    try {
      const response = await fetch(`/api/execution-detail/${executionId}/`);
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.populateModalData(data);
      this.showContentState();
      
    } catch (error) {
      console.error('Error loading execution details:', error);
      this.showError(error.message || 'Failed to load execution details');
    } finally {
      if (this.loadingTimeout) {
        clearTimeout(this.loadingTimeout);
        this.loadingTimeout = null;
      }
    }
  }
  
  populateModalData(data) {
    // Basic information
    this.setElementText('#modal-status', data.status || '-');
    this.setElementText('#modal-start-at', this.formatDateTime(data.start_at || data.date) || '-');
    this.setElementText('#modal-updated-at', this.formatDateTime(data.updated_at) || '-');
    this.setElementText('#modal-branch', data.branch || '-');
    this.setElementText('#modal-commit', data.commit || '-');
    this.setElementText('#modal-path', data.path || '-');
    this.setElementText('#modal-logfile', data.log_file_path || '-');
    
    // Log content
    this.setElementText('#modal-log', data.log_content || 'No log content available');
    
    // Handle Jenkins build number
    this.handleBuildNumber(data.build_number);
    
    // Handle log file link
    this.handleLogFileLink(data.log_file_url);
    
    // Handle owners
    this.handleOwners(data.owners);
    
    // Handle repository link (now comes from API)
    this.handleRepositoryLink(data.repository_name, data.repository_url);
    
    // Handle admin link (if user is admin) 
    this.handleAdminLink(data.id);
  }
  
  formatDateTime(dateTimeString) {
    if (!dateTimeString) return null;
    
    try {
      const date = new Date(dateTimeString);
      
      // Format: YYYY-MM-DD HH:MM:SS
      const year = String(date.getFullYear());
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      console.warn('Failed to format datetime:', dateTimeString, error);
      return dateTimeString;
    }
  }
  
  setElementText(selector, text) {
    const element = this.modal.querySelector(selector);
    if (element) {
      element.textContent = text;
    }
  }
  
  handleBuildNumber(buildNumber) {
    const buildEl = this.modal.querySelector('#modal-buildnumber');
    if (!buildEl) return;
    
    if (buildNumber) {
      const jenkinsUrl = `http://192.128.1.90:9999/job/bos_soc_design/job/n1b0/job/n1b0_ws/job/automation/job/runner/${buildNumber}`;
      buildEl.innerHTML = `<a href="${jenkinsUrl}" target="_blank" rel="noopener noreferrer" class="text-decoration-none">
        <i class="bi bi-box-arrow-up-right me-1" aria-hidden="true"></i>
        Jenkins(${buildNumber})
      </a>`;
    } else {
      buildEl.textContent = '-';
    }
  }
  
  handleLogFileLink(logFileUrl) {
    const linkEl = this.modal.querySelector('#modal-logfile-link');
    const emptyEl = this.modal.querySelector('#modal-logfile-empty');
    
    if (!linkEl || !emptyEl) return;
    
    if (logFileUrl) {
      linkEl.href = logFileUrl;
      linkEl.classList.remove('d-none');
      emptyEl.classList.add('d-none');
    } else {
      linkEl.classList.add('d-none');
      emptyEl.classList.remove('d-none');
    }
  }
  
  handleOwners(owners) {
    const ownerList = this.modal.querySelector('#modal-owner');
    if (!ownerList) return;
    
    // Clear existing content
    ownerList.innerHTML = '';
    
    if (owners && owners !== '-') {
      const ownerArray = owners.split(';');
      ownerArray.forEach(owner => {
        const li = document.createElement('li');
        li.textContent = owner.trim();
        ownerList.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = '-';
      li.classList.add('text-muted');
      ownerList.appendChild(li);
    }
  }
  
  showError(message) {
    this.showErrorState(message);
  }
  
  handleRepositoryLink(repositoryName, repositoryUrl) {
    const linkEl = this.modal.querySelector('#modal-repository-link');
    const emptyEl = this.modal.querySelector('#modal-repository-empty');
    const nameEl = this.modal.querySelector('#modal-repository-name');
    
    if (!linkEl || !emptyEl || !nameEl) return;
    
    if (repositoryUrl && repositoryName) {
      linkEl.href = repositoryUrl;
      nameEl.textContent = repositoryName;
      linkEl.classList.remove('d-none');
      emptyEl.classList.add('d-none');
    } else {
      linkEl.classList.add('d-none');
      emptyEl.classList.remove('d-none');
      if (repositoryName) {
        emptyEl.textContent = repositoryName;
      } else {
        emptyEl.textContent = '-';
      }
    }
  }
  
  handleAdminLink(executionId) {
    const adminLinkEl = this.modal.querySelector('#modal-admin-link');
    if (!adminLinkEl) return;
    
    if (executionId) {
      // Construct admin URL for the execution
      const adminUrl = `/admin/modeling/execution/${executionId}/change/`;
      adminLinkEl.href = adminUrl;
      adminLinkEl.classList.remove('d-none');
    } else {
      adminLinkEl.classList.add('d-none');
    }
  }
  
  setJenkinsMode(enabled) {
    this.jenkinsMode = enabled;
  }
  
  // Static method to initialize modal
  static init(modalId) {
    return new ExecutionDetailModal(modalId);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExecutionDetailModal;
}
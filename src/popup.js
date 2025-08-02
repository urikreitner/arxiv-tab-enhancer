// ArXiv Tab Enhancer Popup Script

class PopupManager {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadStats();
    this.setupEventListeners();
    this.checkCurrentTab();
  }

  async loadStats() {
    try {
      // Get stats from background script
      const response = await this.sendMessageToBackground('getStats');
      if (response) {
        document.getElementById('cached-count').textContent = response.cachedPapers || 0;
        document.getElementById('memory-count').textContent = response.memoryCache || 0;
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
      document.getElementById('cached-count').textContent = 'Error';
      document.getElementById('memory-count').textContent = 'Error';
    }
  }

  setupEventListeners() {
    // Refresh current tab button
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.refreshCurrentTab();
    });

    // Clear cache button
    document.getElementById('clear-cache-btn').addEventListener('click', () => {
      this.clearCache();
    });

    // Options button (placeholder for future options page)
    document.getElementById('options-btn').addEventListener('click', () => {
      this.openOptions();
    });
  }

  async checkCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const statusElement = document.getElementById('status');
      
      if (tab && tab.url && this.isArxivUrl(tab.url)) {
        statusElement.className = 'status active';
        statusElement.textContent = '✓ ArXiv page detected';
      } else {
        statusElement.className = 'status inactive';
        statusElement.textContent = '⚠ Not on an ArXiv page';
      }
    } catch (error) {
      console.error('Failed to check current tab:', error);
    }
  }

  async refreshCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.url && this.isArxivUrl(tab.url)) {
        // Reload the tab to trigger content script
        await chrome.tabs.reload(tab.id);
        
        // Show feedback
        const btn = document.getElementById('refresh-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Refreshed!';
        btn.style.background = '#e7f5e7';
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
        }, 1500);
      } else {
        alert('Please navigate to an ArXiv page first');
      }
    } catch (error) {
      console.error('Failed to refresh tab:', error);
      alert('Failed to refresh tab');
    }
  }

  async clearCache() {
    try {
      // Clear storage cache
      const allData = await chrome.storage.local.get(null);
      const arxivKeys = Object.keys(allData).filter(key => key.startsWith('arxiv_'));
      
      if (arxivKeys.length > 0) {
        await chrome.storage.local.remove(arxivKeys);
        
        // Notify background script to clear memory cache
        this.sendMessageToBackground('clearMemoryCache');
        
        // Update stats
        await this.loadStats();
        
        // Show feedback
        const btn = document.getElementById('clear-cache-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Cache Cleared!';
        btn.style.background = '#e7f5e7';
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
        }, 1500);
      } else {
        alert('No cache to clear');
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert('Failed to clear cache');
    }
  }

  openOptions() {
    // Placeholder for future options page
    // For now, just show a simple alert
    alert('Options page coming soon!\n\nCurrent features:\n• Automatic title replacement\n• Smart title truncation\n• Category prefixes\n• Paper caching');
  }

  isArxivUrl(url) {
    return url && (url.includes('arxiv.org/abs/') || url.includes('arxiv.org/pdf/'));
  }

  sendMessageToBackground(action, data = {}) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action, ...data }, (response) => {
        resolve(response);
      });
    });
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});

// Handle background script messages for stats updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'statsUpdate') {
    document.getElementById('cached-count').textContent = message.stats.cachedPapers || 0;
    document.getElementById('memory-count').textContent = message.stats.memoryCache || 0;
  }
});
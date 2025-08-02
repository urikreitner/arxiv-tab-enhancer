// ArXiv Tab Enhancer Background Script
// Manages tab title updates and data caching

class ArxivBackgroundManager {
  constructor() {
    this.setupMessageListener();
    this.setupTabListeners();
    this.paperCache = new Map();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'updateTabTitle') {
        this.updateTabTitle(sender.tab.id, message.title, message.paperData);
      }
      return true;
    });
  }

  setupTabListeners() {
    // Listen for tab updates to handle navigation within ArXiv
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.handleTabUpdate(tabId, tab.url);
      }
    });

    // Listen for tab activation to potentially restore cached titles
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivation(activeInfo.tabId);
    });
  }

  async updateTabTitle(tabId, newTitle, paperData) {
    try {
      // Update the tab title
      await chrome.tabs.update(tabId, { title: newTitle });
      
      // Cache the paper data
      if (paperData && paperData.id) {
        this.cacheData(paperData);
      }
      
      console.log(`Updated tab ${tabId} title to: ${newTitle}`);
    } catch (error) {
      console.error('Failed to update tab title:', error);
    }
  }

  async handleTabUpdate(tabId, url) {
    // Check if this is an ArXiv URL and if we have cached data
    if (this.isArxivUrl(url)) {
      const paperId = this.extractPaperId(url);
      if (paperId) {
        const cachedData = await this.getCachedData(paperId);
        if (cachedData && cachedData.title) {
          // Use cached data to set title immediately
          let title = cachedData.title;
          if (title.length > 60) {
            title = title.substring(0, 57) + '...';
          }
          
          if (cachedData.category) {
            const categoryShort = cachedData.category.split('.')[0];
            title = `[${categoryShort}] ${title}`;
          }
          
          this.updateTabTitle(tabId, title, cachedData);
        }
      }
    }
  }

  async handleTabActivation(tabId) {
    // Optional: Could implement tab-specific behavior when tabs are activated
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url && this.isArxivUrl(tab.url)) {
        // Tab is an ArXiv page, could implement additional logic here
      }
    } catch (error) {
      // Tab might not exist anymore
    }
  }

  isArxivUrl(url) {
    return url && (url.includes('arxiv.org/abs/') || url.includes('arxiv.org/pdf/'));
  }

  extractPaperId(url) {
    const match = url.match(/\/(?:abs|pdf)\/([^/?]+)/);
    return match ? match[1] : null;
  }

  async cacheData(paperData) {
    try {
      const cacheKey = `arxiv_${paperData.id}`;
      await chrome.storage.local.set({
        [cacheKey]: {
          ...paperData,
          timestamp: Date.now()
        }
      });
      
      // Also keep in memory cache for faster access
      this.paperCache.set(paperData.id, paperData);
      
      // Clean up old cache entries (keep last 100 papers)
      this.cleanupCache();
    } catch (error) {
      console.error('Failed to cache paper data:', error);
    }
  }

  async getCachedData(paperId) {
    try {
      // Check memory cache first
      if (this.paperCache.has(paperId)) {
        return this.paperCache.get(paperId);
      }
      
      // Check storage cache
      const cacheKey = `arxiv_${paperId}`;
      const result = await chrome.storage.local.get(cacheKey);
      
      if (result[cacheKey]) {
        const data = result[cacheKey];
        // Check if cache is not too old (30 days)
        const maxAge = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - data.timestamp < maxAge) {
          this.paperCache.set(paperId, data);
          return data;
        } else {
          // Remove expired cache
          chrome.storage.local.remove(cacheKey);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  async cleanupCache() {
    try {
      // Keep memory cache reasonable size
      if (this.paperCache.size > 100) {
        const entries = Array.from(this.paperCache.entries());
        // Remove oldest 20 entries
        for (let i = 0; i < 20; i++) {
          this.paperCache.delete(entries[i][0]);
        }
      }
      
      // Clean up storage cache periodically
      const allData = await chrome.storage.local.get(null);
      const arxivKeys = Object.keys(allData).filter(key => key.startsWith('arxiv_'));
      
      if (arxivKeys.length > 200) {
        // Sort by timestamp and remove oldest entries
        const sorted = arxivKeys
          .map(key => ({ key, timestamp: allData[key].timestamp || 0 }))
          .sort((a, b) => a.timestamp - b.timestamp);
        
        const toRemove = sorted.slice(0, 50).map(item => item.key);
        await chrome.storage.local.remove(toRemove);
      }
    } catch (error) {
      console.error('Failed to cleanup cache:', error);
    }
  }

  // Utility method to get extension stats
  async getStats() {
    try {
      const allData = await chrome.storage.local.get(null);
      const arxivKeys = Object.keys(allData).filter(key => key.startsWith('arxiv_'));
      
      return {
        cachedPapers: arxivKeys.length,
        memoryCache: this.paperCache.size
      };
    } catch (error) {
      return { cachedPapers: 0, memoryCache: 0 };
    }
  }
}

// Initialize the background manager
const arxivManager = new ArxivBackgroundManager();

// Handle extension lifecycle
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('ArXiv Tab Enhancer installed');
  } else if (details.reason === 'update') {
    console.log('ArXiv Tab Enhancer updated');
  }
});
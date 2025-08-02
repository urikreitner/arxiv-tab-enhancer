// ArXiv Tab Enhancer Background Script
// Manages tab title updates and data caching

class ArxivBackgroundManager {
  constructor() {
    this.setupMessageListener();
    this.setupTabListeners();
    this.paperCache = new Map();
    this.authorGroups = new Map(); // Track tab groups by author
    this.tabAuthors = new Map(); // Track author by tab ID
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'updateTabTitle') {
        this.updateTabTitle(sender.tab.id, message.title, message.paperData, message.authorColor)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ error: error.message }));
        return true; // Keep message channel open for async response
      } else if (message.action === 'getStats') {
        this.getStats().then(stats => sendResponse(stats));
        return true; // Keep message channel open for async response
      } else if (message.action === 'clearMemoryCache') {
        this.paperCache.clear();
        sendResponse({ success: true });
      }
      return false; // Don't keep channel open for other messages
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
    
    // Listen for tab removal to clean up groups
    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
      this.handleTabRemoval(tabId);
    });
  }

  async updateTabTitle(tabId, newTitle, paperData, authorColor) {
    try {
      console.log(`updateTabTitle called for tab ${tabId}: ${newTitle}`);
      console.log(`Paper data:`, paperData);
      
      // Update the tab title
      await chrome.tabs.update(tabId, { title: newTitle });
      
      // Cache the paper data
      if (paperData && paperData.id) {
        await this.cacheData(paperData);
      }
      
      // Apply author-based grouping and colors
      if (paperData && paperData.firstAuthor) {
        console.log(`Attempting to group tab ${tabId} by author: ${paperData.firstAuthor}`);
        await this.manageAuthorGrouping(tabId, paperData, authorColor);
      } else {
        console.log(`No firstAuthor found for tab ${tabId}`);
      }
      
      console.log(`Successfully updated tab ${tabId} title to: ${newTitle}`);
    } catch (error) {
      console.error('Failed to update tab title:', error);
      console.error('Error details:', error.message);
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
  
  async handleTabRemoval(tabId) {
    // Clean up author mapping when tab is removed
    const author = this.tabAuthors.get(tabId);
    if (author) {
      this.tabAuthors.delete(tabId);
      
      // Check if this was the last tab for this author's group
      const groupId = this.authorGroups.get(author);
      if (groupId) {
        try {
          const group = await chrome.tabGroups.get(groupId);
          const tabs = await chrome.tabs.query({ groupId: groupId });
          
          // If no more tabs in the group, clean up
          if (tabs.length === 0) {
            this.authorGroups.delete(author);
            console.log(`Cleaned up empty group for ${author}`);
          }
        } catch (error) {
          // Group might already be gone
          this.authorGroups.delete(author);
        }
      }
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

  async manageAuthorGrouping(tabId, paperData, authorColor) {
    try {
      const author = paperData.firstAuthor;
      console.log(`manageAuthorGrouping called for tab ${tabId}, author: ${author}`);
      
      if (!author) {
        console.log(`No author found for tab ${tabId}`);
        return;
      }
      
      // Store tab-author mapping
      this.tabAuthors.set(tabId, author);
      
      // Check if we already have a group for this author
      let groupId = this.authorGroups.get(author);
      
      if (!groupId) {
        // Create new tab group for this author
        const shortAuthor = this.getShortAuthorName(author);
        const color = this.getTabGroupColor(authorColor?.hue || 0);
        
        console.log(`Creating new group for ${author} (${shortAuthor}) with color ${color}`);
        
        groupId = await chrome.tabs.group({
          tabIds: [tabId]
        });
        
        await chrome.tabGroups.update(groupId, {
          title: shortAuthor,
          color: color
        });
        
        this.authorGroups.set(author, groupId);
        console.log(`Created new group ${groupId} for ${author}`);
      } else {
        // Add tab to existing group
        try {
          console.log(`Adding tab ${tabId} to existing group ${groupId} for ${author}`);
          await chrome.tabs.group({
            groupId: groupId,
            tabIds: [tabId]
          });
          console.log(`Successfully added tab ${tabId} to group ${groupId}`);
        } catch (error) {
          // Group might not exist anymore, create new one
          console.log(`Group ${groupId} no longer exists, creating new one for ${author}`);
          this.authorGroups.delete(author);
          await this.manageAuthorGrouping(tabId, paperData, authorColor);
        }
      }
    } catch (error) {
      console.error('Failed to manage author grouping:', error);
      console.error('Error details:', error.message);
    }
  }
  
  getShortAuthorName(fullName) {
    if (!fullName) return 'Unknown';
    
    const parts = fullName.split(' ').filter(part => part.length > 0);
    
    if (parts.length === 1) {
      return parts[0];
    } else if (parts.length === 2) {
      return parts[1]; // Last name
    } else {
      if (fullName.includes(',')) {
        return parts[0].replace(',', '');
      } else {
        return parts[parts.length - 1];
      }
    }
  }
  
  getTabGroupColor(hue) {
    // Map hue ranges to Chrome's available tab group colors
    const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];
    const colorIndex = Math.floor((hue / 360) * colors.length);
    return colors[colorIndex % colors.length];
  }
  
  // Utility method to get extension stats
  async getStats() {
    try {
      const allData = await chrome.storage.local.get(null);
      const arxivKeys = Object.keys(allData).filter(key => key.startsWith('arxiv_'));
      
      return {
        cachedPapers: arxivKeys.length,
        memoryCache: this.paperCache.size,
        authorGroups: this.authorGroups.size
      };
    } catch (error) {
      return { cachedPapers: 0, memoryCache: 0, authorGroups: 0 };
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
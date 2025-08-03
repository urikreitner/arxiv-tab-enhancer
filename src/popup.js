// ArXiv Tab Enhancer Popup Script

class PopupManager {
  constructor() {
    this.authors = new Map(); // Store author data
    this.filteredAuthors = [];
    this.likedAuthors = []; // Store liked authors list
    this.init();
  }

  async init() {
    await this.loadStats();
    await this.loadAuthors();
    await this.loadLikedAuthors();
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
        document.getElementById('groups-count').textContent = response.authorGroups || 0;
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
      document.getElementById('cached-count').textContent = 'Error';
      document.getElementById('memory-count').textContent = 'Error';
      document.getElementById('groups-count').textContent = 'Error';
    }
  }

  setupEventListeners() {
    // Refresh current tab button
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.refreshCurrentTab();
    });

    // Group by author button
    document.getElementById('group-by-author-btn').addEventListener('click', () => {
      this.groupAllArxivTabs();
    });

    // Clear cache button
    document.getElementById('clear-cache-btn').addEventListener('click', () => {
      this.clearCache();
    });

    // Liked authors functionality
    document.getElementById('add-author-btn').addEventListener('click', () => {
      this.addLikedAuthor();
    });
    
    document.getElementById('add-author-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addLikedAuthor();
      }
    });

    // Author search input
    const searchInput = document.getElementById('author-search');
    searchInput.addEventListener('input', (e) => {
      this.handleAuthorSearch(e.target.value);
    });
    
    searchInput.addEventListener('focus', () => {
      this.showAuthorList();
    });
    
    document.addEventListener('click', (e) => {
      const authorList = document.getElementById('author-list');
      if (!searchInput.contains(e.target) && !authorList.contains(e.target)) {
        this.hideAuthorList();
      }
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

  async loadAuthors() {
    try {
      const allData = await chrome.storage.local.get(null);
      const arxivKeys = Object.keys(allData).filter(key => key.startsWith('arxiv_'));
      
      console.log(`Found ${arxivKeys.length} cached ArXiv papers`);
      
      // Count papers per author
      this.authors.clear();
      
      arxivKeys.forEach(key => {
        const paperData = allData[key];
        if (paperData.firstAuthor) {
          const author = paperData.firstAuthor;
          if (this.authors.has(author)) {
            this.authors.set(author, this.authors.get(author) + 1);
          } else {
            this.authors.set(author, 1);
          }
        }
      });
      
      console.log(`Found ${this.authors.size} unique authors`);
      
      // Sort authors by paper count (descending)
      this.filteredAuthors = Array.from(this.authors.entries())
        .sort((a, b) => b[1] - a[1]);
        
    } catch (error) {
      console.error('Failed to load authors:', error);
    }
  }
  
  handleAuthorSearch(query) {
    const lowerQuery = query.toLowerCase();
    
    if (query.trim() === '') {
      this.filteredAuthors = Array.from(this.authors.entries())
        .sort((a, b) => b[1] - a[1]);
    } else {
      this.filteredAuthors = Array.from(this.authors.entries())
        .filter(([author, count]) => 
          author.toLowerCase().includes(lowerQuery)
        )
        .sort((a, b) => b[1] - a[1]);
    }
    
    this.updateAuthorList();
  }
  
  showAuthorList() {
    document.getElementById('author-list').style.display = 'block';
    this.updateAuthorList();
  }
  
  hideAuthorList() {
    document.getElementById('author-list').style.display = 'none';
  }
  
  updateAuthorList() {
    const listElement = document.getElementById('author-list');
    
    if (this.filteredAuthors.length === 0) {
      listElement.innerHTML = '<div class="no-results">No authors found</div>';
      return;
    }
    
    const html = this.filteredAuthors
      .slice(0, 10) // Show max 10 results
      .map(([author, count]) => `
        <div class="author-item" data-author="${author}">
          <span class="author-name">${author}</span>
          <span class="paper-count">${count}</span>
        </div>
      `).join('');
    
    listElement.innerHTML = html;
    
    // Add click listeners to author items
    listElement.querySelectorAll('.author-item').forEach(item => {
      item.addEventListener('click', () => {
        const author = item.dataset.author;
        this.filterTabsByAuthor(author);
      });
    });
  }
  
  async filterTabsByAuthor(author) {
    try {
      console.log(`Searching for tabs by author: ${author}`);
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const arxivTabs = tabs.filter(tab => this.isArxivUrl(tab.url));
      
      console.log(`Found ${arxivTabs.length} ArXiv tabs in current window`);
      
      // Get cached data for each tab to check authors
      const allData = await chrome.storage.local.get(null);
      const matchingTabs = [];
      
      for (const tab of arxivTabs) {
        const paperId = this.extractPaperId(tab.url);
        if (paperId) {
          const cacheKey = `arxiv_${paperId}`;
          const paperData = allData[cacheKey];
          console.log(`Tab ${tab.id} (${paperId}): author = ${paperData?.firstAuthor}`);
          
          if (paperData && paperData.firstAuthor === author) {
            matchingTabs.push(tab.id);
          }
        }
      }
      
      console.log(`Found ${matchingTabs.length} matching tabs for ${author}`);
      
      if (matchingTabs.length > 0) {
        // Highlight matching tabs by switching to first one
        await chrome.tabs.update(matchingTabs[0], { active: true });
        this.hideAuthorList();
        
        // Show feedback
        const searchInput = document.getElementById('author-search');
        searchInput.value = `Found ${matchingTabs.length} paper(s) by ${author}`;
        
        setTimeout(() => {
          searchInput.value = '';
        }, 2000);
      } else {
        alert(`No open tabs found for ${author}`);
      }
    } catch (error) {
      console.error('Failed to filter tabs by author:', error);
    }
  }
  
  async groupAllArxivTabs() {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const arxivTabs = tabs.filter(tab => this.isArxivUrl(tab.url));
      
      if (arxivTabs.length === 0) {
        alert('No ArXiv tabs found in current window');
        return;
      }
      
      // Trigger regrouping by reloading each ArXiv tab
      for (const tab of arxivTabs) {
        await chrome.tabs.reload(tab.id);
      }
      
      // Show feedback
      const btn = document.getElementById('group-by-author-btn');
      const originalText = btn.textContent;
      btn.textContent = `Grouping ${arxivTabs.length} tabs...`;
      btn.style.background = '#e7f5e7';
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        this.loadStats(); // Refresh stats
      }, 2000);
      
    } catch (error) {
      console.error('Failed to group tabs:', error);
      alert('Failed to group tabs');
    }
  }
  
  extractPaperId(url) {
    const match = url.match(/\/(?:abs|pdf)\/([^/?]+)/);
    return match ? match[1] : null;
  }

  async loadLikedAuthors() {
    try {
      const result = await chrome.storage.local.get('likedAuthors');
      this.likedAuthors = result.likedAuthors || [];
      this.updateLikedAuthorsDisplay();
    } catch (error) {
      console.error('Failed to load liked authors:', error);
      this.likedAuthors = [];
    }
  }

  async addLikedAuthor() {
    const input = document.getElementById('add-author-input');
    const authorName = input.value.trim();
    
    if (!authorName) return;
    
    // Check if author already exists
    if (this.likedAuthors.includes(authorName)) {
      alert('Author already in liked list');
      return;
    }
    
    try {
      this.likedAuthors.push(authorName);
      await chrome.storage.local.set({ likedAuthors: this.likedAuthors });
      
      input.value = '';
      this.updateLikedAuthorsDisplay();
      
      console.log('Added liked author:', authorName);
    } catch (error) {
      console.error('Failed to add liked author:', error);
      alert('Failed to add author');
    }
  }

  async removeLikedAuthor(authorName) {
    try {
      this.likedAuthors = this.likedAuthors.filter(author => author !== authorName);
      await chrome.storage.local.set({ likedAuthors: this.likedAuthors });
      
      this.updateLikedAuthorsDisplay();
      
      console.log('Removed liked author:', authorName);
    } catch (error) {
      console.error('Failed to remove liked author:', error);
    }
  }

  updateLikedAuthorsDisplay() {
    const container = document.getElementById('liked-authors-list');
    
    if (this.likedAuthors.length === 0) {
      container.innerHTML = '<div style="color: #666; font-size: 11px; font-style: italic;">No liked authors yet. Add authors to prioritize them for grouping.</div>';
      return;
    }
    
    const html = this.likedAuthors.map(author => 
      `<span class="liked-author-tag">
        ${author}
        <span class="remove-author" data-author="${author}">×</span>
      </span>`
    ).join('');
    
    container.innerHTML = html;
    
    // Add click listeners for remove buttons
    container.querySelectorAll('.remove-author').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const author = btn.dataset.author;
        this.removeLikedAuthor(author);
      });
    });
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
    document.getElementById('groups-count').textContent = message.stats.authorGroups || 0;
  }
});
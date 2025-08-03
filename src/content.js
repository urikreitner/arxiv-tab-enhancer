// ArXiv Tab Enhancer Content Script
// Extracts paper titles and sends them to background script for tab title updates

class ArxivTitleExtractor {
  constructor() {
    this.paperData = null;
    this.init();
  }

  init() {
    // Run immediately and also observe for dynamic content changes
    this.extractPaperInfo();
    this.observeChanges();
    
    // Special handling for PDF pages - they may load content asynchronously
    if (window.location.href.includes('/pdf/')) {
      this.setupPdfHandling();
    }
  }

  setupPdfHandling() {
    console.log('Setting up PDF-specific handling...');
    
    // Wait for PDF.js to potentially load
    const checkForPdfJs = () => {
      if (window.PDFViewerApplication || window.PDFView) {
        console.log('PDF.js detected, re-applying title...');
        setTimeout(() => {
          this.extractPaperInfo();
        }, 1000);
      }
    };
    
    // Check immediately and periodically
    checkForPdfJs();
    setTimeout(checkForPdfJs, 2000);
    setTimeout(checkForPdfJs, 5000);
    
    // Also listen for various PDF-related events
    window.addEventListener('load', () => {
      console.log('Window load event, re-applying title...');
      // Force re-extraction and title setting
      setTimeout(() => {
        console.log('Forcing title reapplication after window load...');
        this.extractPaperInfo();
        // Also force title again if we already have the target title
        if (this.targetTitle) {
          console.log('Re-applying existing target title:', this.targetTitle);
          this.setTitleAggressively(this.targetTitle);
        }
      }, 500);
      
      // Try again after a longer delay for stubborn pages
      setTimeout(() => {
        console.log('Secondary title reapplication after window load...');
        if (this.targetTitle) {
          console.log('Final re-application of target title:', this.targetTitle);
          this.setTitleAggressively(this.targetTitle);
        }
      }, 2000);
    });
    
    document.addEventListener('DOMContentLoaded', () => {
      console.log('DOM content loaded, re-applying title...');
      setTimeout(() => this.extractPaperInfo(), 500);
    });
    
    // Listen for any changes to the document title directly
    let lastTitle = document.title;
    const titlePoller = setInterval(() => {
      if (document.title !== lastTitle && document.title !== this.targetTitle) {
        console.warn(`🚨 EXTERNAL TITLE CHANGE DETECTED!`);
        console.warn(`From: "${lastTitle}"`);
        console.warn(`To: "${document.title}"`);
        if (this.targetTitle) {
          console.warn(`Immediately restoring to: "${this.targetTitle}"`);
          this.setTitleAggressively(this.targetTitle);
          // Try multiple times to ensure it sticks
          setTimeout(() => this.setTitleAggressively(this.targetTitle), 50);
          setTimeout(() => this.setTitleAggressively(this.targetTitle), 200);
          setTimeout(() => this.setTitleAggressively(this.targetTitle), 500);
        }
        lastTitle = document.title;
      } else if (document.title === this.targetTitle) {
        lastTitle = document.title; // Update lastTitle when our title is active
      }
    }, 50); // Check more frequently
    
    // Stop polling after 30 seconds
    setTimeout(() => {
      clearInterval(titlePoller);
      console.log('Stopped title polling after 30 seconds');
    }, 30000);
  }

  async extractPaperInfo() {
    console.log('ArXiv Tab Enhancer: Extracting paper info from', window.location.href);
    const paperData = await this.getPaperData();
    console.log('Extracted paper data:', paperData);
    
    if (paperData && paperData.title) {
      this.paperData = paperData;
      this.updateTabTitle(paperData);
      this.cacheData(paperData);
    } else {
      console.log('No valid paper data found');
    }
  }

  async getPaperData() {
    // Check if we're on an abs page or PDF page
    const url = window.location.href;
    const isAbsPage = url.includes('/abs/');
    const isPdfPage = url.includes('/pdf/');
    
    if (!isAbsPage && !isPdfPage) return null;

    // Extract paper ID from URL
    const paperId = this.extractPaperId(url);
    if (!paperId) return null;

    let title = null;
    let authors = null;
    let authorsList = [];
    let firstAuthor = null;
    let category = null;

    if (isAbsPage) {
      // Extract from abstract page
      console.log('Looking for title element: h1.title');
      const titleElement = document.querySelector('h1.title');
      if (titleElement) {
        console.log('Found title element:', titleElement);
        console.log('Title raw text:', titleElement.textContent);
        title = titleElement.textContent.replace(/^Title:\s*/, '').trim();
        console.log('Cleaned title:', title);
      } else {
        console.log('Title element not found with h1.title selector');
        // Try alternative selectors
        const altTitle = document.querySelector('h1.title.mathjax') || document.querySelector('h1');
        if (altTitle) {
          console.log('Found alternative title element:', altTitle);
          title = altTitle.textContent.replace(/^Title:\s*/, '').trim();
        }
      }

      console.log('Looking for authors element: div.authors');
      const authorsElement = document.querySelector('div.authors');
      if (authorsElement) {
        console.log('Found authors element:', authorsElement);
        console.log('Authors raw text:', authorsElement.textContent);
        authors = authorsElement.textContent.replace(/^Authors:\s*/, '').trim();
        console.log('Cleaned authors string:', authors);
        authorsList = this.parseAuthors(authors);
        firstAuthor = await this.getPreferredAuthor(authorsList);
        console.log('Parsed authors:', authorsList);
        console.log('Preferred author for grouping:', firstAuthor);
      } else {
        console.log('No authors element found with div.authors selector');
        // Check what elements are actually available
        console.log('Available elements on page:');
        console.log('- h1 elements:', document.querySelectorAll('h1'));
        console.log('- div elements:', document.querySelectorAll('div').length);
        console.log('- elements with "author" in class:', document.querySelectorAll('[class*="author"]'));
      }

      const subjectElement = document.querySelector('span.primary-subject');
      if (subjectElement) {
        category = subjectElement.textContent.trim();
      }
    } else if (isPdfPage) {
      console.log('PDF page detected, checking cache or fetching from abstract page');
      
      // Try to get cached data first
      const cached = await this.getCachedDataAsync(paperId);
      if (cached && cached.title && cached.firstAuthor) {
        console.log('Found valid cached data for PDF page:', cached);
        title = cached.title;
        authors = cached.authors;
        authorsList = cached.authorsList || [];
        firstAuthor = cached.firstAuthor;
        category = cached.category;
      } else {
        if (cached && !cached.firstAuthor) {
          console.log('Found incomplete cached data, will re-fetch:', cached);
          // Remove bad cache entry
          await this.removeCachedData(paperId);
        }
        console.log('No cached data, fetching from abstract page');
        // PDF pages don't have metadata, so we need to fetch from abstract page
        const fetchedData = await this.fetchAbstractPageData(paperId);
        if (fetchedData) {
          title = fetchedData.title;
          authors = fetchedData.authors;
          authorsList = fetchedData.authorsList || [];
          firstAuthor = fetchedData.firstAuthor;
          category = fetchedData.category;
        } else {
          // Fallback if fetch fails
          title = `ArXiv ${paperId}`;
        }
      }
    }

    return {
      id: paperId,
      title: title,
      authors: authors,
      authorsList: authorsList,
      firstAuthor: firstAuthor,
      category: category,
      url: url
    };
  }

  extractPaperId(url) {
    const match = url.match(/\/(?:abs|pdf)\/([^/?]+)/);
    return match ? match[1] : null;
  }

  parseAuthors(authorsString) {
    if (!authorsString) return [];
    
    // Split by comma and clean up each author name
    const authors = authorsString
      .split(',')
      .map(author => {
        // Remove extra whitespace and common prefixes
        return author
          .trim()
          .replace(/^(and|&)\s+/i, '') // Remove "and" or "&" at start
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      })
      .filter(author => author.length > 0);
    
    return authors;
  }

  async getPreferredAuthor(authorsList) {
    if (!authorsList || authorsList.length === 0) return null;
    
    try {
      // Get liked authors from storage
      const likedAuthors = await this.getLikedAuthors();
      
      // Check if any liked author is in the authors list
      for (const likedAuthor of likedAuthors) {
        for (const author of authorsList) {
          if (this.isAuthorMatch(author, likedAuthor)) {
            console.log(`Found liked author: ${author} (matches ${likedAuthor})`);
            return author;
          }
        }
      }
      
      // If no liked author found, return first author
      return authorsList[0];
    } catch (error) {
      console.error('Error getting preferred author:', error);
      return authorsList[0]; // Fallback to first author
    }
  }

  async getLikedAuthors() {
    try {
      const result = await chrome.storage.local.get('likedAuthors');
      return result.likedAuthors || [];
    } catch (error) {
      console.error('Error getting liked authors:', error);
      return [];
    }
  }

  isAuthorMatch(fullAuthorName, likedAuthorName) {
    // Normalize both names for comparison
    const normalize = (name) => name.toLowerCase().replace(/[.,]/g, '').trim();
    
    const fullNorm = normalize(fullAuthorName);
    const likedNorm = normalize(likedAuthorName);
    
    // Check if liked author name is contained in full author name
    // This handles cases like "Smith" matching "John Smith" or "Smith, J."
    return fullNorm.includes(likedNorm) || likedNorm.includes(fullNorm);
  }

  // Generate consistent color from author name using simple hash
  generateAuthorColor(authorName) {
    if (!authorName) return null;
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < authorName.length; i++) {
      const char = authorName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Generate HSL color with good contrast
    const hue = Math.abs(hash) % 360;
    const saturation = 45 + (Math.abs(hash) % 20); // 45-65%
    const lightness = 85 + (Math.abs(hash) % 10); // 85-95% (very light)
    
    return {
      background: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
      border: `hsl(${hue}, ${saturation + 20}%, ${lightness - 30}%)`,
      hue: hue
    };
  }

  updateTabTitle(paperData) {
    let newTitle = paperData.title;
    console.log('Building title for:', paperData.title);
    
    // Add first author if available
    if (paperData.firstAuthor) {
      const authorShort = this.getShortAuthorName(paperData.firstAuthor);
      newTitle = `${authorShort}: ${newTitle}`;
      console.log('Added author to title:', authorShort);
    }
    
    // Truncate long titles
    if (newTitle && newTitle.length > 60) {
      newTitle = newTitle.substring(0, 57) + '...';
    }

    // Add category prefix if available
    if (paperData.category) {
      // Extract short category: "cs.AI" -> "cs", "Computation and Language (cs.CL)" -> "cs"
      let categoryShort = paperData.category;
      if (categoryShort.includes('(') && categoryShort.includes(')')) {
        // Extract from parentheses: "Computation and Language (cs.CL)" -> "cs.CL"
        const match = categoryShort.match(/\(([^)]+)\)/);
        if (match) {
          categoryShort = match[1];
        }
      }
      categoryShort = categoryShort.split('.')[0]; // "cs.CL" -> "cs"
      newTitle = `[${categoryShort}] ${newTitle}`;
    }

    // Generate author color
    const authorColor = this.generateAuthorColor(paperData.firstAuthor);
    console.log('Generated author color:', authorColor);

    console.log('Final title:', newTitle);
    
    // Store the target title for persistence
    this.targetTitle = newTitle;
    
    // Aggressively set the title multiple ways
    this.setTitleAggressively(newTitle);
    
    // Keep checking and re-setting the title
    this.startTitleWatcher(newTitle);

    console.log('Sending message to background script for grouping');

    // Send message to background script for BOTH title update AND grouping
    if (newTitle && chrome.runtime) {
      // Try background script title update approach
      console.log('Attempting background script title update...');
      chrome.runtime.sendMessage({
        action: 'updateTabTitle',
        title: newTitle,
        paperData: paperData,
        authorColor: authorColor
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Background title update failed:', chrome.runtime.lastError);
        } else {
          console.log('Background title update response:', response);
        }
      });
      
      // Also send for grouping
      chrome.runtime.sendMessage({
        action: 'createAuthorGroup',
        title: newTitle,
        paperData: paperData,
        authorColor: authorColor
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Group creation failed:', chrome.runtime.lastError);
        } else {
          console.log('Group creation response:', response);
        }
      });
    } else {
      console.error('Cannot send message - no title or chrome.runtime unavailable');
    }
  }

  setTitleAggressively(newTitle) {
    console.log('Setting title aggressively to:', newTitle);
    
    // Method 1: Direct document.title
    document.title = newTitle;
    
    // Method 2: Try to set via title element if it exists
    const titleElement = document.querySelector('title');
    if (titleElement) {
      titleElement.textContent = newTitle;
    }
    
    // Method 3: Create title element if it doesn't exist
    if (!document.querySelector('title')) {
      const titleEl = document.createElement('title');
      titleEl.textContent = newTitle;
      document.head.appendChild(titleEl);
    }
    
    console.log('Title set via multiple methods, current document.title:', document.title);
    
    // Extra debugging - check all possible title sources
    console.log('=== TITLE DEBUG INFO ===');
    console.log('document.title:', JSON.stringify(document.title));
    console.log('title element textContent:', JSON.stringify(document.querySelector('title')?.textContent));
    console.log('title element innerHTML:', JSON.stringify(document.querySelector('title')?.innerHTML));
    console.log('page URL:', window.location.href);
    console.log('========================');
  }

  startTitleWatcher(targetTitle) {
    // Clear any existing watcher
    if (this.titleWatcher) {
      clearInterval(this.titleWatcher);
    }
    
    // Set up mutation observer to watch for title changes
    this.setupTitleMutationObserver(targetTitle);
    
    // Check every 200ms for the first 30 seconds (more frequent and longer)
    let checks = 0;
    this.titleWatcher = setInterval(() => {
      checks++;
      
      if (document.title !== targetTitle) {
        console.warn(`Title mismatch detected (check ${checks}). Expected: "${targetTitle}", Got: "${document.title}"`);
        console.warn('Re-setting title...');
        this.setTitleAggressively(targetTitle);
      } else {
        // Only log every 20th check to reduce noise
        if (checks % 20 === 0) {
          console.log(`Title check ${checks}: OK`);
        }
      }
      
      // Stop checking after 150 attempts (30 seconds)
      if (checks >= 150) {
        clearInterval(this.titleWatcher);
        console.log('Title watcher stopped after 150 checks');
      }
    }, 200);
  }

  setupTitleMutationObserver(targetTitle) {
    // Watch for changes to the title element
    const titleElement = document.querySelector('title');
    if (titleElement) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            const currentTitle = document.title;
            if (currentTitle !== targetTitle) {
              console.error('🚨 TITLE CHANGED BY EXTERNAL SOURCE!');
              console.error('Target title:', targetTitle);
              console.error('New title:', currentTitle);
              console.error('Mutation:', mutation);
              console.error('Target element:', mutation.target);
              
              // Immediately set it back
              console.log('Forcing title back to correct value...');
              this.setTitleAggressively(targetTitle);
            }
          }
        });
      });
      
      observer.observe(titleElement, {
        childList: true,
        characterData: true,
        subtree: true
      });
      
      // Also observe the document head for new title elements
      const headObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeName === 'TITLE') {
              console.error('🚨 NEW TITLE ELEMENT ADDED!', node);
              node.textContent = targetTitle;
            }
          });
        });
      });
      
      headObserver.observe(document.head, { childList: true });
    }
  }

  getShortAuthorName(fullName) {
    if (!fullName) return '';
    
    // Handle different name formats
    const parts = fullName.split(' ').filter(part => part.length > 0);
    
    if (parts.length === 1) {
      return parts[0]; // Single name
    } else if (parts.length === 2) {
      // "First Last" -> "Last"
      return parts[1];
    } else {
      // "First Middle Last" or "Last, First" -> "Last"
      if (fullName.includes(',')) {
        return parts[0].replace(',', ''); // "Last, First" format
      } else {
        return parts[parts.length - 1]; // "First Middle Last" format
      }
    }
  }

  cacheData(paperData) {
    // Cache the paper data for future reference
    if (chrome.storage && chrome.storage.local) {
      const cacheKey = `arxiv_${paperData.id}`;
      chrome.storage.local.set({
        [cacheKey]: {
          ...paperData,
          timestamp: Date.now()
        }
      });
    }
  }

  async cacheDataAsync(paperData) {
    try {
      const cacheKey = `arxiv_${paperData.id}`;
      await chrome.storage.local.set({
        [cacheKey]: {
          ...paperData,
          timestamp: Date.now()
        }
      });
      console.log('Cached paper data for', paperData.id);
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }

  getCachedData(paperId) {
    // This would be async in real implementation, but for simplicity we'll handle it in background
    return null;
  }

  async getCachedDataAsync(paperId) {
    try {
      const cacheKey = `arxiv_${paperId}`;
      const result = await chrome.storage.local.get(cacheKey);
      
      if (result[cacheKey]) {
        const data = result[cacheKey];
        // Check if cache is not too old (30 days)
        const maxAge = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - data.timestamp < maxAge) {
          console.log('Retrieved cached data for', paperId, data);
          return data;
        } else {
          // Remove expired cache
          await chrome.storage.local.remove(cacheKey);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  async removeCachedData(paperId) {
    try {
      const cacheKey = `arxiv_${paperId}`;
      await chrome.storage.local.remove(cacheKey);
      console.log('Removed cached data for', paperId);
    } catch (error) {
      console.error('Failed to remove cached data:', error);
    }
  }

  async fetchAbstractPageData(paperId) {
    try {
      console.log(`Fetching abstract page data for ${paperId}`);
      const abstractUrl = `https://arxiv.org/abs/${paperId}`;
      
      // Fetch the abstract page HTML
      const response = await fetch(abstractUrl);
      if (!response.ok) {
        console.error('Failed to fetch abstract page:', response.status);
        return;
      }
      
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Extract data from the abstract page
      let title = null;
      let authors = null;
      let authorsList = [];
      let firstAuthor = null;
      let category = null;
      
      const titleElement = doc.querySelector('h1.title');
      if (titleElement) {
        title = titleElement.textContent.replace(/^Title:\s*/, '').trim();
      }
      
      const authorsElement = doc.querySelector('div.authors');
      if (authorsElement) {
        authors = authorsElement.textContent.replace(/^Authors:\s*/, '').trim();
        authorsList = this.parseAuthors(authors);
        firstAuthor = await this.getPreferredAuthor(authorsList);
      }
      
      const subjectElement = doc.querySelector('span.primary-subject');
      if (subjectElement) {
        category = subjectElement.textContent.trim();
      }
      
      if (title && firstAuthor) {
        console.log(`Successfully fetched data: ${title} by ${firstAuthor}`);
        
        // Create paper data object
        const paperData = {
          id: paperId,
          title: title,
          authors: authors,
          authorsList: authorsList,
          firstAuthor: firstAuthor,
          category: category,
          url: window.location.href
        };
        
        // Cache it
        await this.cacheDataAsync(paperData);
        
        return paperData;
      } else {
        console.log('Failed to extract complete data from abstract page');
        return null;
      }
      
    } catch (error) {
      console.error('Error fetching abstract page data:', error);
      return null;
    }
  }

  observeChanges() {
    // Observe for dynamic content changes (though ArXiv pages are mostly static)
    const observer = new MutationObserver((mutations) => {
      let shouldReextract = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if important elements were added
          for (let node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.querySelector && (
                node.querySelector('h1.title') || 
                node.querySelector('div.authors') ||
                node.classList.contains('title') ||
                node.classList.contains('authors')
              )) {
                shouldReextract = true;
                break;
              }
            }
          }
        }
      });

      if (shouldReextract) {
        setTimeout(() => this.extractPaperInfo(), 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Initialize when DOM is ready
console.log('ArXiv Tab Enhancer content script loaded on:', window.location.href);
console.log('Document ready state:', document.readyState);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing ArxivTitleExtractor');
    new ArxivTitleExtractor();
  });
} else {
  console.log('DOM already ready, initializing ArxivTitleExtractor');
  new ArxivTitleExtractor();
}
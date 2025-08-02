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
  }

  extractPaperInfo() {
    console.log('ArXiv Tab Enhancer: Extracting paper info from', window.location.href);
    const paperData = this.getPaperData();
    console.log('Extracted paper data:', paperData);
    
    if (paperData && paperData.title) {
      this.paperData = paperData;
      this.updateTabTitle(paperData);
      this.cacheData(paperData);
    } else {
      console.log('No valid paper data found');
    }
  }

  getPaperData() {
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
        firstAuthor = authorsList.length > 0 ? authorsList[0] : null;
        console.log('Parsed authors:', authorsList);
        console.log('First author:', firstAuthor);
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
      // For PDF pages, try to get title from the document title or extract from URL
      // PDF pages often don't have structured metadata, so we'll use the paper ID
      title = `ArXiv ${paperId}`;
      
      // Try to get cached data if we've seen this paper before
      const cached = this.getCachedData(paperId);
      if (cached && cached.title) {
        title = cached.title;
        authors = cached.authors;
        authorsList = cached.authorsList || [];
        firstAuthor = cached.firstAuthor;
        category = cached.category;
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
      const categoryShort = paperData.category.split('.')[0]; // e.g., "cs" from "cs.AI"
      newTitle = `[${categoryShort}] ${newTitle}`;
    }

    // Generate author color
    const authorColor = this.generateAuthorColor(paperData.firstAuthor);
    console.log('Generated author color:', authorColor);

    console.log('Final title:', newTitle);
    console.log('Sending message to background script');

    // Send message to background script to update tab title and apply colors/grouping
    if (newTitle && chrome.runtime) {
      chrome.runtime.sendMessage({
        action: 'updateTabTitle',
        title: newTitle,
        paperData: paperData,
        authorColor: authorColor
      });
    } else {
      console.error('Cannot send message - no title or chrome.runtime unavailable');
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

  getCachedData(paperId) {
    // This would be async in real implementation, but for simplicity we'll handle it in background
    return null;
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
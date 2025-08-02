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
    const paperData = this.getPaperData();
    if (paperData && paperData.title) {
      this.paperData = paperData;
      this.updateTabTitle(paperData);
      this.cacheData(paperData);
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
    let category = null;

    if (isAbsPage) {
      // Extract from abstract page
      const titleElement = document.querySelector('h1.title');
      if (titleElement) {
        title = titleElement.textContent.replace(/^Title:\s*/, '').trim();
      }

      const authorsElement = document.querySelector('div.authors');
      if (authorsElement) {
        authors = authorsElement.textContent.replace(/^Authors:\s*/, '').trim();
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
        category = cached.category;
      }
    }

    return {
      id: paperId,
      title: title,
      authors: authors,
      category: category,
      url: url
    };
  }

  extractPaperId(url) {
    const match = url.match(/\/(?:abs|pdf)\/([^/?]+)/);
    return match ? match[1] : null;
  }

  updateTabTitle(paperData) {
    let newTitle = paperData.title;
    
    // Truncate long titles
    if (newTitle && newTitle.length > 60) {
      newTitle = newTitle.substring(0, 57) + '...';
    }

    // Add category prefix if available
    if (paperData.category) {
      const categoryShort = paperData.category.split('.')[0]; // e.g., "cs" from "cs.AI"
      newTitle = `[${categoryShort}] ${newTitle}`;
    }

    // Send message to background script to update tab title
    if (newTitle && chrome.runtime) {
      chrome.runtime.sendMessage({
        action: 'updateTabTitle',
        title: newTitle,
        paperData: paperData
      });
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ArxivTitleExtractor();
  });
} else {
  new ArxivTitleExtractor();
}
# ArXiv Tab Enhancer

A Chrome extension that replaces generic ArXiv tab titles with meaningful paper titles for better tab management.

## Problem

When browsing ArXiv papers, all tabs show generic titles like "2501.00123" making it impossible to distinguish between different papers. This extension solves that by automatically replacing tab titles with actual paper titles.

## Features

- **Automatic Title Replacement**: Extracts paper titles from ArXiv pages and updates tab titles
- **Author-Based Organization**: Shows first author names in tab titles for easy identification
- **Smart Tab Grouping**: Automatically groups papers by the same author using Chrome's Tab Groups
- **Author-Based Colors**: Consistent color coding for papers by the same author
- **Author Search**: Search and filter through cached papers by author name
- **Smart Truncation**: Long titles are intelligently shortened to fit in browser tabs  
- **Category Prefixes**: Adds subject category indicators (e.g., "[cs]" for computer science papers)
- **Caching**: Stores paper metadata for faster subsequent loads
- **Support for Multiple Formats**: Works with both `/abs/` and `/pdf/` ArXiv URLs
- **Enhanced UI**: Popup with stats, author search, and grouping controls

## Installation

### From Source (Recommended for Development)

1. Clone this repository:
   ```bash
   git clone https://github.com/urikreitner/arxiv-tab-enhancer.git
   cd arxiv-tab-enhancer
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in top right)

4. Click "Load unpacked" and select the extension directory

5. The extension should now be active for ArXiv pages

### From Chrome Web Store

*Coming soon - extension will be published to the Chrome Web Store after testing*

## Usage

1. **Automatic Operation**: Once installed, the extension automatically works on ArXiv pages
2. **Tab Grouping**: Papers by the same author are automatically grouped with consistent colors
3. **Author Search**: Use the search box in the popup to find papers by specific authors
4. **Manual Refresh**: Click "Refresh Current Tab" to force an update
5. **Group All Tabs**: Use "Group All ArXiv Tabs" to organize all open ArXiv papers
6. **View Stats**: The popup shows cached papers, memory usage, and active author groups
7. **Clear Cache**: Clear stored paper data when needed

## How It Works

1. **Content Script**: Detects ArXiv pages and extracts paper metadata (title, authors, category)
2. **Author Processing**: Parses author lists and identifies the first author for organization
3. **Color Generation**: Creates consistent colors for each author using hash-based algorithm
4. **Tab Grouping**: Uses Chrome's Tab Groups API to organize papers by author
5. **Background Script**: Manages tab titles, grouping, and caching
6. **Smart Formatting**: Truncates long titles and adds author names and category prefixes

## Examples

**Before**: `2501.00123 - arXiv.org`  
**After**: `[cs] Vaswani: Attention Is All You Need: A Survey of Transformer...`  
*📁 Grouped in "Vaswani" tab group with blue color*

**Before**: `2412.98765 - arXiv.org`  
**After**: `[math] Smith: On the Convergence of Stochastic Gradient Descent...`  
*📁 Grouped in "Smith" tab group with green color*

**Author Search**: Type "Vaswani" in the popup to quickly find and navigate to all papers by that author across your open tabs.

## Development

### Prerequisites

- Python 3.8+ (for icon generation)
- Chrome browser
- Git

### Setup Development Environment

1. Create Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Generate icons (if needed):
   ```bash
   python3 create_icons.py
   ```

### Project Structure

```
arxiv-tab-enhancer/
├── manifest.json           # Extension manifest (entry point)
├── src/
│   ├── content.js          # Content script for ArXiv pages
│   ├── background.js       # Background service worker
│   └── popup.js           # Popup interface logic
├── popup.html             # Extension popup UI
├── icons/                 # Extension icons (16px, 48px, 128px)
├── create_icons.py        # Icon generation script
└── README.md             # This file
```

### Testing

To test the extension:

1. Load the extension in Chrome (see Installation section)
2. Visit any ArXiv paper page (e.g., `https://arxiv.org/abs/2301.00001`)
3. Check that the tab title updates with the paper title
4. Test with both abstract pages (`/abs/`) and PDF pages (`/pdf/`)
5. Verify the popup interface works correctly

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Privacy

This extension:
- ✅ Only runs on ArXiv domains (`arxiv.org`)
- ✅ Stores data locally in your browser
- ✅ Does not transmit any data to external servers
- ✅ Only accesses paper metadata that's already public on ArXiv

## Permissions

The extension requires these permissions:
- `tabs`: To update tab titles and query open tabs
- `tabGroups`: To create and manage tab groups by author
- `activeTab`: To access the current ArXiv page content
- `storage`: To cache paper metadata locally
- `host_permissions` for `arxiv.org`: To run on ArXiv pages only

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

### v1.1.0 (2025-02-02)
- Added author-based tab grouping with Chrome Tab Groups API
- Implemented consistent color coding for papers by the same author
- Added author search and filtering in popup interface
- Enhanced tab titles to include first author names
- Improved popup UI with author statistics and grouping controls
- Added automatic cleanup of empty tab groups

### v1.0.0 (2025-02-01)
- Initial release
- Basic title replacement functionality
- Support for abstract and PDF pages
- Popup interface with stats and controls
- Paper metadata caching system
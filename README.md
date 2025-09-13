# Analyst AI - Document Analysis Chat Application

A streamlined AI-powered document analysis application for GitHub Pages deployment.

## 🌟 Key Features

- **🤖 AI-Powered Analysis**: Google Gemini 2.5 Flash integration for intelligent document processing
- **🌍 Multilingual Support**: Upload documents in any language, get analysis in English
- **📊 Data Validation**: Detect duplicate metrics and inconsistencies across documents
- **📄 Multiple File Formats**: PDF, DOCX, TXT, HTML support
- **🔍 Page References**: Track exact locations of all data points
- **⚠️ Discrepancy Detection**: Automatically identify data inconsistencies
- **🎯 Large File Handling**: Automatic chunking for files over 20MB

## 🚀 Quick Start

### GitHub Pages Deployment
1. Fork this repository
2. Enable GitHub Pages in repository settings
3. Visit your GitHub Pages URL
4. Click "Set API Key" and enter your Gemini API key

### Local Development
```bash
# Simple HTTP server
python -m http.server 8000
# OR
npx serve .
```

## Setup Instructions

### 1. Get a Google Gemini API Key (REQUIRED)

> ⚠️ **IMPORTANT**: The application will not work without a valid API key!

- Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
- Create or sign in to your Google account
- Generate an API key
- Copy the API key to your clipboard

### 2. Configure the Application

The application will prompt you to enter your API key when you first use it:

1. Open the application in your browser
2. Click the "Set API Key" button in the top right corner
3. Paste your API key in the dialog box
4. Click "Save Key"

Your API key will be securely stored in your browser's localStorage and will persist between sessions.

## Usage

1. **Chat with the AI**:
   - Type your message in the input field
   - Click the send button or press Enter

2. **Upload a Document**:
   - Click the paperclip icon or drag and drop a file onto the chat area
   - Select a PDF, DOCX, TXT, or HTML file
   - The filename will appear above the input field
   - Add an optional message and send

3. **Reset Session**:
   - Click the "Reset Session" button in the header to clear chat history
   - This removes all previous messages and AI context for a fresh start

## Tech Stack

- **HTML**: Single index.html file for structure
- **CSS**: Tailwind CSS via CDN for styling
- **JavaScript**: Vanilla ES6+ modules
- **Gemini API**: Google's generative AI SDK via ESM.sh CDN
- **Markdown Parsing**: Marked.js for converting Markdown to HTML

## Notes

- The application uses the Gemini 2.5 Flash model for fast responses
- Large files (over 20MB) are automatically split into 15MB chunks for processing
- File uploads are converted to base64 strings and sent along with your text prompt
- No data is stored on any server; all processing happens in your browser

## Limitations

- Maximum file size depends on browser limitations and the Gemini API constraints
- Supported file types: PDF, DOCX, TXT, and HTML
- Requires an internet connection to communicate with the Gemini API
- Large file processing may take longer due to sequential chunk analysis

## License

This project is open source and available under the MIT License.
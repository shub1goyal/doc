# Analyst AI - Document Analysis Chat App

Analyst AI is a single-page web application that allows users to chat with an AI model, upload documents for analysis, and receive streamed, Markdown-formatted responses. This application is built with vanilla JavaScript, HTML, and Tailwind CSS.

## Features

- **Full-Screen Chat Interface**: A clean, modern, dark-themed UI that occupies the entire viewport.
- **AI Chat Functionality**:
  - Send text messages to the AI
  - Receive streamed responses in real-time
  - "Typing..." indicator while waiting for responses
- **File Upload and Analysis**:
  - Upload PDF, DOCX, or TXT files
  - File preview with option to remove before sending
  - Document analysis using Google's Gemini API
- **Dynamic Rendering**:
  - Automatic scrolling to latest messages
  - Markdown parsing for formatted responses (including tables)

## Tech Stack

- **HTML**: Single index.html file for structure
- **CSS**: Tailwind CSS via CDN for styling
- **JavaScript**: Vanilla ES6+ modules
- **Gemini API**: Google's generative AI SDK via ESM.sh CDN
- **Markdown Parsing**: Marked.js for converting Markdown to HTML

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

Your API key will be securely stored in your browser's localStorage and will persist between sessions. You can update it at any time by clicking the "Set API Key" button again.

> Note: The API key is stored only in your browser and is never sent to any server other than Google's API servers.

### 3. Run the Application

- Open `index.html` in a web browser
- For the best experience, use a local development server like [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) for VS Code

## Usage

1. **Chat with the AI**:
   - Type your message in the input field
   - Click the send button or press Enter

2. **Upload a Document**:
   - Click the paperclip icon
   - Select a PDF, DOCX, or TXT file
   - The filename will appear above the input field
   - Add an optional message and send
   - You can remove the file before sending by clicking the X button

3. **View AI Responses**:
   - AI responses are formatted with Markdown
   - Tables and other formatted content will be properly rendered

## Notes

- The application uses the Gemini 2.5 Flash model by default, which is optimized for fast responses
- The UI is disabled while waiting for AI responses to prevent duplicate submissions
- File uploads are converted to base64 strings and sent along with your text prompt
- No data is stored on any server; all processing happens in your browser and through the Gemini API

## Limitations

- Maximum file size depends on your browser's limitations and the Gemini API's constraints
- Supported file types: PDF, DOCX, and TXT
- Requires an internet connection to communicate with the Gemini API

## Troubleshooting

### API Key Errors

If you see an error message about an invalid API key, this means you need to:

1. Click the "Set API Key" button in the top right corner to enter a valid API key
2. Verify that your API key is valid and has not expired
3. Check that you have the necessary permissions for the Gemini API in your Google Cloud account
4. Make sure you're using a key for the Gemini API (not another Google API)

The application will automatically detect invalid API keys and prompt you to update them.

### Other Common Issues

- **File Upload Issues**: Make sure your file is one of the supported types (PDF, DOCX, TXT) and is not too large
- **Network Errors**: Check your internet connection if you're having trouble connecting to the Gemini API
- **Browser Compatibility**: This application works best in modern browsers (Chrome, Firefox, Edge, Safari)

## License

This project is open source and available under the MIT License.
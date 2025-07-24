// Import the Google Generative AI SDK
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Configuration
const MODEL_NAME = 'gemini-2.5-flash';

// API Key Management
let API_KEY = localStorage.getItem('gemini_api_key') || '';
let genAI = null;

// Initialize the Gemini API client if we have an API key
if (API_KEY) {
    genAI = new GoogleGenerativeAI(API_KEY);
}
// The system instruction needs to be in a format compatible with the Gemini API
const SYSTEM_INSTRUCTION = {
    role: "user",
    parts: [{
        text: "You are Analyst AI, a helpful assistant that can analyze documents and answer questions.\n- Respond in a clear, concise manner\n- Format your responses using Markdown when appropriate\n- When analyzing documents, provide structured insights\n- For tables, use proper Markdown table syntax\n- Be accurate and helpful"
    }]
};

// State management
let messages = []; // Array of message objects {id, role, text}
let isLoading = false;
let uploadedFile = null;
let chatSession = null; // To hold the Gemini chat session

// DOM Elements
const chatContainer = document.getElementById('chat-container');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const attachButton = document.getElementById('attach-button');
const fileInput = document.getElementById('file-input');
const filePreview = document.getElementById('file-preview');
const fileName = document.getElementById('file-name');
const removeFileButton = document.getElementById('remove-file');

// API Key Modal Elements
const apiKeyButton = document.getElementById('api-key-button');
const apiKeyModal = document.getElementById('api-key-modal');
const apiKeyForm = document.getElementById('api-key-form');
const apiKeyInput = document.getElementById('api-key-input');
const apiKeyCancelButton = document.getElementById('api-key-cancel');

// Event Listeners
chatForm.addEventListener('submit', handleSendMessage);
attachButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelection);
removeFileButton.addEventListener('click', removeFile);

// API Key Modal Event Listeners
apiKeyButton.addEventListener('click', openApiKeyModal);
apiKeyCancelButton.addEventListener('click', closeApiKeyModal);
apiKeyForm.addEventListener('submit', saveApiKey);

// Initialize the chat with a welcome message
initializeChat();

/**
 * API Key Modal Functions
 */
function openApiKeyModal() {
    // Pre-fill with existing API key if available
    if (API_KEY) {
        apiKeyInput.value = API_KEY;
    }
    apiKeyModal.classList.remove('hidden');
}

function closeApiKeyModal() {
    apiKeyModal.classList.add('hidden');
}

function saveApiKey(event) {
    event.preventDefault();
    const newApiKey = apiKeyInput.value.trim();
    
    if (!newApiKey) {
        alert('Please enter a valid API key');
        return;
    }
    
    // Save to localStorage
    localStorage.setItem('gemini_api_key', newApiKey);
    API_KEY = newApiKey;
    
    // Initialize the Gemini API client with the new key
    genAI = new GoogleGenerativeAI(API_KEY);
    
    // Reset chat session to use the new API key
    chatSession = null;
    
    // Close the modal
    closeApiKeyModal();
    
    // Add a confirmation message
    messages.push({
        id: Date.now(),
        role: 'model',
        text: 'API key has been updated successfully! You can now use the chat.'
    });
    
    render();
}

/**
 * Initialize the chat with a welcome message
 */
function initializeChat() {
    let welcomeMessage = 'Hello! I\'m Analyst AI. I can help you analyze documents and answer questions. Upload a document or ask me anything!';
    
    // Add API key setup instructions if no API key is set
    if (!API_KEY) {
        welcomeMessage += '\n\n**Important Setup Required**: You need to set up your Gemini API key before using this application. Click the "Set API Key" button in the top right corner to get started.';
    }
    
    messages = [
        {
            id: Date.now(),
            role: 'model',
            text: welcomeMessage
        }
    ];
    render();
}

/**
 * Render the UI based on current state
 */
function render() {
    // Clear the chat container
    chatContainer.innerHTML = '';
    
    // Render each message
    messages.forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.classList.add(
            'p-3', 
            'rounded-lg', 
            'max-w-3/4', 
            'mb-4',
            message.role === 'user' ? 'ml-auto' : 'mr-auto'
        );
        
        // Apply different styling based on message role
        if (message.role === 'user') {
            messageElement.classList.add('bg-indigo-600', 'text-white');
        } else {
            messageElement.classList.add('bg-slate-800');
            
            // Add logo for model messages
            const logoContainer = document.createElement('div');
            logoContainer.classList.add('flex', 'items-center', 'mb-2');
            
            const logo = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            logo.setAttribute('class', 'w-5 h-5 mr-2');
            logo.setAttribute('viewBox', '0 0 24 24');
            logo.setAttribute('fill', 'none');
            logo.innerHTML = `
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            `;
            
            logoContainer.appendChild(logo);
            logoContainer.appendChild(document.createTextNode('Analyst AI'));
            messageElement.appendChild(logoContainer);
        }
        
        // Create message content container
        const contentElement = document.createElement('div');
        
        // Parse markdown for model messages
        if (message.role === 'model') {
            contentElement.classList.add('markdown-content');
            contentElement.innerHTML = marked.parse(message.text || '');
        } else {
            contentElement.textContent = message.text;
        }
        
        messageElement.appendChild(contentElement);
        chatContainer.appendChild(messageElement);
    });
    
    // Add typing indicator if loading
    if (isLoading) {
        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('bg-slate-800', 'p-3', 'rounded-lg', 'mr-auto', 'mb-4', 'flex', 'items-center');
        
        // Add logo
        const logo = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        logo.setAttribute('class', 'w-5 h-5 mr-2');
        logo.setAttribute('viewBox', '0 0 24 24');
        logo.setAttribute('fill', 'none');
        logo.innerHTML = `
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        `;
        
        typingIndicator.appendChild(logo);
        typingIndicator.appendChild(document.createTextNode('Analyst AI is typing...'));
        chatContainer.appendChild(typingIndicator);
    }
    
    // Update UI state based on isLoading
    messageInput.disabled = isLoading;
    sendButton.disabled = isLoading;
    attachButton.disabled = isLoading;
    
    // Update file preview visibility
    if (uploadedFile) {
        filePreview.classList.remove('hidden');
        fileName.textContent = uploadedFile.name;
    } else {
        filePreview.classList.add('hidden');
    }
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Handle file selection
 * @param {Event} event - The change event from the file input
 */
function handleFileSelection(event) {
    const file = event.target.files[0];
    if (file) {
        // Check file type
        const validTypes = ['.pdf', '.docx', '.txt'];
        const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
        
        if (validTypes.includes(fileExtension.toLowerCase())) {
            uploadedFile = file;
            render();
        } else {
            alert('Please upload a PDF, DOCX, or TXT file.');
            fileInput.value = '';
        }
    }
}

/**
 * Remove the uploaded file
 */
function removeFile() {
    uploadedFile = null;
    fileInput.value = '';
    render();
}

/**
 * Convert a file to base64
 * @param {File} file - The file to convert
 * @returns {Promise<string>} - A promise that resolves to the base64 string
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Extract the base64 part from the data URL
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = error => reject(error);
    });
}

/**
 * Handle sending a message
 * @param {Event} event - The submit event from the form
 */
async function handleSendMessage(event) {
    event.preventDefault();
    
    const userMessage = messageInput.value.trim();
    
    // Don't send if there's no message and no file
    if (!userMessage && !uploadedFile) return;
    
    // Check if API key is set
    if (!API_KEY) {
        messages.push({
            id: Date.now(),
            role: 'user',
            text: userMessage || `Please analyze this ${uploadedFile?.name} file.`
        });
        
        // Clear input
        messageInput.value = '';
        
        // Render to show user message
        render();
        
        // Prompt user to set API key
        messages.push({
            id: Date.now() + 1,
            role: 'model',
            text: 'You need to set your Gemini API key before using the chat. Please click the "Set API Key" button in the top right corner.'
        });
        
        render();
        return;
    }
    
    try {
        // Set loading state
        isLoading = true;
        
        // Add user message to chat
        if (userMessage) {
            messages.push({
                id: Date.now(),
                role: 'user',
                text: userMessage
            });
        } else if (uploadedFile) {
            // If only a file is uploaded without text, add a generic message
            messages.push({
                id: Date.now(),
                role: 'user',
                text: `Please analyze this ${uploadedFile.name} file.`
            });
        }
        
        // Clear input
        messageInput.value = '';
        
        // Render to show user message
        render();
        
        // Prepare file data if present
        let fileData = null;
        if (uploadedFile) {
            const base64 = await fileToBase64(uploadedFile);
            fileData = {
                mimeType: uploadedFile.type,
                data: base64
            };
            
            // Clear the file after sending
            removeFile();
        }
        
        // Initialize chat session if it doesn't exist
        if (!chatSession) {
            const model = genAI.getGenerativeModel({ model: MODEL_NAME });
            
            // Set safety settings
            const safetySettings = [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                },
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
                }
            ];
            
            // Create chat session with system instruction
            chatSession = model.startChat({
                history: [],
                safetySettings,
                generationConfig: { temperature: 0.4 },
                systemInstruction: SYSTEM_INSTRUCTION
            });
        }
        
        // Add placeholder for model response
        const responseId = Date.now() + 1;
        messages.push({
            id: responseId,
            role: 'model',
            text: ''
        });
        
        // Prepare content parts for the message
        const contentParts = [];
        
        // Add text if present
        if (userMessage) {
            contentParts.push({ text: userMessage });
        }
        
        // Add file if present
        if (fileData) {
            contentParts.push({
                inlineData: {
                    mimeType: fileData.mimeType,
                    data: fileData.data
                }
            });
        }
        
        // Send message to Gemini API and stream the response
        const result = await chatSession.sendMessageStream(contentParts);
        
        // Process the streamed response
        let responseText = '';
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            responseText += chunkText;
            
            // Update the model's message with the accumulated text
            const modelMessageIndex = messages.findIndex(msg => msg.id === responseId);
            if (modelMessageIndex !== -1) {
                messages[modelMessageIndex].text = responseText;
                render();
            }
        }
        
        // Set loading state to false when done
        isLoading = false;
        render();
        
    } catch (error) {
        console.error('Error sending message:', error);
        
        // Prepare a user-friendly error message
        let errorMessage = 'Sorry, an error occurred. Please try again.';
        
        // Check for API key errors
        if (error.message && error.message.includes('API key not valid')) {
            errorMessage = 'API key error: The API key you provided is not valid. Please click the "Set API Key" button to update your API key. You can get a valid key from [Google AI Studio](https://makersuite.google.com/app/apikey).';
            
            // Reset the API key in localStorage since it's invalid
            localStorage.removeItem('gemini_api_key');
            API_KEY = '';
            genAI = null;
            chatSession = null;
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }
        
        // Add error message to chat
        messages.push({
            id: Date.now() + 1,
            role: 'model',
            text: errorMessage
        });
        
        // Set loading state to false
        isLoading = false;
        render();
    }
}
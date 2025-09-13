// Import the Google Generative AI SDK
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Configuration
const MODEL_NAME = 'gemini-2.5-flash';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes
const CHUNK_SIZE = 15 * 1024 * 1024; // 15MB chunks to ensure we stay under limits

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
        text: "You are Analyst AI, a specialized document analysis assistant for financial and ESG reporting.\n\n**CRITICAL: Response Requirements**\n- Provide ONLY the information requested in the user's prompt\n- Do NOT add extra sections like 'Recommendations', 'Summary', 'Conclusions', or 'Additional Notes'\n- Do NOT provide unsolicited advice or suggestions\n- Keep responses focused and minimal - answer only what is asked\n- Avoid verbose explanations unless specifically requested\n\n**CRITICAL: Accuracy and Source Requirements**\n- NEVER invent, assume, or hallucinate information that is not explicitly present in the provided documents\n- ONLY provide information that you can directly see and verify in the uploaded content\n- If information is not available in the document, clearly state \"This information is not available in the provided document\"\n- Do not make assumptions or fill in missing data with typical industry values\n\n**CRITICAL: Language Requirements**\n- ALWAYS respond in English only, regardless of the document's original language\n- If analyzing documents in other languages (Hindi, Spanish, French, Chinese, Arabic, etc.), translate all content and provide analysis in English\n- Maintain original numerical values and proper nouns but translate all descriptions, categories, and analysis text to English\n- When referencing non-English content, provide: \"[Original text] (English: [translation])\" format when helpful\n\n**CRITICAL: Page Reference Requirements**\n- When referencing page numbers, ALWAYS specify \"PDF page [number]\" for PDF documents\n- For other document types, use \"Document page [number]\"\n- NEVER use generic terms like \"page\" without specifying the document type\n- Page numbers must correspond to actual pages in the uploaded document\n- Do not reference pages that don't exist in the document\n\n**Core Analysis Guidelines:**\n- Respond in a clear, structured manner using Markdown formatting\n- When creating tables, use simple 3-column format: | Metric | Value | Pages |\n- Do NOT add Status columns or recommendation columns unless specifically requested\n- For data presentation, prefer tables over lists when applicable\n- Ensure table headers are clearly defined with | Header | format\n- Use alignment indicators when helpful\n- Provide accurate and comprehensive insights based ONLY on document content\n- Handle multilingual documents by translating content to English for analysis\n\n**CRITICAL: Duplicate Data Detection & Reporting**\n\nWhen analyzing documents, you MUST identify and report duplicate metrics/KPIs that appear multiple times:\n\n1. **For IDENTICAL values across multiple locations:**\n   - Report the metric once with all page references using proper format\n   - Format: \"Scope 1 Emissions: 500 MT (PDF pages: 15, 23, 45)\" or \"Scope 1 Emissions: 500 MT (Document pages: 15, 23, 45)\"\n\n2. **For DIFFERENT values of the same metric:**\n   - Report ALL instances with their respective page numbers\n   - Highlight the discrepancy clearly\n   - Format: \"⚠️ Scope 1 Emissions DISCREPANCY:\n     - 500 MT (PDF pages: 15, 23)\n     - 520 MT (PDF page: 45)\"\n\n3. **Always include:**\n   - Exact page numbers with proper document type specification\n   - Clear identification of discrepancies\n   - Both consistent and conflicting values\n   - All analysis and descriptions in English only\n   - ONLY information that is verifiable in the provided documents\n\n**Table Format for Metrics with Multiple References:**\n| Metric | Value | Pages |\n|--------|-------|-------|\n| Scope 1 Emissions | 500 MT | PDF pages: 15, 23 |\n| Scope 1 Emissions | 520 MT | PDF page: 45 |\n\n**Multilingual Document Handling:**\n- Accept documents in any language (Hindi, Spanish, French, Chinese, Arabic, Japanese, German, etc.)\n- Always provide analysis, summaries, and insights in English\n- Translate metric names, categories, and descriptions to English\n- Preserve original numerical values and units\n- Note the original document language for context when relevant\n- ONLY translate and report content that actually exists in the document\n\n**CRITICAL: Minimal Response Policy**\n- Answer ONLY what is asked in the prompt\n- Do not add sections like 'Recommendations for Environmental Data Validation'\n- Do not add 'Summary of Discrepancies and Recommendations'\n- Do not provide unsolicited analysis or suggestions\n- Keep responses clean and focused on the specific request\n\n**CRITICAL: No Hallucination Policy**\n- If a section, metric, or data point is missing, state this clearly\n- Do not provide \"typical\" or \"standard\" values when actual data is unavailable\n- Do not extrapolate or estimate missing information\n- When asked about information not in the document, respond: \"This specific information is not available in the provided document(s)\"\n\nThis ensures comprehensive data validation and transparency in reporting with consistent English output and absolute accuracy."
    }]
};

// State management
let messages = []; // Array of message objects {id, role, text}
let isLoading = false;
let loadingMessage = 'Analyst AI is typing...'; // Dynamic loading message
let uploadedFiles = []; // Array to store multiple files
let chatSession = null; // To hold the Gemini chat session
let promptPrefixes = JSON.parse(localStorage.getItem('prompt_prefixes') || '[]');
let activePrefix = localStorage.getItem('active_prefix') || '';

let isProcessingLargeFile = false;
let fileProcessingProgress = { current: 0, total: 0 };

// DOM Elements - with error checking
function safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Element with id '${id}' not found`);
    }
    return element;
}

const chatContainer = safeGetElement('chat-container');
const chatForm = safeGetElement('chat-form');
const messageInput = safeGetElement('message-input');
const sendButton = safeGetElement('send-button');
const attachButton = safeGetElement('attach-button');
const fileInput = safeGetElement('file-input');
const filePreview = safeGetElement('file-preview');
const fileList = safeGetElement('file-list');
const removeAllFilesButton = safeGetElement('remove-all-files');
const dragOverlay = safeGetElement('drag-overlay');
const resetSessionButton = safeGetElement('reset-session-button');

// Prompt Prefix Elements
const promptPrefixButton = safeGetElement('prompt-prefix-button');
const promptPrefixModal = safeGetElement('prompt-prefix-modal');
const prefixForm = safeGetElement('prefix-form');
const prefixNameInput = safeGetElement('prefix-name');
const prefixContentInput = safeGetElement('prefix-content');
const autoApplyPrefixCheckbox = safeGetElement('auto-apply-prefix');
const clearPrefixFormButton = safeGetElement('clear-prefix-form');
const closePrefixModalButton = safeGetElement('close-prefix-modal');
const prefixList = safeGetElement('prefix-list');
const activePrefixSelect = safeGetElement('active-prefix-select');
const activePrefixIndicator = safeGetElement('active-prefix-indicator');
const activePrefixName = safeGetElement('active-prefix-name');
const removeActivePrefixButton = safeGetElement('remove-active-prefix');

// Quick Prompt Dropdown Elements
const quickPromptButton = safeGetElement('quick-prompt-button');
const quickPromptDropdown = safeGetElement('quick-prompt-dropdown');
const quickPromptList = safeGetElement('quick-prompt-list');
const managePrefixesLink = safeGetElement('manage-prefixes-link');

// File Processing Progress Elements
const fileProcessingProgressElement = safeGetElement('file-processing-progress');
const progressBar = safeGetElement('progress-bar');
const progressText = safeGetElement('progress-text');

// API Key Modal Elements
const apiKeyButton = safeGetElement('api-key-button');
const apiKeyModal = safeGetElement('api-key-modal');
const apiKeyForm = safeGetElement('api-key-form');
const apiKeyInput = safeGetElement('api-key-input');
const apiKeyCancelButton = safeGetElement('api-key-cancel');

// Safe event listener attachment function
function safeAddEventListener(element, event, handler) {
    if (element) {
        element.addEventListener(event, handler);
    } else {
        console.error(`Cannot attach ${event} listener: element is null`);
    }
}

// Event Listeners with safe attachment
safeAddEventListener(chatForm, 'submit', handleSendMessage);
safeAddEventListener(attachButton, 'click', () => {
    if (fileInput) {
        fileInput.click();
    } else {
        console.error('File input element not found');
    }
});
safeAddEventListener(fileInput, 'change', handleFileSelection);
safeAddEventListener(removeAllFilesButton, 'click', removeAllFiles);

// Drag and Drop Event Listeners
safeAddEventListener(chatContainer, 'dragover', handleDragOver);
safeAddEventListener(chatContainer, 'dragleave', handleDragLeave);
safeAddEventListener(chatContainer, 'drop', handleDrop);
document.addEventListener('dragover', preventDefaultDrag);
document.addEventListener('drop', preventDefaultDrag);

// Reset Session Event Listener
safeAddEventListener(resetSessionButton, 'click', resetSession);

// Prompt Prefix Event Listeners
safeAddEventListener(promptPrefixButton, 'click', openPromptPrefixModal);
safeAddEventListener(closePrefixModalButton, 'click', closePromptPrefixModal);
safeAddEventListener(prefixForm, 'submit', savePrefix);
safeAddEventListener(clearPrefixFormButton, 'click', clearPrefixForm);
safeAddEventListener(activePrefixSelect, 'change', setActivePrefix);
safeAddEventListener(removeActivePrefixButton, 'click', removeActivePrefix);

// Quick Prompt Dropdown Event Listeners
safeAddEventListener(quickPromptButton, 'click', toggleQuickPromptDropdown);
safeAddEventListener(managePrefixesLink, 'click', openPromptPrefixModalFromDropdown);

// Close dropdown when clicking outside
document.addEventListener('click', (event) => {
    if (quickPromptDropdown && !quickPromptDropdown.contains(event.target) && !quickPromptButton.contains(event.target)) {
        closeQuickPromptDropdown();
    }
});

// API Key Modal Event Listeners
safeAddEventListener(apiKeyButton, 'click', openApiKeyModal);
safeAddEventListener(apiKeyCancelButton, 'click', closeApiKeyModal);
safeAddEventListener(apiKeyForm, 'submit', saveApiKey);

// Initialize the chat with a welcome message
initializeChat();

// Initialize default prompts
initializeDefaultPrompts();

// Initialize prompt prefix indicator
updateActivePrefixIndicator();

// Essential Functions

/**
 * Initialize default data validation prompts if not exists
 */
function initializeDefaultPrompts() {
    const defaultPrompts = [
        {
            id: 'data-validation-' + Date.now(),
            name: 'Data Validation & Duplicates',
            content: 'Please analyze this document with special focus on identifying duplicate metrics and data inconsistencies. For any metric that appears multiple times, report ALL instances with their specific PDF page numbers (e.g., "PDF page 15"). If values are identical, consolidate with page references. If values differ, provide all variations with their respective pages in a simple table format. ONLY provide information that is actually present in the document - do not invent or assume any data. Respond in English only regardless of document language.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'financial-metrics-' + Date.now(),
            name: 'Financial Metrics Analysis',
            content: 'Extract and analyze all financial metrics from this document. Pay special attention to: Revenue, EBITDA, Net Income, Cash Flow, and any other key financial indicators. If the same metric appears multiple times with different values, report all instances with specific PDF page numbers and flag potential discrepancies. ONLY extract information that is explicitly stated in the document. Do not estimate or assume missing values. Translate all content to English if the document is in another language.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'esg-metrics-' + Date.now(),
            name: 'ESG Metrics Analysis',
            content: 'Analyze all ESG (Environmental, Social, Governance) metrics in this document. Focus on: Scope 1/2/3 emissions, water consumption, waste generation, energy usage, and social indicators. For any metric reported multiple times, provide all values with their specific PDF page references and identify any inconsistencies. ONLY report metrics that are explicitly mentioned in the document. Do not provide typical industry values or estimates for missing data. Provide analysis in English regardless of original document language.',
            createdAt: new Date().toISOString()
        }
    ];
    
    // Only add defaults if no prompts exist
    if (promptPrefixes.length === 0) {
        promptPrefixes = defaultPrompts;
        localStorage.setItem('prompt_prefixes', JSON.stringify(promptPrefixes));
    }
}

/**
 * Prompt Prefix Management Functions
 */
function openPromptPrefixModal() {
    if (!promptPrefixModal) {
        console.error('Prompt prefix modal element not found');
        return;
    }
    renderPrefixList();
    updateActivePrefixSelect();
    promptPrefixModal.classList.remove('hidden');
}

function closePromptPrefixModal() {
    if (!promptPrefixModal) {
        console.error('Prompt prefix modal element not found');
        return;
    }
    promptPrefixModal.classList.add('hidden');
    clearPrefixForm();
}

function savePrefix(event) {
    event.preventDefault();
    
    if (!prefixNameInput || !prefixContentInput) {
        console.error('Prefix form inputs not found');
        return;
    }
    
    const name = prefixNameInput.value.trim();
    const content = prefixContentInput.value.trim();
    
    if (!name || !content) {
        alert('Please enter both a name and content for the prefix.');
        return;
    }
    
    // Check if editing existing prefix
    const editingId = prefixForm.dataset.editingId;
    
    if (editingId) {
        // Update existing prefix
        const prefixIndex = promptPrefixes.findIndex(p => p.id === editingId);
        if (prefixIndex !== -1) {
            promptPrefixes[prefixIndex] = {
                ...promptPrefixes[prefixIndex],
                name,
                content
            };
        }
        delete prefixForm.dataset.editingId;
    } else {
        // Create new prefix
        const newPrefix = {
            id: Date.now().toString(),
            name,
            content,
            createdAt: new Date().toISOString()
        };
        promptPrefixes.push(newPrefix);
    }
    
    // Set as active if auto-apply is checked
    if (autoApplyPrefixCheckbox && autoApplyPrefixCheckbox.checked) {
        const savedPrefix = editingId ? 
            promptPrefixes.find(p => p.id === editingId) : 
            promptPrefixes[promptPrefixes.length - 1];
        activePrefix = savedPrefix.id;
        localStorage.setItem('active_prefix', activePrefix);
    }
    
    // Save to localStorage
    localStorage.setItem('prompt_prefixes', JSON.stringify(promptPrefixes));
    
    // Update UI
    renderPrefixList();
    updateActivePrefixSelect();
    updateActivePrefixIndicator();
    clearPrefixForm();
    updateQuickPromptList();
}

function clearPrefixForm() {
    if (prefixNameInput) prefixNameInput.value = '';
    if (prefixContentInput) prefixContentInput.value = '';
    if (autoApplyPrefixCheckbox) autoApplyPrefixCheckbox.checked = false;
    if (prefixForm) delete prefixForm.dataset.editingId;
}

function editPrefix(prefixId) {
    const prefix = promptPrefixes.find(p => p.id === prefixId);
    if (prefix) {
        if (prefixNameInput) prefixNameInput.value = prefix.name;
        if (prefixContentInput) prefixContentInput.value = prefix.content;
        if (prefixForm) prefixForm.dataset.editingId = prefixId;
        if (autoApplyPrefixCheckbox) autoApplyPrefixCheckbox.checked = activePrefix === prefixId;
    }
}

function deletePrefix(prefixId) {
    if (confirm('Are you sure you want to delete this prefix?')) {
        promptPrefixes = promptPrefixes.filter(p => p.id !== prefixId);
        
        // Clear active prefix if it was deleted
        if (activePrefix === prefixId) {
            activePrefix = '';
            localStorage.setItem('active_prefix', activePrefix);
        }
        
        localStorage.setItem('prompt_prefixes', JSON.stringify(promptPrefixes));
        renderPrefixList();
        updateActivePrefixSelect();
        updateActivePrefixIndicator();
        updateQuickPromptList();
    }
}

function renderPrefixList() {
    if (!prefixList) {
        console.error('Prefix list element not found');
        return;
    }
    
    prefixList.innerHTML = '';
    
    if (promptPrefixes.length === 0) {
        prefixList.innerHTML = '<p class="text-gray-400 text-sm italic">No prefixes saved yet.</p>';
        return;
    }
    
    promptPrefixes.forEach(prefix => {
        const prefixElement = document.createElement('div');
        prefixElement.className = 'flex items-center justify-between p-3 bg-slate-700 rounded-md';
        
        prefixElement.innerHTML = `
            <div class="flex-1">
                <h4 class="font-semibold text-white">${escapeHtml(prefix.name)}</h4>
                <p class="text-sm text-gray-300 truncate" style="max-width: 300px;">${escapeHtml(prefix.content)}</p>
            </div>
            <div class="flex items-center space-x-2">
                <button onclick="editPrefix('${prefix.id}')" class="text-blue-400 hover:text-blue-300 p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                </button>
                <button onclick="setActivePrefixById('${prefix.id}')" class="text-green-400 hover:text-green-300 p-1" title="Set as active">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                </button>
                <button onclick="deletePrefix('${prefix.id}')" class="text-red-400 hover:text-red-300 p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd" />
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        `;
        
        prefixList.appendChild(prefixElement);
    });
}

function updateActivePrefixSelect() {
    if (!activePrefixSelect) {
        console.error('Active prefix select element not found');
        return;
    }
    
    activePrefixSelect.innerHTML = '<option value="">None</option>';
    
    promptPrefixes.forEach(prefix => {
        const option = document.createElement('option');
        option.value = prefix.id;
        option.textContent = prefix.name;
        option.selected = activePrefix === prefix.id;
        activePrefixSelect.appendChild(option);
    });
}

function setActivePrefix() {
    if (!activePrefixSelect) {
        console.error('Active prefix select element not found');
        return;
    }
    
    const selectedPrefixId = activePrefixSelect.value;
    activePrefix = selectedPrefixId;
    localStorage.setItem('active_prefix', activePrefix);
    updateActivePrefixIndicator();
    updateQuickPromptList();
}

function setActivePrefixById(prefixId) {
    activePrefix = prefixId;
    localStorage.setItem('active_prefix', activePrefix);
    updateActivePrefixSelect();
    updateActivePrefixIndicator();
    updateQuickPromptList();
}

function removeActivePrefix() {
    activePrefix = '';
    localStorage.setItem('active_prefix', activePrefix);
    updateActivePrefixSelect();
    updateActivePrefixIndicator();
    updateQuickPromptList();
}

function updateActivePrefixIndicator() {
    if (!activePrefixIndicator || !activePrefixName) {
        console.error('Active prefix indicator elements not found');
        return;
    }
    
    if (activePrefix) {
        const prefix = promptPrefixes.find(p => p.id === activePrefix);
        if (prefix) {
            activePrefixName.textContent = prefix.name;
            activePrefixIndicator.classList.remove('hidden');
        } else {
            activePrefixIndicator.classList.add('hidden');
        }
    } else {
        activePrefixIndicator.classList.add('hidden');
    }
}

function getActivePrefixContent() {
    if (activePrefix) {
        const prefix = promptPrefixes.find(p => p.id === activePrefix);
        return prefix ? prefix.content : '';
    }
    return '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Quick Prompt Dropdown Functions
 */
function toggleQuickPromptDropdown() {
    if (!quickPromptDropdown) return;
    
    if (quickPromptDropdown.classList.contains('hidden')) {
        openQuickPromptDropdown();
    } else {
        closeQuickPromptDropdown();
    }
}

function openQuickPromptDropdown() {
    if (!quickPromptDropdown) return;
    
    updateQuickPromptList();
    quickPromptDropdown.classList.remove('hidden');
}

function closeQuickPromptDropdown() {
    if (!quickPromptDropdown) return;
    
    quickPromptDropdown.classList.add('hidden');
}

function updateQuickPromptList() {
    if (!quickPromptList) return;
    
    // Clear existing items except the "None" option
    const noneOption = quickPromptList.querySelector('[data-prefix-id=""]');
    quickPromptList.innerHTML = '';
    
    // Add "None" option back
    if (noneOption) {
        quickPromptList.appendChild(noneOption);
    } else {
        const noneButton = document.createElement('button');
        noneButton.type = 'button';
        noneButton.className = 'w-full text-left px-3 py-2 hover:bg-slate-600 text-sm text-gray-300';
        noneButton.setAttribute('data-prefix-id', '');
        noneButton.innerHTML = `
            <span class="font-semibold">None</span>
            <p class="text-xs text-gray-400">No prefix applied</p>
        `;
        noneButton.addEventListener('click', () => selectQuickPrefix(''));
        quickPromptList.appendChild(noneButton);
    }
    
    // Add current prefixes
    promptPrefixes.forEach(prefix => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `w-full text-left px-3 py-2 hover:bg-slate-600 text-sm ${
            activePrefix === prefix.id ? 'bg-slate-600 text-white' : 'text-gray-300'
        }`;
        button.setAttribute('data-prefix-id', prefix.id);
        
        const truncatedContent = prefix.content.length > 60 ? 
            prefix.content.substring(0, 60) + '...' : 
            prefix.content;
            
        button.innerHTML = `
            <span class="font-semibold">${escapeHtml(prefix.name)}</span>
            <p class="text-xs text-gray-400">${escapeHtml(truncatedContent)}</p>
        `;
        
        button.addEventListener('click', () => selectQuickPrefix(prefix.id));
        quickPromptList.appendChild(button);
    });
}

function selectQuickPrefix(prefixId) {
    activePrefix = prefixId;
    localStorage.setItem('active_prefix', activePrefix);
    updateActivePrefixIndicator();
    updateActivePrefixSelect();
    closeQuickPromptDropdown();
    
    // Focus back on message input
    if (messageInput) {
        messageInput.focus();
    }
}

function openPromptPrefixModalFromDropdown() {
    closeQuickPromptDropdown();
    openPromptPrefixModal();
}

// Make functions globally available for onclick handlers
window.editPrefix = editPrefix;
window.deletePrefix = deletePrefix;
window.setActivePrefixById = setActivePrefixById;

/**
 * Initialize the chat with a welcome message
 */
function initializeChat() {
    let welcomeMessage = `Hello! I'm Analyst AI specialized in document analysis. I can help you analyze documents, validate data consistency, and detect duplicate metrics across reports.

Upload documents or ask me anything!`;
    
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
 * API Key Modal Functions
 */
function openApiKeyModal() {
    if (!apiKeyModal || !apiKeyInput) {
        console.error('API key modal elements not found');
        return;
    }
    
    // Pre-fill with existing API key if available
    if (API_KEY) {
        apiKeyInput.value = API_KEY;
    }
    apiKeyModal.classList.remove('hidden');
}

function closeApiKeyModal() {
    if (!apiKeyModal) {
        console.error('API key modal element not found');
        return;
    }
    apiKeyModal.classList.add('hidden');
}

function saveApiKey(event) {
    event.preventDefault();
    
    if (!apiKeyInput) {
        console.error('API key input element not found');
        return;
    }
    
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
 * Reset Session Function
 */
function resetSession() {
    // Clear messages
    messages = [];
    
    // Reset chat session
    chatSession = null;
    
    // Clear any uploaded files
    removeAllFiles();
    
    // Reinitialize with welcome message
    initializeChat();
}

/**
 * Drag and Drop Functions
 */
function preventDefaultDrag(event) {
    event.preventDefault();
}

function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    if (dragOverlay) {
        dragOverlay.classList.remove('hidden');
    }
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    // Only hide overlay if we're leaving the chat container itself
    if (chatContainer && !chatContainer.contains(event.relatedTarget)) {
        if (dragOverlay) {
            dragOverlay.classList.add('hidden');
        }
    }
}

function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    
    if (dragOverlay) {
        dragOverlay.classList.add('hidden');
    }
    
    const files = Array.from(event.dataTransfer.files);
    
    if (files.length > 0) {
        files.forEach(file => {
            processFileUpload(file);
        });
    }
}

/**
 * Process File Upload
 */
function processFileUpload(file) {
    // Check file type
    const validTypes = ['.pdf', '.docx', '.txt', '.html'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
    
    if (validTypes.includes(fileExtension.toLowerCase())) {
        // Check if file already exists
        const existingFileIndex = uploadedFiles.findIndex(f => f.name === file.name && f.size === file.size);
        if (existingFileIndex === -1) {
            uploadedFiles.push(file);
        }
        render();
    } else {
        alert('Please upload PDF, DOCX, TXT, or HTML files only.');
        if (fileInput) {
            fileInput.value = '';
        }
    }
}

/**
 * Handle file selection
 */
function handleFileSelection(event) {
    if (!event.target || !event.target.files) {
        console.error('File selection event is invalid');
        return;
    }
    
    const files = Array.from(event.target.files);
    files.forEach(file => {
        processFileUpload(file);
    });
}

/**
 * Remove all uploaded files
 */
function removeAllFiles() {
    uploadedFiles = [];
    if (fileInput) {
        fileInput.value = '';
    }
    render();
}

/**
 * Remove a specific file
 */
function removeFile(index) {
    if (index >= 0 && index < uploadedFiles.length) {
        uploadedFiles.splice(index, 1);
        if (uploadedFiles.length === 0 && fileInput) {
            fileInput.value = '';
        }
        render();
    }
}

/**
 * Render file list in the preview area
 */
function renderFileList() {
    if (!fileList) return;
    
    fileList.innerHTML = '';
    
    uploadedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'flex items-center justify-between py-1 px-2 bg-slate-700 rounded text-sm';
        
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const fileInfo = `${file.name} (${fileSizeMB}MB)`;
        
        fileItem.innerHTML = `
            <span class="truncate flex-1 mr-2" title="${file.name}">${fileInfo}</span>
            <button class="text-red-400 hover:text-red-300 p-1" onclick="removeFile(${index})" title="Remove file">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
            </button>
        `;
        
        fileList.appendChild(fileItem);
    });
}

/**
 * Convert a file to base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            try {
                const result = reader.result;
                if (!result || typeof result !== 'string') {
                    throw new Error('Failed to read file data');
                }
                
                const base64String = result.split(',')[1];
                if (!base64String || base64String.length === 0) {
                    throw new Error('Failed to extract base64 data from file');
                }
                
                resolve(base64String);
            } catch (error) {
                reject(new Error(`File conversion error: ${error.message}`));
            }
        };
        reader.onerror = error => {
            reject(new Error(`FileReader error: ${error}`));
        };
    });
}

/**
 * Handle sending a message
 */
async function handleSendMessage(event) {
    event.preventDefault();
    
    const userMessage = messageInput.value.trim();
    
    // Don't send if there's no message and no files
    if (!userMessage && uploadedFiles.length === 0) return;
    
    // Check if API key is set
    if (!API_KEY) {
        openApiKeyModal();
        return;
    }
    
    try {
        // Set loading state
        isLoading = true;
        
        // Get active prefix content
        const prefixContent = getActivePrefixContent();
        
        // Prepare the final message with prefix if active
        let finalMessage = userMessage;
        if (prefixContent && userMessage) {
            finalMessage = `${prefixContent}\n\n${userMessage}`;
        } else if (prefixContent && uploadedFiles.length > 0) {
            finalMessage = `${prefixContent}\n\nPlease analyze these ${uploadedFiles.length} files: ${uploadedFiles.map(f => f.name).join(', ')}.`;
        }
        
        // Add user message to chat (display original message without prefix)
        if (userMessage) {
            messages.push({
                id: Date.now(),
                role: 'user',
                text: userMessage
            });
        } else if (uploadedFiles.length > 0) {
            messages.push({
                id: Date.now(),
                role: 'user',
                text: `Please analyze these ${uploadedFiles.length} files: ${uploadedFiles.map(f => f.name).join(', ')}.`
            });
        }
        
        // Clear input
        messageInput.value = '';
        
        // Render to show user message
        render();
        
        // Initialize chat session if it doesn't exist
        if (!chatSession) {
            const model = genAI.getGenerativeModel({ model: MODEL_NAME });
            
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
        
        // Add text if present (use finalMessage with prefix)
        if (finalMessage) {
            contentParts.push({ text: finalMessage });
        }
        
        // Add files if present
        if (uploadedFiles.length > 0) {
            for (const file of uploadedFiles) {
                const base64 = await fileToBase64(file);
                contentParts.push({
                    inlineData: {
                        mimeType: file.type,
                        data: base64
                    }
                });
            }
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
        
        // Clear the files after successful processing
        if (uploadedFiles.length > 0) {
            removeAllFiles();
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        
        let errorMessage = 'Sorry, an error occurred. Please try again.';
        
        if (error.message && error.message.includes('API key not valid')) {
            errorMessage = 'API key error: The API key you provided is not valid. Please click the "Set API Key" button to update your API key.';
            localStorage.removeItem('gemini_api_key');
            API_KEY = '';
            genAI = null;
            chatSession = null;
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }
        
        messages.push({
            id: Date.now() + 1,
            role: 'model',
            text: errorMessage
        });
    } finally {
        isLoading = false;
        render();
    }
}

/**
 * Render the chat messages
 */
function render() {
    if (!chatContainer) {
        console.error('Chat container not found');
        return;
    }
    
    chatContainer.innerHTML = '';
    
    messages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = message.role === 'user' ? 
            'flex justify-end' : 'flex justify-start';
        
        const messageContent = document.createElement('div');
        messageContent.className = message.role === 'user' ? 
            'max-w-3xl bg-indigo-600 text-white p-3 rounded-lg' : 
            'max-w-4xl bg-slate-800 text-white p-3 rounded-lg markdown-content';
        
        if (message.role === 'model') {
            // Use marked to parse the markdown
            messageContent.innerHTML = marked.parse(message.text);
        } else {
            messageContent.textContent = message.text;
        }
        
        messageDiv.appendChild(messageContent);
        chatContainer.appendChild(messageDiv);
    });
    
    // Add loading indicator if we're loading
    if (isLoading) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'flex justify-start';
        
        const loadingContent = document.createElement('div');
        loadingContent.className = 'max-w-4xl bg-slate-800 text-white p-3 rounded-lg flex items-center space-x-2';
        
        loadingContent.innerHTML = `
            <div class="flex space-x-1">
                <div class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                <div class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style="animation-delay: 0.1s;"></div>
                <div class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style="animation-delay: 0.2s;"></div>
            </div>
            <span class="text-gray-300">${loadingMessage}</span>
        `;
        
        loadingDiv.appendChild(loadingContent);
        chatContainer.appendChild(loadingDiv);
    }
    
    // Update UI state based on isLoading
    if (messageInput) messageInput.disabled = isLoading;
    if (sendButton) sendButton.disabled = isLoading;
    if (attachButton) attachButton.disabled = isLoading;
    
    // Update file preview visibility
    if (uploadedFiles.length > 0 && filePreview) {
        filePreview.classList.remove('hidden');
        renderFileList();
    } else if (filePreview) {
        filePreview.classList.add('hidden');
    }
    
    // Update active prefix indicator
    updateActivePrefixIndicator();
    
    // Scroll to bottom
    if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

// Make removeFile function globally available
window.removeFile = removeFile;
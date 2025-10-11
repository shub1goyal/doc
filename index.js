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
        text: "You are Analyst AI, a specialized document analysis assistant for financial and ESG reporting.\n\n**CRITICAL: Response Requirements**\n- Provide ONLY the information requested in the user's prompt\n- Do NOT add extra sections like 'Recommendations', 'Summary', 'Conclusions', or 'Additional Notes'\n- Do NOT provide unsolicited advice or suggestions\n- Keep responses focused and minimal - answer only what is asked\n- Avoid verbose explanations unless specifically requested\n\n**CRITICAL: Accuracy and Source Requirements**\n- NEVER invent, assume, or hallucinate information that is not explicitly present in the provided documents\n- ONLY provide information that you can directly see and verify in the uploaded content\n- If information is not available in the document, clearly state \"This information is not available in the provided document\"\n- Do not make assumptions or fill in missing data with typical industry values\n\n**CRITICAL: Language Requirements**\n- ALWAYS respond in English only, regardless of the document's original language\n- If analyzing documents in other languages (Hindi, Spanish, French, Chinese, Arabic, etc.), translate all content and provide analysis in English\n- Maintain original numerical values and proper nouns but translate all descriptions, categories, and analysis text to English\n- When referencing non-English content, provide: \"[Original text] (English: [translation])\" format when helpful\n\n**CRITICAL: Page Reference Requirements**\n- When referencing page numbers, ALWAYS specify \"PDF page [number]\" for PDF documents\n- For other document types, use \"Document page [number]\"\n- NEVER use generic terms like \"page\" without specifying the document type\n- Page numbers must correspond to actual pages in the uploaded document\n- Do not reference pages that don't exist in the document\n\n**Document Type Identification**\n- When analyzing documents, first identify the company name from the document content\n- Then identify what type of report each document is based on its content:\n  - Annual Report (AR): Financial statements, annual performance, shareholder information\n  - Sustainability Report (SR): Environmental impact, social responsibility, governance practices\n  - ESG Report: Environmental, Social, and Governance metrics and performance\n- Clearly state the company name and document type at the beginning of your analysis for each document in the format: \"[Company Name] - [Document Type]\"\n\n**Core Analysis Guidelines:**\n- Respond in a clear, structured manner using Markdown formatting\n- When creating tables, use simple 3-column format: | Metric | Value | Pages |\n- Do NOT add Status columns or recommendation columns unless specifically requested\n- For data presentation, prefer tables over lists when applicable\n- Ensure table headers are clearly defined with | Header | format\n- Use alignment indicators when helpful\n- Provide accurate and comprehensive insights based ONLY on document content\n- Handle multilingual documents by translating content to English for analysis\n\n**CRITICAL: Duplicate Data Detection & Reporting**\n\nWhen analyzing documents, you MUST identify and report duplicate metrics/KPIs that appear multiple times:\n\n1. **For IDENTICAL values across multiple locations:**\n   - Report the metric once with all page references using proper format\n   - Format: \"Scope 1 Emissions: 500 MT (PDF pages: 15, 23, 45)\" or \"Scope 1 Emissions: 500 MT (Document pages: 15, 23, 45)\"\n\n2. **For DIFFERENT values of the same metric:**\n   - Report ALL instances with their respective page numbers\n   - Highlight the discrepancy clearly\n   - Format: \"⚠️ Scope 1 Emissions DISCREPANCY:\n     - 500 MT (PDF pages: 15, 23)\n     - 520 MT (PDF page: 45)\"\n\n3. **Always include:**\n   - Exact page numbers with proper document type specification\n   - Clear identification of discrepancies\n   - Both consistent and conflicting values\n   - All analysis and descriptions in English only\n   - ONLY information that is verifiable in the provided documents\n\n**Table Format for Metrics with Multiple References:**\n| Metric | Value | Pages |\n|--------|-------|-------|\n| Scope 1 Emissions | 500 MT | PDF pages: 15, 23 |\n| Scope 1 Emissions | 520 MT | PDF page: 45 |\n\n**Multilingual Document Handling:**\n- Accept documents in any language (Hindi, Spanish, French, Chinese, Arabic, Japanese, German, etc.)\n- Always provide analysis, summaries, and insights in English\n- Translate metric names, categories, and descriptions to English\n- Preserve original numerical values and units\n- Note the original document language for context when relevant\n- ONLY translate and report content that actually exists in the document\n\n**CRITICAL: Minimal Response Policy**\n- Answer ONLY what is asked in the prompt\n- Do not add sections like 'Recommendations for Environmental Data Validation'\n- Do not add 'Summary of Discrepancies and Recommendations'\n- Do not provide unsolicited analysis or suggestions\n- Keep responses clean and focused on the specific request\n\n**CRITICAL: No Hallucination Policy**\n- If a section, metric, or data point is missing, state this clearly\n- Do not provide \"typical\" or \"standard\" values when actual data is unavailable\n- Do not extrapolate or estimate missing information\n- When asked about information not in the document, respond: \"This specific information is not available in the provided document(s)\"\n\nThis ensures comprehensive data validation and transparency in reporting with consistent English output and absolute accuracy."
    }]
};

// State management
let messages = []; // Array of message objects {id, role, text}
let isLoading = false;
let loadingMessage = 'Analyst AI is typing...'; // Dynamic loading message
let uploadedFiles = []; // Array to store multiple files
let chatSession = null; // To hold the Gemini chat session
let promptPrefixes = []; // Initialize as empty array
let activePrefix = ''; // Removed localStorage for activePrefix

// Load prompt presets from files
async function loadPromptPresets() {
    try {
        // Don't load from localStorage anymore - only use default prompts from files
        // const savedPrompts = JSON.parse(localStorage.getItem('prompt_prefixes') || '[]');
        
        // Load default presets from the presets.json file
        const response = await fetch('./prompts/presets.json');
        const presetConfig = await response.json();
        
        // Load content for each preset
        const filePromises = presetConfig.presets.map(async (preset) => {
            try {
                const contentResponse = await fetch(`./prompts/${preset.file}`);
                if (!contentResponse.ok) {
                    console.error(`Failed to load prompt file ${preset.file}: ${contentResponse.status}`);
                    return null;
                }
                const content = await contentResponse.text();
                // Log the first 100 characters to verify content is loaded
                console.log(`Loaded prompt ${preset.name} with content (first 100 chars):`, content.substring(0, 100));
                return {
                    id: preset.id,
                    name: preset.name,
                    content: content,
                    description: preset.description,
                    isDefault: true, // Mark as default preset
                    createdAt: new Date().toISOString()
                };
            } catch (error) {
                console.error(`Error loading prompt file ${preset.file}:`, error);
                return null;
            }
        });
        
        const defaultPrompts = (await Promise.all(filePromises)).filter(prompt => prompt !== null);
        
        // Only use default prompts, ignore any user-created prompts from localStorage
        promptPrefixes = [...defaultPrompts];
        
        // We don't need to clear localStorage anymore since we're not using it for prompts
        // localStorage.removeItem('prompt_prefixes');
    } catch (error) {
        console.error('Error loading prompt presets:', error);
        // Fallback to ESG prompt if file loading fails
        promptPrefixes = [
            {
                id: 'esg-metrics-' + Date.now(),
                name: 'ESG Metrics Analysis',
                content: 'Analyze all ESG (Environmental, Social, Governance) metrics in this document. Focus on: Scope 1/2/3 emissions, water consumption, waste generation, energy usage, and social indicators. For any metric reported multiple times, provide all values with their specific PDF page references and identify any inconsistencies. ONLY report metrics that are explicitly mentioned in the document. Do not provide typical industry values or estimates for missing data. Provide analysis in English regardless of original document language. Also, identify the company name and what type of report this is (Annual Report, Sustainability Report, or ESG Report) and present it in the format: "[Company Name] - [Document Type]".',
                createdAt: new Date().toISOString()
            }
        ];
    }
}

// Initialize prompt prefixes
loadPromptPresets();

// Remove the old initializeDefaultPrompts function since we're loading from files

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
const addNewPromptButton = safeGetElement('add-new-prompt-button'); // New element

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
// Add keydown listener for Shift+Enter functionality
if (messageInput) {
    messageInput.addEventListener('keydown', function(event) {
        // If Shift+Enter is pressed, insert a new line instead of sending
        if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = this.value.substring(0, start) + '\n' + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + 1;
        }
        // If Enter is pressed without Shift, send the message
        else if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (chatForm) {
                chatForm.dispatchEvent(new Event('submit'));
            }
        }
    });
}
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
safeAddEventListener(addNewPromptButton, 'click', openNewPromptForm); // New event listener

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

// Remove the call to initializeDefaultPrompts since we're loading from files
// initializeDefaultPrompts();

// Initialize prompt prefix indicator
updateActivePrefixIndicator();

// Essential Functions

// Removed initializeDefaultPrompts function since we're loading from files now
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

function openNewPromptForm() {
    // Clear the form for a new prompt
    clearPrefixForm();
    
    // Remove any editing ID
    if (prefixForm) {
        delete prefixForm.dataset.editingId;
    }
    
    // Focus on the name field
    if (prefixNameInput) {
        prefixNameInput.focus();
    }
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
            // Only update user-created prompts, not default file-based ones
            if (!promptPrefixes[prefixIndex].isDefault) {
                promptPrefixes[prefixIndex] = {
                    ...promptPrefixes[prefixIndex],
                    name,
                    content
                };
            } else {
                // For default prompts, create a copy with a new ID
                const newPrefix = {
                    id: Date.now().toString(),
                    name: name || promptPrefixes[prefixIndex].name,
                    content,
                    createdAt: new Date().toISOString()
                };
                promptPrefixes.push(newPrefix);
            }
        }
        delete prefixForm.dataset.editingId;
    } else {
        // Create new prefix (stored only in memory)
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
        // Removed localStorage for activePrefix
    }
    
    // Don't save to localStorage anymore - only keep in memory
    // User prompts are only stored in memory during the session
    // To save permanently, user must download the prompt file
    
    // Update UI
    renderPrefixList();
    updateActivePrefixSelect();
    updateActivePrefixIndicator();
    clearPrefixForm();
    updateQuickPromptList();
    
    // Show success message
    alert('Prompt saved successfully! To save this prompt permanently, please download it using the download button next to the prompt.');
}

// Add function to download a prompt as a file
function downloadPromptAsFile(prefixId) {
    const prefix = promptPrefixes.find(p => p.id === prefixId);
    if (prefix) {
        // Create a Blob with the prompt content
        const blob = new Blob([prefix.content], { type: 'text/plain' });
        
        // Create a download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${prefix.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_prompt.txt`;
        
        // Trigger the download
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
}

// Make download function globally available
window.downloadPromptAsFile = downloadPromptAsFile;

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
        if (prefixContentInput) {
            prefixContentInput.value = prefix.content;
            // Log the first 100 characters of the content being set
            console.log(`Setting content for ${prefix.name} (first 100 chars):`, prefix.content.substring(0, 100));
        }
        if (prefixForm) prefixForm.dataset.editingId = prefixId;
        if (autoApplyPrefixCheckbox) autoApplyPrefixCheckbox.checked = activePrefix === prefixId;
        
        // For default prompts, we should indicate that editing creates a copy
        if (prefix.isDefault) {
            if (prefixNameInput) prefixNameInput.value = `${prefix.name} (Copy)`;
        }
        
        // Ensure the modal is visible
        if (promptPrefixModal && promptPrefixModal.classList.contains('hidden')) {
            promptPrefixModal.classList.remove('hidden');
        }
    }
}

function deletePrefix(prefixId) {
    const prefixToDelete = promptPrefixes.find(p => p.id === prefixId);
    
    // Allow deletion of both default and user-created prompts
    // For default prompts, this just removes them from the current session
    if (prefixToDelete) {
        promptPrefixes = promptPrefixes.filter(p => p.id !== prefixId);
        
        // Clear active prefix if it was deleted
        if (activePrefix === prefixId) {
            activePrefix = '';
            // Removed localStorage for activePrefix
        }
        
        // Don't save to localStorage anymore - only keep in memory
        // const userPrompts = promptPrefixes.filter(p => !p.isDefault);
        // localStorage.setItem('prompt_prefixes', JSON.stringify(userPrompts));
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
        prefixList.innerHTML = '<p class="text-gray-500 text-sm italic">No prefixes saved yet.</p>';
        return;
    }
    
    promptPrefixes.forEach(prefix => {
        const prefixElement = document.createElement('div');
        prefixElement.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200';
        
        // Add visual indicator for default prompts
        const nameDisplay = prefix.isDefault ? 
            `${prefix.name} <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded ml-2">Default</span>` : 
            prefix.name;
        
        const actionButtons = prefix.isDefault ? 
            `
            <button onclick="editPrefix('${prefix.id}')" class="text-blue-600 hover:text-blue-800 p-1" title="Create a copy to edit">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                </svg>
            </button>
            <button onclick="setActivePrefixById('${prefix.id}')" class="text-green-600 hover:text-green-800 p-1" title="Set as active">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            </button>
            ` : 
            `
            <button onclick="downloadPromptAsFile('${prefix.id}')" class="text-indigo-600 hover:text-indigo-800 p-1" title="Download as file">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
            </button>
            <button onclick="editPrefix('${prefix.id}')" class="text-blue-600 hover:text-blue-800 p-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
            </button>
            <button onclick="setActivePrefixById('${prefix.id}')" class="text-green-600 hover:text-green-800 p-1" title="Set as active">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            </button>
            <button onclick="deletePrefix('${prefix.id}')" class="text-red-600 hover:text-red-800 p-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd" />
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
            </button>
            `;
        
        prefixElement.innerHTML = `
            <div class="flex-1">
                <h4 class="font-semibold text-gray-900">${nameDisplay}</h4>
                <p class="text-sm text-gray-700 truncate" style="max-width: 300px;">${escapeHtml(prefix.content)}</p>
            </div>
            <div class="flex items-center space-x-2">
                ${actionButtons}
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
    // Removed localStorage for activePrefix
    updateActivePrefixIndicator();
    updateQuickPromptList();
}

function setActivePrefixById(prefixId) {
    activePrefix = prefixId;
    // Removed localStorage for activePrefix
    updateActivePrefixSelect();
    updateActivePrefixIndicator();
    updateQuickPromptList();
}

function removeActivePrefix() {
    activePrefix = '';
    // Removed localStorage for activePrefix
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
        noneButton.className = 'w-full text-left px-3 py-2 hover:bg-gray-100 text-sm text-gray-700';
        noneButton.setAttribute('data-prefix-id', '');
        noneButton.innerHTML = `
            <span class="font-semibold">None</span>
            <p class="text-xs text-gray-500">No prefix applied</p>
        `;
        noneButton.addEventListener('click', () => selectQuickPrefix(''));
        quickPromptList.appendChild(noneButton);
    }
    
    // Add current prefixes
    promptPrefixes.forEach(prefix => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `w-full text-left px-3 py-2 hover:bg-gray-100 text-sm ${
            activePrefix === prefix.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700'
        }`;
        button.setAttribute('data-prefix-id', prefix.id);
        
        const truncatedContent = prefix.content.length > 60 ? 
            prefix.content.substring(0, 60) + '...' : 
            prefix.content;
            
        // Add visual indicator for default prompts
        const nameDisplay = prefix.isDefault ? 
            `${prefix.name} (Default)` : 
            prefix.name;
            
        button.innerHTML = `
            <span class="font-semibold">${escapeHtml(nameDisplay)}</span>
            <p class="text-xs text-gray-500">${escapeHtml(truncatedContent)}</p>
        `;
        
        button.addEventListener('click', () => selectQuickPrefix(prefix.id));
        quickPromptList.appendChild(button);
    });
}

function selectQuickPrefix(prefixId) {
    activePrefix = prefixId;
    // Removed localStorage for activePrefix
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
    
    // Save to localStorage (keeping this as requested)
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
    const validTypes = ['.pdf', '.docx', '.txt', '.html', '.htm', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
    
    if (validTypes.includes(fileExtension.toLowerCase())) {
        // Check if file already exists
        const existingFileIndex = uploadedFiles.findIndex(f => f.name === file.name && f.size === f.size);
        if (existingFileIndex === -1) {
            uploadedFiles.push(file);
        }
        render();
    } else {
        alert('Please upload PDF, DOCX, TXT, HTML, HTM, or image files (JPG, PNG, GIF, BMP, TIFF) only.');
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
        fileItem.className = 'flex items-center justify-between py-1 px-2 bg-white rounded text-sm border border-gray-200';
        
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const fileInfo = `${file.name} (${fileSizeMB}MB)`;
        
        fileItem.innerHTML = `
            <span class="truncate flex-1 mr-2 text-gray-900" title="${file.name}">${fileInfo}</span>
            <button class="text-red-600 hover:text-red-800 p-1" onclick="removeFile(${index})" title="Remove file">
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
        
        // Add text with instruction to identify report types
        if (finalMessage) {
            let enhancedMessage = finalMessage;
            if (uploadedFiles.length > 0) {
                enhancedMessage += "\n\nBefore analyzing the content, please identify the company name and what type of report each document is based on its content (Annual Report, Sustainability Report, or ESG Report) and mention this in your response in the format: \"[Company Name] - [Document Type]\".";
            }
            contentParts.push({ text: enhancedMessage });
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
            // Keep API key in localStorage as requested
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
        
        const messageWrapper = document.createElement('div');
        messageWrapper.className = 'relative';
        
        const messageContent = document.createElement('div');
        messageContent.className = message.role === 'user' ? 
            'max-w-3xl bg-indigo-600 text-white p-3 rounded-lg' : 
            'max-w-7xl bg-white text-gray-900 p-3 rounded-lg markdown-content border border-gray-200'; // Increased from max-w-6xl to max-w-7xl
        
        if (message.role === 'model') {
            // Use marked to parse the markdown
            try {
                // Sanitize and parse markdown content
                const sanitizedText = message.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                messageContent.innerHTML = marked.parse(message.text);
            } catch (parseError) {
                console.error('Markdown parsing error:', parseError);
                // Fallback to plain text if markdown parsing fails
                messageContent.textContent = message.text;
            }
            
            // Add copy button for the entire response
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity';
            
            // Copy button for entire response
            const copyButton = document.createElement('button');
            copyButton.className = 'p-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600';
            copyButton.title = 'Copy entire response';
            copyButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
            `;
            copyButton.addEventListener('click', function(e) {
                e.stopPropagation();
                copyToClipboard(message.text);
            });
            
            buttonContainer.appendChild(copyButton);
            messageWrapper.appendChild(buttonContainer);
        } else {
            messageContent.textContent = message.text;
        }
        
        // Ensure proper rendering of table content and add copy buttons to tables
        messageContent.querySelectorAll('table').forEach((table, index) => {
            table.classList.add('markdown-content-table');
            
            // Create a container for the table with relative positioning
            const tableContainer = document.createElement('div');
            tableContainer.className = 'relative group/table';
            tableContainer.style.cssText = 'margin: 1rem 0;';
            
            // Move the table into the container
            table.parentNode.insertBefore(tableContainer, table);
            tableContainer.appendChild(table);
            
            // Add copy button for the table
            const tableButtonContainer = document.createElement('div');
            tableButtonContainer.className = 'absolute top-2 right-2 flex space-x-1 opacity-0 group-hover/table:opacity-100 transition-opacity';
            
            const tableCopyButton = document.createElement('button');
            tableCopyButton.className = 'p-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600';
            tableCopyButton.title = 'Copy table';
            tableCopyButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
            `;
            
            tableCopyButton.addEventListener('click', function(e) {
                e.stopPropagation();
                // Convert table to markdown format for copying
                const tableMarkdown = convertTableToMarkdown(table);
                copyToClipboard(tableMarkdown);
            });
            
            tableButtonContainer.appendChild(tableCopyButton);
            tableContainer.appendChild(tableButtonContainer);
        });
        
        messageWrapper.appendChild(messageContent);
        messageWrapper.classList.add('group'); // For hover effects
        messageDiv.appendChild(messageWrapper);
        chatContainer.appendChild(messageDiv);
    });
    
    // Add loading indicator if we're loading
    if (isLoading) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'flex justify-start';
        
        const loadingContent = document.createElement('div');
        loadingContent.className = 'max-w-7xl bg-white text-gray-900 p-3 rounded-lg flex items-center space-x-2 border border-gray-200'; // Changed from max-w-6xl to max-w-7xl
        
        loadingContent.innerHTML = `
            <div class="flex space-x-1">
                <div class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                <div class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style="animation-delay: 0.1s;"></div>
                <div class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style="animation-delay: 0.2s;"></div>
            </div>
            <span class="text-gray-700">${loadingMessage}</span>
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
    
    // Scroll to bottom with a delay to ensure content is rendered
    if (chatContainer) {
        // Only scroll to bottom if user is near the bottom already
        const isNearBottom = chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - 100;
        
        // Use a small delay to ensure content is rendered before scrolling
        setTimeout(() => {
            if (isNearBottom) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }, 10);
    }
}

// Make removeFile function globally available
window.removeFile = removeFile;

/**
 * Copy text to clipboard
 */
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('Text copied to clipboard');
            // Show visual feedback
            showToast('Copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            // Fallback method
            fallbackCopyTextToClipboard(text);
        });
    } else {
        // Fallback for older browsers
        fallbackCopyTextToClipboard(text);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            console.log('Text copied to clipboard');
            showToast('Copied to clipboard!');
        } else {
            console.error('Failed to copy text');
            showToast('Failed to copy to clipboard', 'error');
        }
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        showToast('Failed to copy to clipboard', 'error');
    }
    
    document.body.removeChild(textArea);
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    // Remove any existing toast
    const existingToast = document.getElementById('toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = `fixed top-4 right-4 px-4 py-2 rounded-md shadow-lg z-50 text-white ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`;
    toast.textContent = message;
    
    // Add to document
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

/**
 * Convert HTML table to markdown format
 */
function convertTableToMarkdown(tableElement) {
    let markdown = '';
    const rows = tableElement.querySelectorAll('tr');
    
    if (rows.length === 0) return '';
    
    // Process header row
    const headerCells = rows[0].querySelectorAll('th, td');
    const headers = Array.from(headerCells).map(cell => cell.textContent.trim());
    
    // Create header row
    markdown += '| ' + headers.join(' | ') + ' |\n';
    
    // Create separator row
    markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    
    // Process data rows
    for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td');
        const cellData = Array.from(cells).map(cell => cell.textContent.trim());
        markdown += '| ' + cellData.join(' | ') + ' |\n';
    }
    
    return markdown;
}

// Make functions globally available
window.copyToClipboard = copyToClipboard;
window.showToast = showToast;
window.convertTableToMarkdown = convertTableToMarkdown;

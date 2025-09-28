# Prompt Templates

This directory contains the default prompt templates used by Analyst AI.

## Files

- `presets.json` - Configuration file that defines the available prompt presets
- `esg_metrics_prompt.txt` - Prompt for ESG metrics analysis (currently the only default prompt)

## How It Works

1. The application loads only the default prompt from these files at startup
2. User-created prompts are kept in memory only during the session (no localStorage)
3. Default prompts cannot be deleted but can be copied and modified
4. User-created prompts can be downloaded as files using the download button

## Managing Prompts

### Using Default Prompts
- The default ESG prompt is loaded automatically when the application starts
- It is marked with a "Default" badge in the UI
- You cannot delete the default prompt, but you can create copies to modify

### Creating New Prompts
1. Click the "Add New Prompt" button in the prompt management modal
2. Enter a name and content for your prompt
3. Save the prompt (it will be stored in memory for the current session only)
4. To save the prompt permanently, click the download button next to the prompt

### Adding New Default Prompts
1. Create a new `.txt` file with your prompt content
2. Add an entry to `presets.json` with:
   - `id`: A unique identifier
   - `name`: Display name for the prompt
   - `file`: The filename of your prompt content
   - `description`: Brief description of what the prompt does

Example:
```json
{
  "id": "custom-prompt-1",
  "name": "Custom Analysis",
  "file": "custom_prompt.txt",
  "description": "Performs custom analysis on documents"
}
```
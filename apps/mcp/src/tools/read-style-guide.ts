import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function readStyleGuideHandler() {
  try {
    const templatePath = path.join(
      __dirname,
      '../../templates/review-style-guide.md'
    );
    const styleGuide = fs.readFileSync(templatePath, 'utf-8');

    return {
      content: [
        {
          type: 'text',
          text: styleGuide,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error reading style guide: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}

export const readStyleGuideTool = {
  schema: {
    name: 'read_style_guide',
    description: `Returns the comprehensive PR review style guide with detailed examples and formatting rules.

This style guide MUST be followed when writing reviews. It includes:
- Required section structure with emoji markers (📋 🔍 ✨ 🐛 🎯 💡 📝 ✅ 👏)
- Formatting standards for file references, code examples, and status indicators
- Tone guidelines for constructive feedback
- Complete examples of good and bad review patterns

IMPORTANT: Always read this style guide before writing a review to ensure consistency. The style guide provides more detailed examples and explanations than the write_review tool description.`,
    inputSchema: {
      type: 'object',
      properties: {
        authToken: {
          type: 'string',
          description: 'MCP auth token',
        },
      },
      required: ['authToken'],
    },
  },
  handler: readStyleGuideHandler,
};

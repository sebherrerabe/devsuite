import fs from 'fs';
import path from 'path';
import { WriteReviewInputSchema } from '../schemas/index.js';
import {
  sanitizePath,
  DEFAULT_ALLOWED_ROOT,
} from '../services/path-sanitizer.js';

export async function writeReviewHandler(request: { params: unknown }) {
  const args = WriteReviewInputSchema.parse(request.params);
  const { reviewPath, content } = args;

  try {
    const sanitizedPath = sanitizePath(reviewPath, DEFAULT_ALLOWED_ROOT);

    if (!fs.existsSync(sanitizedPath)) {
      throw new Error(`Bundle directory does not exist: ${sanitizedPath}`);
    }

    const stats = fs.statSync(sanitizedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${sanitizedPath}`);
    }

    const metaJsonPath = path.join(sanitizedPath, 'meta.json');
    if (!fs.existsSync(metaJsonPath)) {
      throw new Error(
        `Directory does not appear to be a valid PR bundle (missing meta.json): ${sanitizedPath}`
      );
    }

    const reviewMdPath = path.join(sanitizedPath, 'review.md');
    fs.writeFileSync(reviewMdPath, content, 'utf-8');

    const result = {
      success: true,
      message: 'Review written successfully',
      reviewPath: reviewMdPath,
      bundlePath: sanitizedPath,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorResult = {
      success: false,
      error: errorMessage,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResult, null, 2),
        },
      ],
      isError: true,
    };
  }
}

export const writeReviewTool = {
  schema: {
    name: 'write_review',
    description: `Writes a review.md file to an existing PR bundle directory. The path must be within the allowed root (~/.private/pr-reviews/).

MANDATORY REVIEW STRUCTURE - MUST BE FOLLOWED EXACTLY:

# PR Review: {title}

## 📋 Summary
- Brief 2-3 sentence overview of PR scope and main changes
- **Status**: ✅ Approved | ⚠️ Approved with suggestions | ❌ Needs changes

---

## ✨ Strengths
List 3-6 positive aspects found in the PR:
1. **Well-structured X**: Clear explanation
2. **Good Y considerations**: Detailed reasoning
   - Sub-points with specifics
   - More sub-points if needed

---

## 🔍 Detailed Review

### New Files
For each new file:
#### \`path/to/File.tsx\` ✅/⚠️/❌
**Lines X-Y**: Description of what the code does and its purpose

**Suggestions** (if any):
- Specific, actionable feedback with code examples

### Modified Files
Same structure as new files - always include file path, line numbers, and specific observations

---

## 🐛 Potential Issues (if any)
Numbered list of specific concerns:
1. **Issue Title**: Clear description with file reference and line numbers
   - Impact explanation
   - Suggested fix with code example if possible

---

## 🎯 Testing Recommendations
1. **Functional Testing**:
   - ✅ Specific test scenario
   - ✅ Another test case

2. **Integration Testing**:
   - Test scenario description

3. **Edge Cases**:
   - Edge case to verify

---

## 💡 Suggestions for Future Improvements (optional)
1. **Category**: Non-blocking suggestion for enhancement
2. **Another area**: Future improvement idea

---

## 📝 TODO Comments Review (if applicable)
List any TODO/FIXME comments found in the PR code and assess whether they should block merge.

---

## ✅ Approval Status
**[APPROVED ✅ | APPROVED WITH SUGGESTIONS ⚠️ | NEEDS CHANGES ❌]**

Provide clear reasoning for the decision.

### Required Before Merge:
- [ ] Blocking item 1 (if any)

### Recommended Before Merge:
- [ ] Nice-to-have item 1 (if any)

---

## 👏 {Closing Note}
Brief, constructive, positive statement acknowledging the work.

CRITICAL FORMATTING RULES:
- ✅ ALWAYS use emoji section markers: 📋 🔍 ✨ 🐛 🎯 💡 📝 ✅ 👏
- ✅ ALWAYS use horizontal rules (---) between major sections
- ✅ ALWAYS be specific: include file paths with backticks, line numbers, and function names
- ✅ ALWAYS use **bold** for emphasis on key terms
- ✅ ALWAYS include status indicators (✅ ⚠️ ❌) where appropriate
- ✅ ALWAYS provide code examples in fenced blocks with language tags when suggesting changes
- ✅ ALWAYS reference exact locations: "\`src/utils/api.ts\` lines 45-67"
- ✅ ALWAYS maintain constructive, helpful tone
- ❌ NEVER write generic observations without file/line references
- ❌ NEVER skip emoji markers or horizontal rules
- ❌ NEVER provide vague suggestions like "consider improving" without specifics`,
    inputSchema: {
      type: 'object',
      properties: {
        authToken: {
          type: 'string',
          description: 'MCP auth token',
        },
        reviewPath: {
          type: 'string',
          description: 'Path to PR bundle directory (must contain meta.json)',
        },
        content: {
          type: 'string',
          description:
            'Markdown content for review.md following the MANDATORY structure defined in the tool description above',
        },
      },
      required: ['authToken', 'reviewPath', 'content'],
    },
  },
  handler: writeReviewHandler,
};

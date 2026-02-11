# PR Review Style Guide

This style guide MUST be followed for all PR reviews. This ensures consistency, readability, and actionable feedback.

## Required Structure

Every review must include these sections **in this exact order**:

### 1. Title & Summary

```markdown
# PR Review: {PR Title}

## 📋 Summary

- 2-3 sentences describing the scope and main changes
- Focus on WHAT changed and WHY

**Status**: ✅ Approved | ⚠️ Approved with suggestions | ❌ Needs changes

---
```

**Rules**:

- Always include the 📋 emoji
- Be concise but informative
- Include a clear status indicator
- End section with `---` horizontal rule

### 2. Strengths Section

```markdown
## ✨ Strengths

1. **Well-structured component design**: The `ExportLinksModal` component follows existing modal patterns
2. **Good UX considerations**:
   - Loading states handled with `LoadingContent`
   - Empty state handling with disabled copy button
   - Success notification on clipboard copy
3. **Performance optimization**: The `enabled` flag prevents unnecessary API calls

---
```

**Rules**:

- Always include the ✨ emoji
- List 3-6 positive aspects
- Use **bold** for the main point of each strength
- Include specific examples and file/component names
- Use sub-bullets to add detail
- End with `---`

### 3. Detailed Review

```markdown
## 🔍 Detailed Review

### New Files

#### `platform-lca/react/modules/ExportLinksModal.tsx` ✅

**Lines 228-310**: Well-implemented modal component with good state management and error handling.

**Suggestions**:

- Consider extracting the toggle configuration to avoid duplication (as noted in TODO comment)
- The `tsvValue` null check on line 266 is good for empty state handling

#### `platform-lca/react/hooks/useExportLinksTsv.ts` ⚠️

**Lines 117-177**: Clean custom hook implementation with proper query key generation.

**Issues**:

- The `staleTime: 0` might cause unnecessary refetches - consider if a longer stale time would be appropriate

**Suggestion**:
\`\`\`typescript
// Consider adjusting stale time for better performance
const query = useQuery({
queryKey: exportLinksTsvQueryKey,
queryFn: fetchExportLinksTsv,
enabled: isOpen,
staleTime: 5000, // 5 seconds instead of 0
});
\`\`\`

### Modified Files

#### `platform-lca/react/components/PreviewTable.tsx` ✅

**Lines 1-27**: Adding `className` prop is a clean solution for styling flexibility.

**Note**: Ensure consistent formatting in the destructured parameters.

---
```

**Rules**:

- Always include the 🔍 emoji
- Separate "New Files" and "Modified Files" subsections
- For each file:
  - Use backticks for file paths: `` `path/to/file.tsx` ``
  - Include status indicator: ✅ ⚠️ or ❌
  - **Always specify line numbers**: `**Lines X-Y**:`
  - Describe what the code does
  - Include **Suggestions**, **Issues**, or **Notes** subsections as needed
  - Provide code examples for suggested improvements
  - Use proper syntax highlighting in code blocks (`typescript, `python, etc.)
- End with `---`

### 4. Potential Issues (Optional but Recommended)

```markdown
## 🐛 Potential Issues

1. **Mock Data Implementation**:
   - **File**: `src/actions.ts` lines 90-93
   - **Issue**: Currently using mock data instead of real API endpoint
   - **Impact**: Feature works for demo but needs backend before production
   - **Suggested Fix**: Track backend implementation ticket and replace mock

2. **Type Safety Concern**:
   - **File**: `src/types.ts` line 45
   - **Issue**: `ExportMode` type should match backend API exactly
   - **Impact**: Runtime errors if backend uses different values
   - **Suggested Fix**:
     \`\`\`typescript
     // Add validation
     const VALID_EXPORT_MODES = ['MODULE', 'FLOW'] as const;
     type ExportMode = typeof VALID_EXPORT_MODES[number];
     \`\`\`

---
```

**Rules**:

- Always include the 🐛 emoji
- Use numbered list for each issue
- For each issue, include:
  - **Bold title** describing the issue
  - **File** reference with line numbers
  - **Issue** description
  - **Impact** assessment
  - **Suggested Fix** with code example when possible
- Be specific and actionable
- End with `---`

### 5. Testing Recommendations

```markdown
## 🎯 Testing Recommendations

1. **Functional Testing**:
   - ✅ Verify export modal opens when clicking the export button
   - ✅ Test toggling between MODULE and FLOW export modes
   - ✅ Confirm TSV data displays correctly in the preview table
   - ✅ Test copy to clipboard functionality
   - ✅ Verify loading states during data fetching
   - ✅ Test behavior when no data is available

2. **Integration Testing**:
   - ⚠️ Once backend is implemented, test with real API endpoints
   - ✅ Verify modal closes properly and state resets
   - ✅ Test with different node types and module configurations

3. **Edge Cases**:
   - Test with missing/invalid moduleId or nodeId
   - Test with large TSV datasets
   - Test clipboard copy in different browsers

---
```

**Rules**:

- Always include the 🎯 emoji
- Organize into categories: Functional, Integration, Edge Cases, Performance, etc.
- Use checkboxes with ✅ (ready to test) or ⚠️ (needs setup/attention)
- Be specific about what to test
- End with `---`

### 6. Suggestions for Future Improvements (Optional)

```markdown
## 💡 Suggestions for Future Improvements

1. **Code Reusability**:
   - Extract toggle configuration into a shared constant
   - Consider creating a generic export modal for other scenarios

2. **Accessibility**:
   - Ensure keyboard navigation works properly in the modal
   - Add aria-labels for screen readers

3. **Performance**:
   - Consider debouncing if export queries become expensive
   - Cache TSV results with appropriate `staleTime`

4. **User Experience**:
   - Add a download button in addition to copy to clipboard
   - Show row count in the UI
   - Consider adding export format options (CSV, JSON, etc.)

---
```

**Rules**:

- Always include the 💡 emoji
- Organize by category (Code Reusability, Accessibility, Performance, UX, etc.)
- These are non-blocking suggestions for enhancement
- Keep them constructive and forward-thinking
- End with `---`

### 7. TODO Comments Review (If Applicable)

```markdown
## 📝 TODO Comments Review

The PR includes several TODO comments that should be tracked:

1. **Line 35 (`nodeTypes.ts`)**: Rename LINK_TYPE correctly - clarify naming between link types
   - **Priority**: Medium - should be addressed in follow-up PR
2. **Line 42 (`nodeTypes.ts`)**: Reuse LINK_TO_TYPE in multi-import modal and clean up duplicate code
   - **Priority**: Low - technical debt, not blocking
3. **Line 90 (`actions.ts`)**: Replace mock with real TSV export endpoint
   - **Priority**: High - required before production release

**Recommendation**: Create follow-up tickets for items 1 and 2.

---
```

**Rules**:

- Always include the 📝 emoji
- List each TODO with file reference and line number
- Assess priority (High/Medium/Low)
- Provide recommendations on timing
- End with `---`

### 8. Approval Status

```markdown
## ✅ Approval Status

**APPROVED WITH SUGGESTIONS ⚠️**

This PR successfully implements the export modal feature with good code quality and follows existing patterns. The mock implementation is acceptable for initial release as long as there's a clear plan to replace it with the real backend implementation.

### Required Before Merge:

- [ ] Ensure there's a ticket for implementing the real backend TSV export endpoint
- [ ] Create follow-up tickets for the TODO items mentioned in the code

### Recommended Before Merge:

- [ ] Add error handling/display in the ExportLinksModal
- [ ] Fix indentation in PreviewTable.tsx (line 17)
- [ ] Manual testing of the complete user flow

---
```

**Rules**:

- Always include the ✅ emoji
- State clear decision: **APPROVED ✅** | **APPROVED WITH SUGGESTIONS ⚠️** | **NEEDS CHANGES ❌**
- Provide reasoning for the decision (1-2 sentences)
- Separate "Required Before Merge" (blockers) from "Recommended Before Merge" (nice-to-haves)
- Use checkbox format `- [ ]` for action items
- End with `---`

### 9. Closing Note

```markdown
## 👏 Great Work!

Overall, this is a well-implemented feature that adds valuable functionality to the platform. The code is clean, follows existing patterns, and includes proper loading states and user feedback. Nice job, {Author Name}!
```

**Rules**:

- Always include the 👏 emoji
- Keep it brief (1-3 sentences)
- Be genuine and constructive
- Acknowledge the effort and highlight key strengths
- Personalize with author name when appropriate
- NO `---` at the end (it's the last section)

## Formatting Standards

### Emoji Usage

- **Required section emojis**: 📋 🔍 ✨ 🐛 🎯 💡 📝 ✅ 👏
- **Status indicators**: ✅ (good/approved) ⚠️ (warning/needs attention) ❌ (error/needs changes)

### Text Formatting

- **Bold**: Use for key terms, file names in running text, section headings
  - Example: "The **ExportLinksModal** component follows existing patterns"
- **Backticks**: Use for file paths, function names, variable names, inline code
  - Example: `` `src/components/Button.tsx` ``
- **Code blocks**: Always use fenced code blocks with language tags
  - Example: `typescript ... `

### Section Separators

- **Horizontal rules**: Use `---` between ALL major sections
- **Blank lines**: One blank line after horizontal rules

### File References

Always include:

1. **Full file path** in backticks
2. **Line numbers** when discussing specific code: `**Lines 45-67**:`
3. **Status indicator** (✅ ⚠️ ❌)

Example: ``#### `src/utils/validator.ts` ⚠️``

### Code Examples

When suggesting changes, always provide concrete code examples:

```markdown
**Suggested improvement**:
\`\`\`typescript
// Before (problematic)
const data = fetchData();

// After (improved)
const data = await fetchData();
if (!data) {
throw new Error('Failed to fetch data');
}
\`\`\`
```

## Tone Guidelines

### DO ✅

- Be specific and actionable
- Provide constructive feedback
- Acknowledge good work
- Explain the "why" behind suggestions
- Use concrete examples
- Reference exact locations in code
- Offer solutions, not just criticisms

### DON'T ❌

- Be vague ("this could be better")
- Only point out problems without acknowledging strengths
- Make suggestions without explaining benefits
- Use generic observations without file references
- Be overly critical or dismissive

## Example Checklist

Before submitting a review, verify:

- [ ] All required sections are present in order
- [ ] All section emojis are included (📋 🔍 ✨ 🐛 🎯 💡 📝 ✅ 👏)
- [ ] Horizontal rules `---` separate major sections
- [ ] File paths are in backticks with status indicators
- [ ] Line numbers are specified for all code references
- [ ] Status indicators (✅ ⚠️ ❌) are used appropriately
- [ ] Code suggestions include examples with syntax highlighting
- [ ] Tone is constructive and helpful
- [ ] Approval status is clear with actionable items
- [ ] Closing note is genuine and positive

## Anti-Patterns to Avoid

### ❌ BAD Example:

```markdown
## Summary

This PR adds export functionality. Looks good overall.

## Issues

- The code could be better
- Consider improving error handling
- Some files need work
```

**Problems**:

- No emoji markers
- Vague observations
- No file/line references
- No code examples
- Missing required sections

### ✅ GOOD Example:

```markdown
## 📋 Summary

This PR introduces export functionality for modules and flows in the node tab, adding a modal with TSV export capabilities and clipboard integration.

**Status**: ⚠️ Approved with suggestions

---

## 🐛 Potential Issues

1. **Missing Error Boundary**:
   - **File**: `src/components/ExportModal.tsx` lines 45-67
   - **Issue**: No error handling for failed clipboard operations
   - **Impact**: Users won't see feedback if copy fails
   - **Suggested Fix**:
     \`\`\`typescript
     try {
     await navigator.clipboard.writeText(tsvData);
     showSuccessNotification('Copied to clipboard');
     } catch (error) {
     showErrorNotification('Failed to copy. Please try again.');
     }
     \`\`\`
```

**Why it's good**:

- Uses required emoji markers
- Specific file and line references
- Clear impact assessment
- Actionable code example
- Constructive tone

---

## Quick Reference

**Section Order**:

1. 📋 Summary
2. ✨ Strengths
3. 🔍 Detailed Review (New Files, Modified Files)
4. 🐛 Potential Issues
5. 🎯 Testing Recommendations
6. 💡 Suggestions for Future Improvements
7. 📝 TODO Comments Review
8. ✅ Approval Status
9. 👏 Closing Note

**Remember**: Specificity, actionability, and constructiveness are key!

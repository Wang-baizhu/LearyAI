export const mergeGeneratePromptVars = (
  promptVars?: Record<string, string>,
  customPrompt?: string
): Record<string, string> | undefined => {
  const mergedPromptVars = {
    ...(promptVars ?? {}),
    CUSTOM_PROMPT: customPrompt?.trim() ?? '',
  };
  return Object.keys(mergedPromptVars).length > 0 ? mergedPromptVars : undefined;
};

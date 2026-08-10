export const ASK_USER_PARAMETER_DESCRIPTIONS = {
  optionLabel: "Short display label for this option",
  optionDescription: "Optional one-line description shown below the label",
  question: "The question to ask the user",
  options:
    "Between 1 and 8 answer options. A free-form custom answer option is always added automatically.",
};

export const ASK_USER_TOOL_DESCRIPTION =
  "Ask the user a single multiple-choice question (1-8 options). A free-form custom answer option is always added automatically, and the user may dismiss the question without answering. Ask exactly one question per call.";

export const ASK_USER_PROMPT_SNIPPET =
  "Ask the user a multiple-choice question (1-8 options plus a custom answer)";

export const ASK_USER_PROMPT_GUIDELINES = [
  "Use ask_user only for one necessary clarification at a time.",
  "Use tools for facts that can be discovered instead of asking the user.",
];

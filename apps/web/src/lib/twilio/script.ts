/**
 * Land seller qualify script — keypad answers for live Twilio + sandbox UI.
 * Adapted from solar residential script to ownership / plot / planning / price.
 */

export type ScriptStepId =
  | "intro"
  | "interested"
  | "owner"
  | "plot_ok"
  | "planning"
  | "price_ok"
  | "follow_up"
  | "done";

export interface ScriptStep {
  id: ScriptStepId;
  prompt: string;
  /** Keypad: 1 = yes / favourable, 2 = no / unfavourable (where binary). */
  options?: Array<{ digit: string; label: string; value: string }>;
}

export const LAND_CALL_SCRIPT: ScriptStep[] = [
  {
    id: "intro",
    prompt:
      "Hello — this is Flipping Homes UK calling about the land enquiry you submitted. This call is recorded. Press 1 to continue, or hang up if you prefer not to speak now.",
    options: [
      { digit: "1", label: "Continue", value: "continue" },
      { digit: "2", label: "Callback later", value: "callback" },
    ],
  },
  {
    id: "interested",
    prompt:
      "Are you still interested in discussing a possible sale or option on the land? Press 1 for yes, 2 for no.",
    options: [
      { digit: "1", label: "Yes", value: "yes" },
      { digit: "2", label: "No", value: "no" },
    ],
  },
  {
    id: "owner",
    prompt:
      "Are you the freeholder or otherwise able to sell or grant an option? Press 1 for yes, 2 for no, 3 if you are unsure.",
    options: [
      { digit: "1", label: "Yes — owner / control", value: "yes" },
      { digit: "2", label: "No", value: "no" },
      { digit: "3", label: "Unsure", value: "unsure" },
    ],
  },
  {
    id: "plot_ok",
    prompt:
      "Is the plot roughly as described on the form, and free of major access or title issues you know about? Press 1 for yes, 2 for no, 3 if unsure.",
    options: [
      { digit: "1", label: "Yes", value: "yes" },
      { digit: "2", label: "No / major issues", value: "no" },
      { digit: "3", label: "Unsure", value: "unsure" },
    ],
  },
  {
    id: "planning",
    prompt:
      "What is the planning position? Press 1 for none or pre-app only, 2 for outline or full permission, 3 if unsure.",
    options: [
      { digit: "1", label: "None / pre-app", value: "none_or_pre" },
      { digit: "2", label: "Outline / full", value: "permission" },
      { digit: "3", label: "Unsure", value: "unsure" },
    ],
  },
  {
    id: "price_ok",
    prompt:
      "Are your price expectations flexible enough for a cash or option conversation? Press 1 for yes, 2 if you need top market price only, 3 if unsure.",
    options: [
      { digit: "1", label: "Flexible / open", value: "yes" },
      { digit: "2", label: "Top price only", value: "no" },
      { digit: "3", label: "Unsure", value: "unsure" },
    ],
  },
  {
    id: "follow_up",
    prompt:
      "Are you happy for our team to follow up by phone about this enquiry? Press 1 for yes, 2 for no.",
    options: [
      { digit: "1", label: "Yes", value: "yes" },
      { digit: "2", label: "No", value: "no" },
    ],
  },
  {
    id: "done",
    prompt:
      "Thank you. We will review your answers and be in touch if there is a fit. Goodbye.",
  },
];

export type CallAnswers = Record<string, string>;

export type CallOutcomeValue =
  | "QUALIFIED"
  | "UNQUALIFIED"
  | "NO_ANSWER"
  | "CALLBACK";

/**
 * Sandbox / live qualify rules for land:
 * Must: still interested, owner (yes), plot OK, follow-up OK.
 * Price "top only" or owner no → UNQUALIFIED.
 */
export function evaluateCallOutcome(answers: CallAnswers): CallOutcomeValue {
  if (answers.intro === "callback") return "CALLBACK";
  if (answers.interested !== "yes") return "UNQUALIFIED";
  if (answers.owner === "no") return "UNQUALIFIED";
  if (answers.owner !== "yes") return "UNQUALIFIED";
  if (answers.plot_ok === "no") return "UNQUALIFIED";
  if (answers.plot_ok !== "yes") return "UNQUALIFIED";
  if (answers.price_ok === "no") return "UNQUALIFIED";
  if (answers.follow_up !== "yes") return "UNQUALIFIED";
  return "QUALIFIED";
}

export function nextStepId(current: ScriptStepId): ScriptStepId | null {
  const idx = LAND_CALL_SCRIPT.findIndex((s) => s.id === current);
  if (idx < 0 || idx >= LAND_CALL_SCRIPT.length - 1) return null;
  return LAND_CALL_SCRIPT[idx + 1].id;
}

export function getStep(id: ScriptStepId): ScriptStep | undefined {
  return LAND_CALL_SCRIPT.find((s) => s.id === id);
}

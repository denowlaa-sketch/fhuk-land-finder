/**
 * Land seller qualify script — keypad answers for live Twilio + sandbox UI.
 * Plot / location / motivation / timeline (not solar roof/bill/panels).
 */

export type ScriptStepId =
  | "intro"
  | "interested"
  | "owner"
  | "plot_ok"
  | "location_ok"
  | "motivation"
  | "timeline"
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
      "Hello — this is Flipping Homes UK calling about the land enquiry you submitted on our ad. This call is recorded. Press 1 to continue, or 2 if you prefer a callback later.",
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
    id: "location_ok",
    prompt:
      "Can you confirm the location of the land matches what you entered on the form? Press 1 for yes, 2 for no, 3 if you need to correct it later.",
    options: [
      { digit: "1", label: "Yes — location correct", value: "yes" },
      { digit: "2", label: "No — wrong location", value: "no" },
      { digit: "3", label: "Needs correction", value: "correct_later" },
    ],
  },
  {
    id: "motivation",
    prompt:
      "What best describes your motivation? Press 1 for cash sale soon, 2 for option or joint venture, 3 for exploring only.",
    options: [
      { digit: "1", label: "Cash sale soon", value: "cash_sale" },
      { digit: "2", label: "Option / JV", value: "option_jv" },
      { digit: "3", label: "Exploring", value: "exploring" },
    ],
  },
  {
    id: "timeline",
    prompt:
      "What is your timeline? Press 1 for ASAP or within 3 months, 2 for within 6 months, 3 for exploring with no fixed date.",
    options: [
      { digit: "1", label: "ASAP / ≤3 months", value: "hot" },
      { digit: "2", label: "Within 6 months", value: "warm" },
      { digit: "3", label: "Exploring", value: "exploring" },
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
 * Must: still interested, owner yes, plot OK, location not wrong, follow-up OK.
 * Exploring-only motivation still qualifies if other gates pass (ops can filter).
 */
export function evaluateCallOutcome(answers: CallAnswers): CallOutcomeValue {
  if (answers.intro === "callback") return "CALLBACK";
  if (answers.interested !== "yes") return "UNQUALIFIED";
  if (answers.owner === "no") return "UNQUALIFIED";
  if (answers.owner !== "yes") return "UNQUALIFIED";
  if (answers.plot_ok === "no") return "UNQUALIFIED";
  if (answers.plot_ok !== "yes") return "UNQUALIFIED";
  if (answers.location_ok === "no") return "UNQUALIFIED";
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

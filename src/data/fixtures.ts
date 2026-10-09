import type { Conversation, Issue, Recommendation } from "../domain/models";

export const issues: Issue[] = [
  {
    id: "ISS-001",
    title: "Verification codes arrive too late",
    category: "Mobile banking",
    priority: "Critical",
    owner: "Digital Experience",
    description:
      "Customers cannot finish signing in before their one-time verification code expires.",
    hypothesis:
      "SMS delivery delays may be contributing. Validate against provider delivery logs before attributing a root cause.",
  },
  {
    id: "ISS-002",
    title: "Card delivery has no clear timeline",
    category: "Cards & payments",
    priority: "High",
    owner: "Card Operations",
    description:
      "Customers call repeatedly for delivery updates after ordering a new card.",
    hypothesis:
      "Delivery status may not be reaching customer notifications. Compare courier events with notification records.",
  },
  {
    id: "ISS-003",
    title: "Transfer fees are hard to understand",
    category: "Payments",
    priority: "High",
    owner: "Payments Team",
    description:
      "Customers discover transfer fees later than expected and ask for clarification.",
    hypothesis:
      "The confirmation screen may not explain the fee clearly. Review the flow and the current fee schedule.",
  },
  {
    id: "ISS-004",
    title: "Loan terms need clearer explanations",
    category: "Lending",
    priority: "Medium",
    owner: "Lending Experience",
    description:
      "Customers need help understanding repayment dates and the total cost of their loan.",
    hypothesis:
      "Product language may be too technical. Compare help content with the questions in these conversations.",
  },
];
const scenarios = [
  {
    topic: "Verification code delay",
    issueId: "ISS-001",
    sentiment: "Negative",
    summary:
      "The customer requested a new verification code twice. Both arrived after the sign-in session expired. The agent suggested trying again and logged a support case.",
    customerText:
      "I tried signing in twice. By the time the text arrives, the code has already expired.",
    agentText:
      "I understand how frustrating that is. I have recorded the delivery delay for our digital support team.",
  },
  {
    topic: "Card delivery update",
    issueId: "ISS-002",
    sentiment: "Negative",
    summary:
      "A customer followed up on a card order with no delivery update. The agent opened a delivery enquiry.",
    customerText:
      "My card was ordered last week, but I still do not know when it will arrive.",
    agentText:
      "Let me check the delivery status and open an enquiry with our card operations team.",
  },
  {
    topic: "Unexpected transfer fee",
    issueId: "ISS-003",
    sentiment: "Negative",
    summary:
      "The customer asked why a transfer included an additional fee. The agent explained the current fee schedule.",
    customerText:
      "I did not notice the fee until I completed the transfer. Where can I see it in advance?",
    agentText:
      "The fee is shown on the confirmation screen. I will record your feedback about making it clearer.",
  },
  {
    topic: "Repayment schedule question",
    issueId: "ISS-004",
    sentiment: "Neutral",
    summary:
      "The customer needed an explanation of repayment dates and total interest. The agent clarified the schedule.",
    customerText:
      "Could you explain when my first repayment is due and what the total amount includes?",
    agentText:
      "Of course. We can go through your repayment schedule together, step by step.",
  },
  {
    topic: "Successful card activation",
    issueId: null,
    sentiment: "Positive",
    summary:
      "The agent guided the customer through card activation. The customer confirmed that the card was ready to use.",
    customerText: "The card is activated now. Thank you for making that easy.",
    agentText: "You are welcome. Your card is ready to use.",
  },
] as const;
// Fixed synthetic fixtures make screenshots, metrics and tests reproducible.
export const conversations: Conversation[] = Array.from(
  { length: 126 },
  (_, index): Conversation => {
    const day = index % 30;
    const scenario =
      scenarios[day < 7 && index % 3 === 0 ? 0 : index % scenarios.length];
    const date = new Date(
      Date.UTC(2026, 9, 9 - day, 8 + (index % 9), index % 60),
    );
    return {
      id: `CALL-${String(1042 + index).padStart(4, "0")}`,
      customer: `Customer ${String((index % 91) + 1).padStart(3, "0")}`,
      agent: ["Leyla M.", "Samir A.", "Nigar H.", "Murad R."][index % 4],
      department: index % 2 ? "Customer Support" : "Digital Support",
      date: date.toISOString(),
      duration: 120 + ((index * 17) % 420),
      language: "English",
      ...scenario,
      transcript: [
        {
          speaker: "Agent",
          seconds: 0,
          text: "Hello, thank you for calling. How can I help you today?",
        },
        { speaker: "Customer", seconds: 12, text: scenario.customerText },
        { speaker: "Agent", seconds: 36, text: scenario.agentText },
        {
          speaker: "Customer",
          seconds: 65,
          text: "Thank you. Please keep me updated.",
        },
      ],
    };
  },
).sort((a, b) => b.date.localeCompare(a.date));
export const recommendations: Recommendation[] = [
  {
    id: "REC-001",
    issueId: "ISS-001",
    title: "Investigate verification code delivery",
    description:
      "Repeated sign-in failures are interrupting access to mobile banking.",
    proposedAction:
      "Compare SMS delivery latency with authentication expiry times. Investigate provider delays and evaluate a fallback delivery route.",
    expectedOutcome:
      "Fewer calls about expired verification codes. Establish a baseline before measuring the change.",
    priority: "Critical",
    effort: "Medium effort",
  },
  {
    id: "REC-002",
    issueId: "ISS-002",
    title: "Make card delivery progress visible",
    description:
      "Missing delivery updates are creating avoidable follow-up calls.",
    proposedAction:
      "Review courier status ingestion and introduce clear order milestones in the customer notification flow.",
    expectedOutcome:
      "Fewer repeat enquiries per card order after delivery notifications are improved.",
    priority: "High",
    effort: "Medium effort",
  },
  {
    id: "REC-003",
    issueId: "ISS-003",
    title: "Clarify fees before a transfer",
    description:
      "Customers are asking for a clearer explanation of transfer charges.",
    proposedAction:
      "Review the confirmation screen with the payments team and test a clearer fee breakdown with customers.",
    expectedOutcome:
      "Fewer fee clarification calls, measured against transfer volume.",
    priority: "High",
    effort: "Low effort",
  },
];

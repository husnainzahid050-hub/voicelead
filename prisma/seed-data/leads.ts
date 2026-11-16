/**
 * Demo leads. All names, numbers and stories are invented.
 *
 * Times are relative to when the seed runs so the dashboard always looks
 * "live": `minutesAgo` sets createdAt; `preferredDayOffset` is counted from the
 * day the lead was created, in the clinic timezone (0 = same day, 1 = next day).
 * It is null whenever the customer did not give a resolvable date — the AI
 * must never invent one.
 */
import type {
  FieldSource,
  Language,
  LeadFieldName,
  LeadStatus,
  TurnRole,
  Urgency,
} from "../../src/types/domain";
import type { SeedBusiness } from "./business";

export interface SeedLead {
  businessKey: SeedBusiness["key"];
  minutesAgo: number;
  customerName: string | null;
  phone: string | null;
  serviceNeeded: string | null;
  urgency: Urgency;
  preferredDayOffset: number | null;
  preferredDateText: string | null;
  preferredTime: string | null;
  notes: string | null;
  summary: string;
  transcript: string;
  language: Language;
  aiConfidence: number;
  status: LeadStatus;
  internalNotes?: string;
  followUpMessage?: string;
  /** Follow-up Q&A after the first message (the transcript itself is turn 1). */
  turns: Array<{ role: TurnRole; content: string }>;
  /** Fields that came from a clarifying answer or a staff edit rather than first-pass AI. */
  fieldSources?: Partial<Record<LeadFieldName, Exclude<FieldSource, "ai">>>;
}

export const SEED_LEADS: SeedLead[] = [
  // ── Emergency dental pain (3) ────────────────────────────────────────
  {
    businessKey: "smilecare",
    minutesAgo: 35,
    customerName: "Ali Raza",
    phone: "0300-0000101",
    serviceNeeded: "Emergency dental pain",
    urgency: "emergency",
    preferredDayOffset: 1,
    preferredDateText: "kal",
    preferredTime: "17:00",
    notes: "Severe tooth pain since last night, cheek is swollen, could not sleep.",
    summary:
      "Patient reports severe tooth pain with facial swelling since last night and requests an urgent appointment tomorrow at 5 PM.",
    transcript:
      "Assalam o alaikum. Meri daant mein bohat dard ho raha hai, raat bhar so nahi saka. Gaal bhi sooj gaya hai. Kal appointment chahiye.",
    language: "mixed",
    aiConfidence: 0.94,
    status: "new",
    turns: [
      { role: "assistant", content: "Aap ka naam kya hai?" },
      { role: "customer", content: "Mera naam Ali Raza hai." },
      { role: "assistant", content: "Aap ka WhatsApp number kya hai?" },
      { role: "customer", content: "0300 0000101" },
      { role: "assistant", content: "Aap kal kis time aana chahenge?" },
      { role: "customer", content: "Shaam 5 baje." },
    ],
    fieldSources: { customer_name: "customer", phone: "customer", preferred_time: "customer" },
  },
  {
    businessKey: "smilecare",
    minutesAgo: 90,
    customerName: "Fatima Bibi",
    phone: "0345-0000102",
    serviceNeeded: "Emergency dental pain",
    urgency: "emergency",
    preferredDayOffset: 0,
    preferredDateText: "آج",
    preferredTime: null,
    notes: "Child (8 years) fell and broke a front tooth, gum is bleeding.",
    summary:
      "Mother reports her 8-year-old son broke a front tooth in a fall and the gum is bleeding. Wants him seen today.",
    transcript:
      "میرے بیٹے کا دانت گر کر ٹوٹ گیا ہے اور مسوڑھے سے خون آ رہا ہے۔ وہ آٹھ سال کا ہے۔ آج ہی دکھانا ہے۔ میرا نام فاطمہ ہے۔",
    language: "ur",
    aiConfidence: 0.86,
    status: "ready_to_contact",
    internalNotes: "Call immediately — child with broken tooth. Keep 6 PM slot free.",
    followUpMessage:
      "السلام علیکم فاطمہ صاحبہ، SmileCare Dental Clinic سے بات کر رہے ہیں۔ آپ کے بیٹے کے دانت کے بارے میں آپ کا پیغام ملا۔ براہ کرم جلد از جلد کلینک تشریف لائیں یا اس نمبر پر کال کریں تاکہ ہم آج ہی وقت دے سکیں۔",
    turns: [
      { role: "assistant", content: "آپ کا واٹس ایپ نمبر کیا ہے؟" },
      { role: "customer", content: "0345 0000102" },
    ],
    fieldSources: { phone: "customer", customer_name: "staff" },
  },
  {
    businessKey: "smilecare",
    minutesAgo: 60 * 26,
    customerName: "Usman Khan",
    phone: "+92 333 0000103",
    serviceNeeded: "Emergency dental pain",
    urgency: "emergency",
    preferredDayOffset: null,
    preferredDateText: "as soon as possible",
    preferredTime: "11:00",
    notes: "Wisdom tooth pain, jaw swollen, difficulty opening mouth.",
    summary:
      "Patient has wisdom tooth pain with a swollen jaw and difficulty opening his mouth. Requests the earliest available slot.",
    transcript:
      "Hi, I have really bad pain from my wisdom tooth. My jaw is swollen and I can't open my mouth properly. I need to see a dentist as soon as possible. My name is Usman Khan, number is 0333 0000103.",
    language: "en",
    aiConfidence: 0.97,
    status: "contacted",
    internalNotes:
      "Spoke on WhatsApp. He will come at 11 AM. Advised to bring previous X-ray if any.",
    followUpMessage:
      "Hi Usman, this is SmileCare Dental Clinic. We received your message about wisdom tooth pain. We can see you at 11:00 AM — please reply to confirm, or call us if the swelling gets worse.",
    turns: [
      { role: "assistant", content: "What time would suit you best?" },
      { role: "customer", content: "Morning, around 11." },
    ],
    fieldSources: { preferred_time: "customer" },
  },

  // ── Routine cleaning (3) ─────────────────────────────────────────────
  {
    businessKey: "smilecare",
    minutesAgo: 60 * 50,
    customerName: "Ayesha Malik",
    phone: "0321-0000104",
    serviceNeeded: "Cleaning",
    urgency: "low",
    preferredDayOffset: 5,
    preferredDateText: "next week",
    preferredTime: "11:00",
    notes: "Routine six-monthly cleaning.",
    summary: "Patient wants a routine cleaning next week, around 11 AM.",
    transcript:
      "Hello, I'd like to book a routine teeth cleaning. Sometime next week around 11 would be ideal. I'm Ayesha Malik, 0321 0000104.",
    language: "en",
    aiConfidence: 0.98,
    status: "booked",
    internalNotes: "Booked for 11:00 with Dr. Nadia (date confirmed by phone).",
    followUpMessage:
      "Hi Ayesha, thank you for contacting SmileCare Dental Clinic. Your cleaning appointment is set for 11:00 AM on the date we discussed. Reply here if you need to change the time.",
    turns: [],
    fieldSources: { preferred_date: "staff" },
  },
  {
    businessKey: "smilecare",
    minutesAgo: 60 * 5,
    customerName: "Bilal Ahmed",
    phone: "0312-0000105",
    serviceNeeded: "Cleaning",
    urgency: "normal",
    preferredDayOffset: null,
    preferredDateText: "agle hafte, kisi bhi din",
    preferredTime: null,
    notes: "Flexible on day next week, prefers evening.",
    summary: "Patient wants a teeth cleaning any day next week, preferably in the evening.",
    transcript:
      "Daanton ki safai karwani hai. Agle hafte kisi bhi din aa sakta hoon, shaam ko behtar hai. Bilal Ahmed, 0312 0000105.",
    language: "mixed",
    aiConfidence: 0.81,
    status: "needs_review",
    turns: [],
  },
  {
    businessKey: "smilecare",
    minutesAgo: 20,
    customerName: "Sana Tariq",
    phone: "0300-0000106",
    serviceNeeded: "Cleaning",
    urgency: "low",
    preferredDayOffset: 2,
    preferredDateText: "parson",
    preferredTime: "16:00",
    notes: "Scaling and polishing.",
    summary: "Patient requests scaling and polishing the day after tomorrow at 4 PM.",
    transcript: "Mujhe scaling and polishing karwani hai. Parson 4 baje theek rahega. Sana Tariq.",
    language: "mixed",
    aiConfidence: 0.9,
    status: "new",
    turns: [
      { role: "assistant", content: "Aap ka WhatsApp number kya hai?" },
      { role: "customer", content: "0300 0000106" },
    ],
    fieldSources: { phone: "customer" },
  },

  // ── Fillings (2) ─────────────────────────────────────────────────────
  {
    businessKey: "smilecare",
    minutesAgo: 60 * 3,
    customerName: "حمزہ قریشی",
    phone: "0331-0000107",
    serviceNeeded: "Filling",
    urgency: "normal",
    preferredDayOffset: 2,
    preferredDateText: "پرسوں",
    preferredTime: "18:00",
    notes: "Cavity in a back tooth, sensitive to cold water.",
    summary:
      "Patient has a cavity in a back tooth that is sensitive to cold. Wants a filling the day after tomorrow at 6 PM.",
    transcript:
      "السلام علیکم، میرے پیچھے والے دانت میں کیڑا لگ گیا ہے، ٹھنڈا پانی پینے سے درد ہوتا ہے۔ پرسوں شام چھ بجے آ سکتا ہوں۔ میرا نام حمزہ قریشی ہے۔ نمبر 0331 0000107۔",
    language: "ur",
    aiConfidence: 0.89,
    status: "ready_to_contact",
    followUpMessage:
      "السلام علیکم حمزہ صاحب، SmileCare Dental Clinic سے۔ آپ کا پیغام ملا۔ ہم پرسوں شام 6 بجے آپ کو وقت دے سکتے ہیں۔ براہ کرم تصدیق کے لیے جواب دیں۔",
    turns: [],
  },
  {
    businessKey: "smilecare",
    minutesAgo: 60 * 28,
    customerName: "Zainab Hussain",
    phone: "0302-0000108",
    serviceNeeded: "Filling",
    urgency: "high",
    preferredDayOffset: 0,
    preferredDateText: "today or tomorrow",
    preferredTime: null,
    notes: "Old filling fell out while eating, sharp edge hurting tongue.",
    summary:
      "Patient's old filling fell out while eating; the sharp edge is hurting her tongue. Wants to come today or tomorrow.",
    transcript:
      "My old filling just fell out while I was eating and there's a sharp edge that keeps cutting my tongue. Can I come today or tomorrow? Zainab Hussain, 0302 0000108.",
    language: "en",
    aiConfidence: 0.95,
    status: "contacted",
    internalNotes: "Sent WhatsApp, waiting for reply.",
    followUpMessage:
      "Hi Zainab, this is SmileCare Dental Clinic. Sorry to hear about your filling. We have openings this evening and tomorrow — which time works for you?",
    turns: [],
  },

  // ── Braces consultation (2) ──────────────────────────────────────────
  {
    businessKey: "smilecare",
    minutesAgo: 60 * 7,
    customerName: "Mariam Javed",
    phone: "0346-0000109",
    serviceNeeded: "Braces consultation",
    urgency: "low",
    preferredDayOffset: null,
    preferredDateText: "Sunday ke ilawa koi bhi din",
    preferredTime: "15:00",
    notes: "Consultation for 13-year-old daughter, teeth are crooked.",
    summary:
      "Mother wants a braces consultation for her 13-year-old daughter. Prefers an afternoon around 3 PM.",
    transcript:
      "Hi, meri beti 13 saal ki hai aur uske daant tedhe hain. Braces ke liye consultation chahiye. Afternoon 3 baje ke aas paas. Mariam Javed, 0346 0000109.",
    language: "mixed",
    aiConfidence: 0.92,
    status: "new",
    turns: [],
  },
  {
    businessKey: "smilecare",
    minutesAgo: 60 * 24 * 6,
    customerName: "Danish Mir",
    phone: "0355-0000110",
    serviceNeeded: "Braces consultation",
    urgency: "low",
    preferredDayOffset: null,
    preferredDateText: null,
    preferredTime: null,
    notes: "Adult, asking about cost of braces first.",
    summary: "Adult patient is asking about braces options and cost before booking.",
    transcript:
      "Mai 27 saal ka hoon, braces lagwana chahta hoon. Pehle cost ka pata karna hai. Danish Mir, 0355 0000110.",
    language: "mixed",
    aiConfidence: 0.88,
    status: "lost",
    internalNotes: "Shared price range. He chose a clinic in Islamabad.",
    followUpMessage:
      "Assalam o alaikum Danish, SmileCare Dental Clinic se. Braces ke liye pehle consultation hoti hai jismein doctor aap ke liye behtareen option aur cost batayenge. Kya aap is hafte aa sakte hain?",
    turns: [],
  },

  // ── Root canal (1) ───────────────────────────────────────────────────
  {
    businessKey: "smilecare",
    minutesAgo: 60 * 24 * 3,
    customerName: "Imran Shah",
    phone: "0311-0000111",
    serviceNeeded: "Root canal",
    urgency: "normal",
    preferredDayOffset: 5,
    preferredDateText: "agle hafte",
    preferredTime: "12:30",
    notes: "Another dentist advised a root canal on a lower molar.",
    summary:
      "Patient was advised a root canal on a lower molar by another dentist and wants treatment next week at 12:30.",
    transcript:
      "Mujhe doosre dentist ne neeche wale daant ka root canal bataya hai. Agle hafte dopehar saarhe barah baje aana chahta hoon. Imran Shah, 0311 0000111.",
    language: "mixed",
    aiConfidence: 0.84,
    status: "booked",
    internalNotes: "Booked. Ask him to bring the previous X-ray.",
    followUpMessage:
      "Assalam o alaikum Imran sahab, SmileCare Dental Clinic se. Aap ka root canal appointment 12:30 baje ke liye rakh diya gaya hai. Pichla X-ray saath le aayein.",
    turns: [],
    fieldSources: { preferred_date: "staff" },
  },

  // ── Incomplete lead (1) ──────────────────────────────────────────────
  {
    businessKey: "smilecare",
    minutesAgo: 60 * 9,
    customerName: null,
    phone: "0300-0000112",
    serviceNeeded: "Dental checkup",
    urgency: "normal",
    preferredDayOffset: null,
    preferredDateText: null,
    preferredTime: null,
    notes: "Customer stopped answering after giving phone number.",
    summary: "Customer wants a dental checkup. Name and preferred time were not provided.",
    transcript: "Assalam o alaikum, mujhe daant ka checkup karwana hai.",
    language: "mixed",
    aiConfidence: 0.52,
    status: "needs_review",
    turns: [
      { role: "assistant", content: "Aap ka naam kya hai?" },
      { role: "customer", content: "Baad mein bata doon ga. Number 0300 0000112 hai." },
      { role: "assistant", content: "Aap kis din aana chahenge?" },
    ],
    fieldSources: { phone: "customer" },
  },

  // ── Duplicate-looking lead (1): same phone as Ali Raza, 25 min later ──
  {
    businessKey: "smilecare",
    minutesAgo: 10,
    customerName: "Ali",
    phone: "03000000101",
    serviceNeeded: "Emergency dental pain",
    urgency: "high",
    preferredDayOffset: null,
    preferredDateText: "jaldi",
    preferredTime: null,
    notes: "Says he already sent a message earlier.",
    summary: "Customer says he messaged earlier about tooth pain and asks for a quick call back.",
    transcript:
      "Maine pehle bhi message kiya tha. Daant mein bohat dard hai, please jaldi call karein. Ali.",
    language: "mixed",
    aiConfidence: 0.78,
    status: "needs_review",
    turns: [
      { role: "assistant", content: "Aap ka WhatsApp number kya hai?" },
      { role: "customer", content: "03000000101" },
    ],
    fieldSources: { phone: "customer" },
  },

  // ── Bright Smile Dental (other tenant, used by authorization tests) ──
  {
    businessKey: "brightsmile",
    minutesAgo: 45,
    customerName: "Rabia Anwar",
    phone: "0341-0000201",
    serviceNeeded: "Dental checkup",
    urgency: "normal",
    preferredDayOffset: 1,
    preferredDateText: "tomorrow",
    preferredTime: "10:00",
    notes: null,
    summary: "Patient wants a general checkup tomorrow at 10 AM.",
    transcript: "I want a general checkup tomorrow at 10 AM please. Rabia Anwar, 0341 0000201.",
    language: "en",
    aiConfidence: 0.96,
    status: "new",
    turns: [],
  },
  {
    businessKey: "brightsmile",
    minutesAgo: 60 * 30,
    customerName: "Nasir Iqbal",
    phone: "0322-0000202",
    serviceNeeded: "Filling",
    urgency: "normal",
    preferredDayOffset: null,
    preferredDateText: null,
    preferredTime: null,
    notes: null,
    summary: "Patient needs a filling and asks for available times.",
    transcript: "Filling karwani hai, kab time mil sakta hai? Nasir Iqbal, 0322 0000202.",
    language: "mixed",
    aiConfidence: 0.87,
    status: "contacted",
    turns: [],
  },
];

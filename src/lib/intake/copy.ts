/**
 * Patient-facing text in English and Urdu. Both are shown together on the
 * intake page: the patient's language isn't known until they speak, and many
 * patients read one script more comfortably than the other.
 */
export interface BiText {
  en: string;
  ur: string;
}

export const COPY = {
  speak: { en: "Speak your request", ur: "اپنی بات بولیں" },
  tapToFinish: { en: "Tap to finish", ur: "ختم کرنے کے لیے دبائیں" },
  allowMic: { en: "Allow microphone access…", ur: "مائیکروفون کی اجازت دیں" },
  preferType: { en: "Prefer to type?", ur: "لکھ کر بتانا چاہتے ہیں؟" },
  typeInstead: { en: "Type instead", ur: "لکھ کر بتائیں" },
  privacy: {
    en: "Your voice is turned into text, then deleted. Only {clinic} sees your request. Nothing is sent until you confirm.",
    ur: "آپ کی آواز متن میں بدل کر مٹا دی جاتی ہے۔ آپ کی درخواست صرف کلینک دیکھتا ہے۔",
  },
  heardTitle: { en: "Here's what we heard", ur: "ہم نے یہ سنا" },
  heardHint: {
    en: "Fix anything we got wrong before continuing.",
    ur: "اگر کچھ غلط ہو تو درست کر دیں",
  },
  describeTitle: { en: "Describe what you need", ur: "اپنا مسئلہ لکھیں" },
  describeHint: {
    en: "For example: tooth pain since yesterday, want to come tomorrow evening.",
    ur: "مثلاً: کل سے دانت میں درد ہے، کل شام آنا چاہتا ہوں",
  },
  continue: { en: "Continue", ur: "آگے بڑھیں" },
  recordAgain: { en: "Record again", ur: "دوبارہ ریکارڈ کریں" },
  speakInstead: { en: "Speak instead", ur: "بول کر بتائیں" },
  oneQuestion: { en: "One quick question", ur: "ایک مختصر سوال" },
  answerPlaceholder: { en: "Type or tap the mic", ur: "لکھیں یا مائیک دبائیں" },
  answerEmpty: {
    en: "Please type or say your answer, or skip.",
    ur: "جواب لکھیں یا بولیں، یا چھوڑ دیں",
  },
  recordingAnswer: { en: "Recording… tap ■ to stop", ur: "ریکارڈنگ… روکنے کے لیے دبائیں" },
  next: { en: "Next", ur: "آگے" },
  skip: { en: "Skip", ur: "چھوڑ دیں" },
  reviewTitle: { en: "Please check your details", ur: "اپنی تفصیلات دیکھ لیں" },
  reviewHint: { en: "Change anything that isn't right.", ur: "جو غلط ہو اسے درست کر دیں" },
  manualTitle: { en: "Send a short request", ur: "مختصر درخواست بھیجیں" },
  manualHint: {
    en: "Just a few details and the clinic will get back to you.",
    ur: "چند تفصیلات دیں، کلینک آپ سے رابطہ کرے گا",
  },
  send: { en: "Send to clinic", ur: "کلینک کو بھیجیں" },
  consent: {
    en: "By sending, you agree that {clinic} may contact you about this request.",
    ur: "بھیجنے سے آپ اجازت دیتے ہیں کہ کلینک اس بارے میں آپ سے رابطہ کرے۔",
  },
  labelName: { en: "Your name", ur: "آپ کا نام" },
  labelPhone: { en: "WhatsApp / phone number", ur: "واٹس ایپ / فون نمبر" },
  labelService: { en: "What do you need?", ur: "آپ کو کیا چاہیے؟" },
  labelDay: { en: "Preferred day", ur: "کون سا دن" },
  labelTime: { en: "Preferred time", ur: "کون سا وقت" },
  labelNotes: { en: "Anything else the clinic should know?", ur: "کوئی اور بات؟" },
  labelMessage: { en: "What do you need help with?", ur: "آپ کو کس چیز میں مدد چاہیے؟" },
  transcribing: { en: "Listening to your message…", ur: "آپ کا پیغام سن رہے ہیں…" },
  analyzing: { en: "Understanding your request…", ur: "آپ کی بات سمجھ رہے ہیں…" },
  submitting: { en: "Sending to the clinic…", ur: "کلینک کو بھیج رہے ہیں…" },
  offline: {
    en: "You're offline. Check your internet connection; your answers are kept on this page.",
    ur: "انٹرنیٹ نہیں ہے۔ کنکشن چیک کریں، آپ کی معلومات محفوظ ہیں۔",
  },
  refresh: { en: "Refresh page", ur: "صفحہ دوبارہ کھولیں" },
  tryAgain: { en: "Try again", ur: "دوبارہ کوشش کریں" },
} satisfies Record<string, BiText>;

export function fill(text: string, clinic: string): string {
  return text.replace("{clinic}", clinic);
}

/** Short Urdu versions of the API error messages (the English comes from the server). */
export const ERROR_UR: Record<string, string> = {
  invalid_input: "کچھ معلومات درست نہیں۔ براہ کرم دیکھ کر دوبارہ کوشش کریں۔",
  not_found: "یہ کلینک لنک درست نہیں ہے۔",
  inactive: "یہ کلینک ابھی آن لائن درخواستیں نہیں لے رہا۔",
  session_expired: "صفحہ کافی دیر سے کھلا ہے۔ براہ کرم صفحہ دوبارہ کھولیں۔",
  rate_limited: "بہت زیادہ کوششیں۔ چند منٹ بعد دوبارہ کوشش کریں۔",
  ai_unavailable: "ابھی آواز سمجھ نہیں آ سکی۔ نیچے مختصر فارم بھر دیں۔",
  no_speech: "ریکارڈنگ میں آواز نہیں آئی۔ فون کے قریب ہو کر دوبارہ بولیں۔",
  payload_too_large: "ریکارڈنگ بہت لمبی ہے۔ تین منٹ سے کم رکھیں۔",
  unsupported_media: "یہ ریکارڈنگ پڑھی نہیں جا سکی۔ براہ کرم لکھ کر بتائیں۔",
  forbidden: "یہ درخواست روک دی گئی۔",
  server_error: "ہماری طرف سے مسئلہ ہوا۔ دوبارہ کوشش کریں۔",
  network: "انٹرنیٹ سے رابطہ نہیں ہو سکا۔ کنکشن چیک کر کے دوبارہ کوشش کریں۔",
};

export const RECORDER_COPY: Record<
  "denied" | "no_mic" | "unsupported" | "too_short" | "failed",
  BiText
> = {
  denied: {
    en: "Microphone access is blocked. Allow it in your browser's site settings, or type your request instead.",
    ur: "مائیکروفون کی اجازت نہیں ملی۔ براؤزر کی سیٹنگ میں اجازت دیں یا لکھ کر بتائیں۔",
  },
  no_mic: {
    en: "We couldn't find a microphone on this device. You can type your request instead.",
    ur: "اس فون میں مائیکروفون نہیں ملا۔ لکھ کر بتا دیں۔",
  },
  unsupported: {
    en: "Voice recording isn't supported in this browser. You can type your request instead.",
    ur: "یہ براؤزر آواز ریکارڈ نہیں کر سکتا۔ لکھ کر بتا دیں۔",
  },
  too_short: {
    en: "That was too short for us to hear. Tap the microphone and speak for a few seconds.",
    ur: "ریکارڈنگ بہت مختصر تھی۔ مائیک دبا کر چند سیکنڈ بولیں۔",
  },
  failed: {
    en: "The microphone couldn't start. Please try again or type your request.",
    ur: "مائیکروفون شروع نہیں ہو سکا۔ دوبارہ کوشش کریں یا لکھ کر بتائیں۔",
  },
};

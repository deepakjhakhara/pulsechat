
const hindiWords = {
  // Common Hinglish phrases — keep longer phrases first
  "acha hai": "अच्छा है",
  "accha hai": "अच्छा है",
  "kya baat": "क्या बात",
  "kya hua": "क्या हुआ",
  "kya kar": "क्या कर",
  "kaise ho": "कैसे हो",
  "kaisa hai": "कैसा है",
  "mast hai": "मस्त है",
  "bahut acha": "बहुत अच्छा",
  "bahut accha": "बहुत अच्छा",
  "bohot acha": "बहुत अच्छा",
  "bohot accha": "बहुत अच्छा",
  "sahi hai": "सही है",
  "badiya hai": "बढ़िया है",
  "khel rahe": "खेल रहे",
  "kar raha": "कर रहा",
  "kar rahi": "कर रही",
  "dekh raha": "देख रहा",
  "dekh rahi": "देख रही",
  "ho gaya": "हो गया",
  "ho gya": "हो गया",
  "chalo bhai": "चलो भाई",
  "are bhai": "अरे भाई",

  // Individual words
  bhai: "भाई",
  yaar: "यार",
  kya: "क्या",
  hai: "है",
  hain: "हैं",
  ho: "हो",
  acha: "अच्छा",
  accha: "अच्छा",
  mast: "मस्त",
  bahut: "बहुत",
  bohot: "बहुत",
  sahi: "सही",
  nahi: "नहीं",
  nai: "नहीं",
  haan: "हाँ",
  han: "हाँ",
  kar: "कर",
  raha: "रहा",
  rahi: "रही",
  rahe: "रहे",
  tum: "तुम",
  aap: "आप",
  main: "मैं",
  mera: "मेरा",
  meri: "मेरी",
  tera: "तेरा",
  teri: "तेरी",
  mujhe: "मुझे",
  mujko: "मुझको",
  kyaaa: "क्या",
  game: "गेम",
  gameplay: "गेमप्ले",
  jeet: "जीत",
  jeetega: "जीतेगा",
  maar: "मार",
  maaro: "मारो",
  bhago: "भागो",
  ruk: "रुक",
  dekh: "देख",
  sun: "सुन",
  bol: "बोल",
  bolo: "बोलो",
  karna: "करना",
  karo: "करो",
  chal: "चल",
  chalo: "चलो",
  zabardast: "ज़बरदस्त",
  shukriya: "शुक्रिया",
  dhanyavad: "धन्यवाद",
  namaste: "नमस्ते",
  noob: "नूब",
  pro: "प्रो",
  op: "ओपी",
};

export function getSpeechLanguage(text) {
  const value = text || "";

  // Devanagari text should use a Hindi voice
  if (/[\u0900-\u097F]/.test(value)) {
    return "hi-IN";
  }

  const words = value.toLowerCase().match(/[a-z]+/g) || [];

  const hindiCount = words.filter((word) =>
    Object.prototype.hasOwnProperty.call(hindiWords, word)
  ).length;

  return hindiCount >= 2 ? "hi-IN" : "en-IN";
}

export function prepareSpeechText(text) {
  if (!text) return "";

  let result = text.toLowerCase();

  // Replace known multi-word phrases first
  const phrases = Object.keys(hindiWords)
    .filter((word) => word.includes(" "))
    .sort((a, b) => b.length - a.length);

  for (const phrase of phrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");

    result = result.replace(regex, hindiWords[phrase]);
  }

  // Replace individual words
  result = result.replace(/\b[a-z]+\b/gi, (word) => {
    const translated = hindiWords[word.toLowerCase()];
    return translated || word;
  });

  return result;
}

export function findVoice(voices, language) {
  if (!voices || voices.length === 0) return null;

  const preferred = voices.find(
    (voice) => voice.lang.toLowerCase() === language.toLowerCase()
  );

  if (preferred) return preferred;

  const languagePrefix = language.split("-")[0].toLowerCase();

  return (
    voices.find((voice) =>
      voice.lang.toLowerCase().startsWith(languagePrefix)
    ) ||
    voices.find((voice) => voice.lang.toLowerCase() === "en-in") ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ||
    voices[0]
  );
}

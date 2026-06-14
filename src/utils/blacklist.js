// src/utils/blacklist.js

const vulgarWords = [
  // English (basic)
  "fuck", "shit", "asshole", "bitch", "cunt", "dick", "pussy", "whore", "slut",
  "bastard", "damn", "hell", "crap", "bloody", "arse", "arsehole", "wanker",
  "motherfucker", "douche", "twat", "cock", "prick", "ballsack", "nutsack",
  "fag", "faggot", "retard", "retarded", "nigga", "nigger", "chink", "kike",
  "spic", "gook", "wetback", "raghead", "towelhead", "sandnigger", "coon",
  "spastic", "spaz", "cripple", "tranny", "sheep", "scum", "filth", "trash",
  "vermin", "scumbag", "lowlife", "degenerate",
  "pervert", "pedo", "child molester", "rapist", "murderer", "killer", "terrorist",
  "whore", "prostitute", "hooker", "callgirl", "slutbag", "thot", "hoe", "ho",
  "bitchass", "dickhead", "asswipe", "shithead", "shitstain", "cum", "cumstain",
  "jizz", "semen", "sperm", "orgasm", "blowjob", "handjob", "cocksucker",
  "dildo", "vibrator", "anal", "anus", "assfuck", "buttplug", "fuckface",
  "fucktard", "fuckwad", "fuckwit", "shitfuck", "fuckshit", "motherfucking",
  "fucking", "shitty", "bitchy", "cunty", "dickish", "assholeish", "bastardly",
  "twatwaffle", "douchecanoe", "shitgibbon", "cuntbag", "bitchtits", "assclown",
  "asshat", "assmunch", "buttface", "buttmunch", "dickbag", "dickwad", "fucknugget",
  "fuckstick", "shitbag", "shitweasel", "twatsocket", "cumbucket", "fuckbucket",
  "jizzmop", "skank", "skanky", "skeeze", "tramp", "trollop", "harlot", "strumpet",
  "wench", "hussy", "minx", "vixen", "seductress", "temptress", "siren", "harlot",
  // English - violence/threats
  "kill", "murder", "slaughter", "execute", "assassinate", "lynch", "behead",
  "decapitate", "crucify", "torture", "maim", "dismember", "rape", "molest",
  "abuse", "beat", "stab", "shoot", "bomb", "destroy", "annihilate", "exterminate",

  // French
  "merde", "putain", "connard", "con", "salope", "pute", "bâtard", "enculé",
  "foutre", "nique", "bite", "couille", "chier", "saloperie", "gros mot",
  "niquer", "baise", "branleur", "branleuse", "pétasse", "grognasse", "garce",
  "salaud", "ordure", "fumier", "charogne", "ragnagnas", "morue", "chienne",
  "souris", "raton", "bougnoule", "bicot", "negro", "sale race", "sous-homme",
  "crétin", "imbécile", "abruti", "débile", "mongol", "mongolien", "attardé",
  "handicapé mental", "schizo", "taré", "fada", "cinglé", "déjanté", "fou",
  "cinglé", "malade mental", "psychopathe", "sociopathe", "nazi", "facho",
  "raciste", "antisémite", "homophobe", "misogyne", "pédé", "tarlouze", "tapette",
  "lopette", "fiotte", "travelo", "transphobe", "grosse", "gros tas", "obèse",
  "moche", "laid", "hideux", "monstre", "cafard", "vermine", "punaise", "poux",

  // Arabic (common vulgarities - transliterated)
  "kos omak", "ayre", "kharra", "kess", "zamel", "sharmouta", "toz", "nik",
  "ayri", "ayrek", "koss", "kiss", "tiz", "mok", "neek", "nayek", "khara",
  "kelb", "kalb", "bint l", "sharmuta", "qahba", "qahbe",
  "dayooth", "dayyouth", "mamm", "mamnoo", "laanat", "mal3oun", "kafir",
  "kuffar", "mushrik", "murtad", "zindiq", "shi3i", "sunni", "rafidhi",
  "nasibi", "khawarij", "yahoudi", "sahioni", "amriki", "faransawi", "ajnabi",
  "majnun", "majnoon", "majnoun", "makhbou", "ma'atool", "a'ma", "atrash",
  "akhras", "abkam", "kharif", "himar", "himar", "hanzir", "khanzir", "qird",
  "qir", "dhubbab", "thu'ban", "af'aa", "timsah",
  "tinnin", "ghoul", "ifrit", "shaytan", "iblis", "jinn", "afreet", "marid",

  // Common slurs / hate speech (English based)
  "nigger", "nigga", "coon", "spook", "jigaboo", "sambo", "pickaninny",
  "chink", "gook", "zipperhead", "slope", "raghead", "towelhead", "camel jockey",
  "sand nigger", "sand monkey", "dune coon", "mudslime", "muzzie", "muslim",
  "haji", "hajji", "goat fucker", "kebab", "paki", "curry muncher", "dot head",
  "hindoo", "gypsy", "redneck", "hillbilly", "white trash", "cracker", "honky",
  "whitey", "wetback", "beaner", "spic", "greaser", "taco bender", "bean burrito",
  "cholo", "naco", "gringo", "yankee", "frog", "kraut", "jerry", "nip", "jap",
  "gook", "dink", "zipperhead", "slope", "roundeye", "coconut", "banana",
  "twinkie", "oreo", "apple", "sellout", "uncle tom", "house nigger", "field nigger",
];

const badDomains = [
  "porn", "xxx", "adult", "sex", "gambling", "casino", "betting", "poker",
  "malware", "phishing", "hack", "crack", "warez", "torrent", "darkweb",
];

const vulgarRegex = new RegExp(`\\b(${vulgarWords.join('|')})\\b`, 'i');
const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/i;

function extractDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function isBadUrl(url) {
  const domain = extractDomain(url);
  return badDomains.some(bad => domain.includes(bad));
}

/**
 * Validate comment text.
 * Returns:
 * - { valid: true } if clean
 * - { valid: false, reason: "vulgar", match: string } if vulgar word found
 * - { valid: false, reason: "url_bad", match: string } if bad URL found
 * - { valid: false, reason: "url_safe", match: string } if safe URL found
 */
export function validateComment(text) {
  if (!text || text.trim() === "") {
    return { valid: false, reason: "empty", match: null };
  }

  // Check for vulgar words
  const vulgarMatch = text.match(vulgarRegex);
  if (vulgarMatch) {
    return { valid: false, reason: "vulgar", match: vulgarMatch[0] };
  }

  // Check for URLs
  const urlMatch = text.match(urlRegex);
  if (urlMatch) {
    const url = urlMatch[0];
    if (isBadUrl(url)) {
      return { valid: false, reason: "url_bad", match: url };
    } else {
      return { valid: false, reason: "url_safe", match: url };
    }
  }

  return { valid: true, reason: null, match: null };
}
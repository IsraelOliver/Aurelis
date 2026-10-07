import {
  AI_DOMAINS,
  CONTEXT_BUDGET_TOKENS,
  type AiDomain,
  type AiFocusKind,
  type AiIntent,
  type AiRoute,
} from "./types";

/**
 * Context Router (local, deterministic, no LLM call): decides what a question
 * needs BEFORE anything is built or sent. Explicit keyword rules over the
 * normalized message plus the AURELIS state (selected entity, open panel).
 * Small on purpose: easy to read, test and extend.
 */

export interface RouterState {
  /** Kind of the selected entity that still exists in its source, if any. */
  focusKind: AiFocusKind | null;
  /** Panel under SMILEY: a domain, an entity panel, or nothing. */
  openPanel: AiDomain | "entity" | null;
}

/** Lowercase, no accents, words separated by single spaces. */
export function normalizeMessage(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Greetings and pure social messages (nothing to look up). Matched as a whole message.
const GREETING_PHRASES = [
  "bom dia", "boa tarde", "boa noite", "good morning", "good afternoon", "good evening",
  "tudo bem", "tudo bom", "tudo certo", "como vai", "how are you", "e ai", "thank you",
  "ola", "oi", "oie", "opa", "hey", "hello", "hi", "hola", "salve", "eai", "yo",
  "obrigado", "obrigada", "valeu", "thanks", "smiley", "voce", "vc", "you", "com voce", "ai",
];

export function isGreeting(normalized: string): boolean {
  if (!normalized) return false;
  let rest = ` ${normalized} `;
  let changed = true;
  while (changed) {
    changed = false;
    for (const phrase of GREETING_PHRASES) {
      if (rest.startsWith(` ${phrase} `)) {
        rest = rest.slice(phrase.length + 1);
        changed = true;
      }
    }
  }
  return rest.trim() === "" && normalized.length <= 60;
}

const DOMAIN_PATTERNS: Record<AiDomain, RegExp> = {
  space:
    /\b(sol|sun|solar|espaco|espacia\w*|space|iss|estacao espacial|kp|geomagnet\w*|aurora\w*|magnetosfer\w*|magnetospher\w*|raios? x|x ray|xray|flares?|cme|bz|bt|astronaut\w*|orbita\w*|orbit\w*|satelites?|satellites?|ovation|swpc|cosmic\w*|cosmos|heliosfer\w*|manchas? solar\w*|sunspots?)\b/,
  disasters:
    /\b(terremot\w*|sismo\w*|sismic\w*|earthquakes?|quakes?|tremor\w*|abalos?|vulc\w*|volcan\w*|incendi\w*|queimad\w*|wildfires?|fires?|fogo|furac\w*|hurricanes?|ciclone\w*|cyclones?|tufao|tufoes|typhoons?|tempestades? tropica\w*|tropical storms?|tempestades? severa\w*|severe storms?|enchente\w*|inundac\w*|floods?|desastre\w*|disasters?|tsunami\w*|eonet|usgs|icebergs?|deslizament\w*|landslides?|droughts?|catastrof\w*)\b/,
  weather:
    /\b(clima(?! espacial)|weather|chuv\w*|rain\w*|chover|temperatura\w*|temperatures?|vento\w*(?! solar)|(?<!solar )winds?|umidade|humidity|nuve\w*|clouds?|nublado|cloudy|frio|calor|neve|snow\w*|garoa|graus|open meteo|gfs)\b|\b(o|do|que|bom|ruim|esse) tempo\b/,
  air:
    /\b(aviao|avioes|aviac\w*|aeronave\w*|aircraft|airplanes?|planes?|voos?|flights?|trafego aereo|air traffic|opensky|callsigns?|aeroporto\w*|airports?|airlines?|companhias? aere\w*|helicopter\w*|helicopteros?|jatos?|jets?|ads b|transponder\w*|squawk)\b/,
};

/** "this / isso": the question is about the selected entity. */
const DEICTIC =
  /\b(isso|isto|this|that|esse|essa|esses|essas|nisso|disso|desse|dessa|nesse|nessa|selecionad\w*|selected|foco|focus|focad\w*)\b/;
/** Questions about the user's own profile (personal context only, no operational data). */
const PERSONAL =
  /\b(sobre mim|meus interesses|meu interesse|meu perfil|minhas preferencias|o que eu gosto|do que eu gosto|me conhece|about me|my interests|my profile|my preferences|what do i like|meus projetos|my projects|quem sou eu|who am i|eon|nyvorn|pixel art|worldbuilding)\b/;
/** Situational overview: always global, restricted to named domains when any. */
const GLOBAL_STRONG =
  /\b(atenc\w*|attention|merece\w*|deserves?|panorama|overview|visao geral|situac\w* (geral|atual|global)|(o que|oque) (esta|ta) acontecendo|what s happening|whats happening|what is happening|novidades?|what s new|whats new|destaques?|highlights?|briefing)\b/;
/** Summary words: global only when no domain is named ("resume o AURELIS" vs "resume o clima espacial"). */
const GLOBAL_WEAK = /\b(resum\w*|summar\w*|sintetiz\w*|aurelis|status geral|como (esta|anda|vai) tudo|tudo bem por ai)\b/;
/** Questions about data freshness/availability (adds source health). */
const FRESHNESS = /\b(fontes?|sources?|atualiz\w*|updated?|fresh|stale|frescor|disponiv\w*|available|availability|dados?|data|status|saude|health)\b/;

const FOCUS_DOMAIN: Record<AiFocusKind, AiDomain> = {
  iss: "space",
  earthquake: "disasters",
  eonet_event: "disasters",
  aircraft: "air",
};

function route(intent: AiIntent, domains: AiDomain[], state: RouterState, opts: { focus?: boolean; health?: boolean } = {}): AiRoute {
  const focusRelevant =
    state.focusKind !== null && (opts.focus === true || domains.includes(FOCUS_DOMAIN[state.focusKind]));
  const includeFocus = intent === "focus" ? state.focusKind !== null : focusRelevant && intent !== "global_situational";
  const budget =
    domains.length > 1 && intent !== "global_situational"
      ? Math.min(CONTEXT_BUDGET_TOKENS.space * domains.length, CONTEXT_BUDGET_TOKENS.global_situational)
      : CONTEXT_BUDGET_TOKENS[intent];
  return {
    intent,
    domains,
    includeFocus,
    focusKind: includeFocus ? state.focusKind : null,
    includePersonal: intent !== "greeting" && intent !== "unknown",
    includeSourceHealth: domains.length > 0 && (intent === "global_situational" || opts.health !== false),
    budgetTokens: budget,
  };
}

export function routeQuestion(message: string, state: RouterState): AiRoute {
  const text = normalizeMessage(message);
  if (!/[a-z0-9]/.test(text)) return route("unknown", [], state);
  if (isGreeting(text)) return route("greeting", [], state);

  const domains = AI_DOMAINS.filter((d) => DOMAIN_PATTERNS[d].test(text));
  const asksFreshness = FRESHNESS.test(text);

  if (PERSONAL.test(text) && domains.length === 0) return route("personal", [], state);

  if (DEICTIC.test(text)) {
    // About the selected entity (plus any domain the question names explicitly).
    if (state.focusKind) {
      const extra = domains.filter((d) => d !== FOCUS_DOMAIN[state.focusKind!]);
      return route("focus", extra, state, { focus: true, health: asksFreshness });
    }
    // Nothing selected: answer from what the question names, or say nothing is selected.
    if (domains.length === 0) return route("focus", [], state);
  }

  if (GLOBAL_STRONG.test(text)) return route("global_situational", domains.length ? domains : [...AI_DOMAINS], state);
  if (domains.length > 0) return route(domains[0], domains, state);
  if (GLOBAL_WEAK.test(text)) return route("global_situational", [...AI_DOMAINS], state);

  // No signal in the words: the panel the user is looking at decides.
  if (state.openPanel === "entity" && state.focusKind) return route("focus", [], state, { focus: true, health: false });
  if (state.openPanel && state.openPanel !== "entity") return route(state.openPanel, [state.openPanel], state);
  return route("general", [], state);
}

// Canonical ID convention — the single source of truth for requirement/ADR/
// constraint identifiers. Consumed by traceability.js, lint-ids.js, and
// consistency-gate.js so the regex lives in exactly one place (feedback E1).
//
// Accepted forms (permissive — feedback A1/A4):
//   FR-001  BR-002  NFR-003  AR-004  UAT-005  ADR-006  C-007
//   NFR-P1  NFR-S4  NFR-PR1            (category-lettered NFRs)
//   FR-003a                            (sub-id suffix letter)

const PREFIXES = ['FR', 'BR', 'NFR', 'AR', 'UAT', 'ADR', 'C'];
const PREFIX = '(?:' + PREFIXES.join('|') + ')';
const CAT = '[A-Z]{0,2}';                       // optional category letters, e.g. P, PR, S
const MEMBER = PREFIX + '-' + CAT + '\\d+[a-z]?';
const MEMBER_RE = new RegExp('^(' + PREFIXES.join('|') + ')-(' + CAT + ')(\\d+)([a-z]?)$');
const REQ_RE = /^(FR|BR|NFR)-/;

function parseMember(tok) {
  const m = String(tok == null ? '' : tok).match(MEMBER_RE);
  if (!m) return null;
  return { prefix: m[1], cat: m[2] || '', num: m[3], suf: m[4] || '' };
}

function classify(tok) {
  const m = parseMember(tok);
  return m ? m.prefix : null;
}

// Family = the constant part across a numeric range, WITH its trailing dash, so
// that `familyOf(id) + number === id`. FR-003 -> 'FR-', NFR-P1 -> 'NFR-P'.
function familyOf(id) {
  const m = parseMember(id);
  if (!m) return null;
  return `${m.prefix}-${m.cat}`;
}

// Remove code so example IDs shown in code never count as references (feedback IMP-1b).
// Fenced blocks first (multi-line), then inline spans. Used only for ID scanning.
function stripCode(text) {
  return String(text == null ? '' : text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ');
}

module.exports = { PREFIXES, PREFIX, CAT, MEMBER, MEMBER_RE, REQ_RE, parseMember, classify, familyOf, stripCode };

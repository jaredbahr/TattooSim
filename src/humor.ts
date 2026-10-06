/**
 * Deadpan asides sprinkled through the UI. The house style is "Bathroom was clean though":
 * a dry, irrelevant detail delivered with a straight face after something terrible.
 */

const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

export const HUMOR = {
  /** Under the "Done inking" button, one per client. */
  hudFinePrint: [
    "No undo. Tattoos are permanent. That's the whole thing.",
    'Needle sanitized. Probably.',
    'Gloves: on. Eye contact: off.',
    'Health inspector rating: B-. Bathroom: A+.',
    'Please do not narrate what you see.',
    'Remember to breathe. Through your mouth.',
    'Our lawyer says we have to say this: no refunds.',
  ],
  /** Title screen, small print under the tagline. */
  titleSmallPrint: [
    'Est. 1998. Bathroom is clean.',
    'Walk-ins welcome. Waddle-ins preferred.',
    'Voted "a tattoo shop" by a local newspaper.',
    'Now hiring. Must have strong stomach and steady hands.',
  ],
  /** Intro card, after the time limit. */
  introAside: [
    "Bathroom's down the hall if you need a minute.",
    'They signed the waiver. You did not read it either.',
    'Take a deep breath. Actually, maybe not.',
    'Lighting is great in here. Unfortunately.',
  ],
  /** Result card, "Aftercare" line. */
  aftercare: [
    'Keep it clean. Good luck with that.',
    'Avoid sitting for 6–8 weeks.',
    'Do not show your mother. She will ask questions.',
    'Apply ointment twice daily. Ask a friend. Lose a friend.',
    'No swimming, no saunas, no bike seats.',
    'Moisturize. You know where.',
  ],
  /** Shown instead of a payment when the client stiffs you. */
  refusedToPay: [
    'Refused to pay. Took a mint on the way out though.',
    'Refused to pay. Left a 1-star review and a 5-star review of the bathroom.',
    'Refused to pay. Paid for parking though.',
    'Refused to pay. Said "thank you" really quietly.',
  ],
  /** End-of-day "shop notes". */
  shopNotes: [
    'Bathroom was cleaned. Twice.',
    'Someone left a review of the bathroom. It was positive.',
    'Ran out of numbing cream around 2pm. Used ice and prayer.',
    'The landlord asked what we do here. We said "art."',
    'Mopped the floor. Did not ask why.',
    'A client left their pants. Lost & found is getting weird.',
  ],
  /** Leaderboard with no entries. */
  emptyBoard: [
    'Nobody yet. The bathroom is clean though.',
    'Empty. Like the waiting room. Like our hearts.',
  ],
} as const;

export function aside(kind: keyof typeof HUMOR): string {
  return pick(HUMOR[kind]);
}

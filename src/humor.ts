/**
 * All the jokes. House style: "Bathroom was clean though": a dry, irrelevant detail
 * delivered with a straight face after something terrible.
 *
 * Lines come out of shuffle bags: every line in a pool plays once before any repeats,
 * so people who play a lot keep seeing new stuff. Add lines freely; nothing else changes.
 */

/** Draws every item once in random order, then reshuffles. Never repeats back-to-back. */
export class ShuffleBag<T> {
  private queue: T[] = [];
  private last: T | undefined;

  constructor(private readonly items: readonly T[], private readonly rand: () => number = Math.random) {
    if (!items.length) throw new Error('ShuffleBag needs at least one item');
  }

  next(): T {
    if (!this.queue.length) {
      this.queue = [...this.items];
      for (let i = this.queue.length - 1; i > 0; i--) {
        const j = Math.floor(this.rand() * (i + 1));
        [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
      }
      // Avoid the same line twice in a row across a reshuffle.
      if (this.queue.length > 1 && this.queue[this.queue.length - 1] === this.last) {
        [this.queue[0], this.queue[this.queue.length - 1]] = [this.queue[this.queue.length - 1], this.queue[0]];
      }
    }
    this.last = this.queue.pop()!;
    return this.last;
  }
}

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
    'If you can read this, you are too close.',
    'Ink is non-toxic. Situation is not.',
    'Steady hands. Weak stomach. Classic combo.',
  ],
  /** Title screen, small print under the tagline. */
  titleSmallPrint: [
    'Est. 1998. Bathroom is clean.',
    'Walk-ins welcome. Waddle-ins preferred.',
    'Voted "a tattoo shop" by a local newspaper.',
    'Now hiring. Must have strong stomach and steady hands.',
    'Proudly serving the community from behind.',
    'Ask about our loyalty card. Ten tattoos, one free mint.',
    'Formerly a Quiznos.',
  ],
  /** Intro card, after the time limit. */
  introAside: [
    "Bathroom's down the hall if you need a minute.",
    'They signed the waiver. You did not read it either.',
    'Take a deep breath. Actually, maybe not.',
    'Lighting is great in here. Unfortunately.',
    'They specifically asked for "the good needle."',
    'Their emergency contact is "no one, please."',
    'They paid a deposit in quarters.',
  ],
  /** Result card, "Aftercare" line. */
  aftercare: [
    'Keep it clean. Good luck with that.',
    'Avoid sitting for 6–8 weeks.',
    'Do not show your mother. She will ask questions.',
    'Apply ointment twice daily. Ask a friend. Lose a friend.',
    'No swimming, no saunas, no bike seats.',
    'Moisturize. You know where.',
    'Wear loose pants. Or none. We are not your boss.',
    'If it itches, do NOT scratch in public.',
    'Avoid direct sunlight. Should be easy.',
  ],
  /** Shown instead of a payment when the client stiffs you. */
  refusedToPay: [
    'Refused to pay. Took a mint on the way out though.',
    'Refused to pay. Left a 1-star review and a 5-star review of the bathroom.',
    'Refused to pay. Paid for parking though.',
    'Refused to pay. Said "thank you" really quietly.',
    'Refused to pay. Offered exposure instead.',
    'Refused to pay. Tried to pay in Applebee\'s gift cards.',
  ],
  /** End-of-day "shop notes". */
  shopNotes: [
    'Bathroom was cleaned. Twice.',
    'Someone left a review of the bathroom. It was positive.',
    'Ran out of numbing cream around 2pm. Used ice and prayer.',
    'The landlord asked what we do here. We said "art."',
    'Mopped the floor. Did not ask why.',
    'A client left their pants. Lost & found is getting weird.',
    'Mom called. Told her we do "lower back work."',
    'The mop got Employee of the Month again.',
    'Neighbor complained about the screaming. Gave him a coupon.',
    'Health inspector visited. Stayed for a tattoo.',
  ],

  /** Said by the client while they get ready to drop trou. */
  arrival: [
    '*unbuckles*',
    'Okay. Okay okay okay.',
    "Don't look. I mean, do. That's the job.",
    'Here goes nothing.',
    "Pants? Where we're going we don't need pants.",
    'I shaved. Kind of. Partially.',
    'Is it cold in here or is it just me? It is me.',
    'I did not eat beans today. You are welcome.',
    "Just so you know, I've never done this. Well. Never sober.",
    'Do I bend? I bend. Okay. Bending.',
  ],
  /** Pain quips by tier: fine, struggling, broken. */
  painLow: [
    'Tickles a bit.', 'Is that it?', "This isn't so bad.", '*hums nervously*',
    'Feels like a cat walking on me.', 'Honestly kind of relaxing.', "My dentist is worse.",
  ],
  painMid: [
    'Hnnngh.', 'Okay, okay, OKAY.', 'Are you using a fork?', 'Talk to me about anything else.',
    'Tell me about your day. Please.', 'Is it supposed to feel spicy?', "I'm fine. I'm FINE.",
  ],
  painHigh: [
    'MOMMY.', 'WHY IS IT VIBRATING', "I can see colors that don't exist", 'I regret EVERYTHING',
    'TELL MY KIDS I LOVE THEM', 'I can hear the needle in my teeth', 'IS THIS A CRIME? IT FEELS LIKE A CRIME.',
  ],
  /** Shouted on a flinch. */
  flinch: [
    'OW!', 'YEOWCH!', 'SWEET MOTHER OF—', '*involuntary clench*', 'NOT THE HOLE!',
    'MY ANCESTORS FELT THAT', 'WHAT WAS THAT', 'Nope nope nope nope',
  ],
  /** Hole jobs: when it winks. */
  wink: [
    '*wink*', '*pucker*', 'Sorry, it does that.', "It's nervous. We're both nervous.",
    'It likes you.', 'Ignore it. It wants attention.', '*blink*',
  ],
  /** Shown the first time the client is bent over and you start (not tutorial). */
  start: [
    'Be gentle.', "I'm ready. I'm not ready.", 'Do your worst. Wait. Do your best.',
    "Don't tell me when you start.", 'Is the door locked? Lock the door.', 'Whenever you are. Take your time. No, hurry.',
  ],
} as const;

export type HumorKind = keyof typeof HUMOR;

const bags = new Map<HumorKind, ShuffleBag<string>>();

/** Next line from a pool, no repeats until the pool is exhausted. */
export function aside(kind: HumorKind): string {
  let bag = bags.get(kind);
  if (!bag) {
    bag = new ShuffleBag(HUMOR[kind]);
    bags.set(kind, bag);
  }
  return bag.next();
}

/** Mid-tattoo side gags. `lines` play in sequence; `effect` is what it does to the client. */
export interface SideGag {
  lines: string[];
  effect: 'jolt' | 'clench' | 'squirm' | 'none';
}

export const SIDE_GAGS: SideGag[] = [
  { lines: ['*ah... AH...*', '*AHHH-CHOOO*'], effect: 'jolt' },
  { lines: ['*sniff* ...is it dusty in here?', '*ACHOO*', 'Sorry. Bless me.'], effect: 'jolt' },
  { lines: ['💨 *pffft*', 'Sorry. Nerves.'], effect: 'clench' },
  { lines: ['💨 *toot*', "That wasn't me. That was... the bench."], effect: 'clench' },
  { lines: ['💨 *brrrap*', 'Okay that one was me.', 'Keep going. Be brave.'], effect: 'clench' },
  { lines: ['*bzzt bzzt*', "It's my mom. Should I get it?", "I'm not getting it."], effect: 'squirm' },
  { lines: ['*ringtone: Who Let The Dogs Out*', 'Hold on, I gotta— no. No. Keep going.'], effect: 'squirm' },
  { lines: ['Are we almost done?', 'Asking for my butt.'], effect: 'none' },
  { lines: ['So... come here often?', 'Oh. Right. You work here.'], effect: 'none' },
  { lines: ['Mind if I eat? *crunch*', 'Want a Funyun?'], effect: 'none' },
  { lines: ['Is that a mirror on the ceiling?', "...why is there a mirror on the ceiling?"], effect: 'none' },
  { lines: ['Quick question. Is it supposed to smell like that?', 'Never mind.'], effect: 'none' },
  { lines: ['*starts humming the Jeopardy theme*'], effect: 'none' },
  { lines: ['Can you make it a little sexier?', 'Not the tattoo. The situation.'], effect: 'none' },
  { lines: ['Hold on, leg cramp.', 'LEG CRAMP. LEG CRAMP.'], effect: 'squirm' },
  { lines: ['*hiccup*', '*hic*', '*HIC*'], effect: 'jolt' },
];

const gagBag = new ShuffleBag(SIDE_GAGS);
export function nextSideGag(): SideGag {
  return gagBag.next();
}

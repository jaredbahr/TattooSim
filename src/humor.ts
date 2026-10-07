/**
 * All the jokes. House style: deadpan and butt-forward. Keep it varied: a running gag
 * should show up once, not in every pool (the bathroom bit lives in one review only).
 * Feelings belong to people: don't give objects or body parts thoughts or emotions.
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
    'Health inspector rating: B. As in Butt.',
    'Pro tip: the crack is not a guideline.',
    'We have your back. Lower.',
    'Please do not narrate what you see.',
    'Remember to breathe. Through your mouth.',
    'Our lawyer says we have to say this: no refunds.',
    'If you can read this, you are too close.',
    'Ink is non-toxic. Situation is not.',
    'Steady hands. Weak stomach. Classic combo.',
  ],
  /** Title screen, small print under the tagline. */
  titleSmallPrint: [
    'Est. 1998. Under new management. Same bench.',
    'Walk-ins welcome. Waddle-ins preferred.',
    'Voted "a tattoo shop" by a local newspaper.',
    'Now hiring. Must have strong stomach and steady hands.',
    'Proudly serving the community from behind.',
    'Ask about our loyalty card. Ten tattoos, one free donut cushion.',
    'Formerly a Quiznos.',
  ],
  /** Intro card, after the time limit. */
  introAside: [
    'They tipped in advance. That is never a good sign.',
    'They asked for "the good needle." There is one needle.',
    'Their emergency contact is listed as "no one, please."',
    'They paid the deposit in quarters. Warm quarters.',
    'They googled "how long do butt tattoos take" in the waiting room.',
    'Their friend tried to film from the doorway. Their friend has been removed.',
    'They asked if you have done this before. You said "define before."',
    'They signed the waiver without reading it. So did you.',
  ],
  /** Shown instead of a payment when the client stiffs you. */
  refusedToPay: [
    'Refused to pay. Took a mint on the way out though.',
    'Refused to pay. Mooned the parking lot on the way out.',
    'Refused to pay. Paid for parking though.',
    'Refused to pay. Said "thank you" really quietly.',
    'Refused to pay. Offered exposure instead.',
    'Refused to pay. Tried to pay in Applebee\'s gift cards.',
  ],
  /** End-of-day "shop notes". */
  shopNotes: [
    'Ordered donut cushions in bulk. Again.',
    'Two clients compared tattoos in the lobby. Back to back. Literally.',
    'Tried a "Bottoms Up" happy hour. Nobody understood it.',
    'Ran out of numbing cream around 2pm. Used ice and prayer.',
    'The landlord asked what we do here. We said "art."',
    'Mopped the floor. Did not ask why.',
    'A client left their pants. Lost & found is getting weird.',
    'Mom called. Told her we do "lower back work."',
    'Ran a two-for-one cheek special. The math got weird.',
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
    '*wink*', '*pucker*', 'Sorry, it does that.', "I can't control that. Medically.",
    'Ignore that.', 'That was involuntary. Mostly.', '*blink*',
  ],
  /** Shown the first time the client is bent over and you start (not tutorial). */
  start: [
    'Be gentle.', "I'm ready. I'm not ready.", 'Do your worst. Wait. Do your best.',
    "Don't tell me when you start.", 'Is the door locked? Lock the door.', 'Whenever you are. Take your time. No, hurry.',
  ],
  /** "Surprise me" clients: what they say walking in. */
  surpriseRequest: [
    'Surprise me.',
    "Dealer's choice. Go nuts. I trust you. Probably a mistake.",
    'Whatever speaks to you. Just... speak quietly.',
    "I don't care what it is. Make it mean something. Or don't.",
    'Freestyle it. I want to be surprised in the mirror.',
    'Something with a lot of meaning. You pick the meaning.',
  ],
  /** Mind-changers, mid-job. {d} = the new design. */
  mindChange: [
    'Actually... can you make it a {d} instead?',
    'Wait. WAIT. Change of plans. {D}.',
    'My partner just texted. Make it a {d}.',
    "I've been thinking about it. It's a {d} now.",
    'Sorry, sorry, I panicked. {D}. Final answer.',
    'You know what would be funnier? A {d}.',
  ],
  /** Surprise-me reactions by how the vibes landed. */
  surpriseGood: [
    "I don't know what it is, but it's PERFECT.",
    'I was surprised. In a good way. I think.',
    "It's like you looked into my soul. From behind.",
    "Nobody's going to understand it. That's the point.",
    'This is what I would have asked for if I knew what to ask for.',
  ],
  surpriseMid: [
    'Huh. Okay. Yeah. Okay.',
    "It's a choice. You made a choice.",
    "I'll tell people it's abstract.",
    "I'm going to need a minute. Maybe a week.",
    'Bold. Confusing. Mine forever.',
  ],
  surpriseBad: [
    'I said surprise me. Not traumatize me.',
    "That's not a surprise. That's an ambush.",
    'I take back the trust.',
    'I wanted a surprise party, not a crime scene.',
    'You had total creative freedom and you chose THIS.',
  ],
  /** Surprise-me with (almost) no ink. */
  surpriseNothing: [
    'You did... nothing? Bold. I hate it. I respect it.',
    "It's invisible. Like my dad.",
    'Minimalist. I paid for minimalism.',
    'A blank canvas. I already HAD a blank canvas.',
    "I've never felt so seen. Or so un-inked.",
  ],
  /** Returning cover-up clients, walking in. */
  returnArrival: [
    'Remember me?',
    'We need to talk about what you did.',
    'My doctor sent me back. He was very specific.',
    "I've been sitting on this for a while. Painfully.",
    'Hi. Again. Unfortunately.',
    'You might not recognize my face. You will recognize the rest.',
  ],
  /** "Fix it" requests. {d} = the original design. */
  returnFix: [
    'You did this. Fix it. It was supposed to be a {d}.',
    'This was a {d}. Allegedly. Make it a {d}.',
    "My family thinks it's a rash. It's a {d}. Make it look like one.",
    "I'm giving you one more chance. {D}. Like we agreed.",
    'Finish the {d}. I am begging you.',
  ],
  /** Blackout requests: the old one was beyond saving. */
  returnBlackout: [
    'Just black it out. Big solid heart. Erase the past.',
    'I need it gone. Make it one big black heart. Fill every inch.',
    "My lawyer says 'cover it.' A solid heart. Now.",
    'There is no fixing that. Paint it black. Heart-shaped.',
    "I can't look at it anymore. Neither can anyone else. Solid heart.",
  ],
  /** Boss: the bodybuilder, mid-flex. */
  bossFlex: [
    '*FLEX*', 'Do you even lift?', 'Sorry. Muscle memory.', "Can't help it. Leg day was yesterday.",
    'Is it getting bigger? It is. You are welcome.', '*involuntary pose*',
  ],
  /** Boss: grandma's never-ending stories. */
  bossGrandma: [
    "Did I ever tell you about my second husband? Well, he had a tattoo just like this, except it was on his—",
    "In my day we didn't have tattoos, we had DISCIPLINE, and also one tattoo, of a sailor, long story—",
    'My grandson says this is "fire." I told him the fire was in 1974 and we are not discussing it—',
    "Oh, you remind me of my friend Doris. She passed. Not from this. Well, partly from this—",
    "Now don't tell my bridge club. Actually tell them. Tell them EVERYTHING—",
    'This reminds me of the war. Not a specific war. Just war in general—',
    "I knit you a scarf. It's in my purse. Don't look in my purse—",
  ],
  /** Boss: the influencer, filming. */
  bossInfluencer: [
    '*click* Content!',
    'Can you hold the needle, like, more aesthetically?',
    'Hey guys, welcome back to my channel. Today we are getting a butt tattoo—',
    "*flash* Sorry, that's for the thumbnail.",
    "Can you look shocked? Like, more shocked? Perfect.",
    'Smash that like button. Not the butt. The button.',
  ],
  /** Couples, walking in. {d} = the design. */
  coupleRequest: [
    "We want matching {d}s. It's our anniversary.",
    'Matching {d}s. Our therapist said to try something new together.',
    "Two {d}s. Identical. If mine's better, I win the divorce.",
    "We're getting matching {d}s instead of a wedding. Cheaper.",
    "Couple's special. One {d} each. Make them twins.",
  ],
  coupleGood: [
    "They match! We're never breaking up now. Legally we can't.",
    "Look, babe! We're a set!",
    'Perfectly matched. Like us. Mostly.',
    'This is more romantic than our wedding.',
    'Twins! Butt twins!',
  ],
  coupleBad: [
    "We're going to need couples counseling. And a dermatologist.",
    'Well. At least we match. In being bad.',
    'Neither of us looks good. Which is fair, I guess.',
    'I married you for better or worse. This is worse.',
    "Our anniversary is ruined. And so are our butts.",
  ],
  /** One partner came out clearly better. {better}, {worse} = names. */
  coupleMismatch: [
    "Why is {better}'s nicer than mine?!",
    "{better} got the good one. Of course {better} got the good one.",
    "{worse} is never going to let this go. Neither is {better}.",
    "So {better} gets art and {worse} gets a crime scene. Cool. Cool cool cool.",
    "We said MATCHING. {worse}'s looks like a rough draft of {better}'s.",
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
  { lines: ['Are we almost done?', "I can't feel my legs."], effect: 'none' },
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

/**
 * End-of-day newspaper: "The Daily Cheek" covers the day's worst job (or, on a great
 * day, the best one). Pure string generation so it's easy to test and extend.
 */
import { ShuffleBag } from './humor';

export interface StoryInput {
  clientName: string;
  sex: 'f' | 'm';
  designName: string;
  score: number;
}

export interface FrontPage {
  headline: string;
  subhead: string;
  sidebar: string;
  classified: string;
}

/** What a botched design "actually" looks like, according to witnesses. */
const MISREADS = new ShuffleBag([
  'a chicken', 'a tax form', 'a spilled lasagna', 'a weather map', 'a sneeze',
  'the state of Ohio', 'a sad pretzel', 'a parking ticket', 'modern art', 'a mistake',
]);

const BAD_HEADLINES = new ShuffleBag([
  "LOCAL ARTIST INKS '{D}', CLIENT DESCRIBES '{X}'",
  "{NAME} REQUESTED {D}; RECEIVED WHAT EXPERTS CALL '{X}'",
  "AREA {PERSON} GETS {D} TATTOO, MAY NEVER SIT AGAIN",
  "WITNESSES CALL {NAME}'S {D} 'DEEPLY UPSETTING'",
  "{D} TATTOO MISTAKEN FOR {X} AT PUBLIC POOL",
  "CITY COUNCIL TO DISCUSS {NAME}'S REAR IN EMERGENCY SESSION",
]);

const GOOD_HEADLINES = new ShuffleBag([
  "{NAME}'S {D} DRAWS CROWD AT PUBLIC POOL",
  'CHEEKY BUSINESS NAMED "BEST IN BEHIND" FOR THIRD STRAIGHT YEAR',
  "LOCAL {PERSON} REFUSES TO WEAR PANTS, CITES 'GALLERY HOURS'",
  "MUSEUM CURATOR ASKS {NAME} TO 'PLEASE STOP BENDING OVER IN THE LOBBY'",
]);

const SUBHEADS_BAD = new ShuffleBag([
  'Artist "stands by" the work. Client stands, period.',
  'Family asks for privacy, pants.',
  'Doctors confirm it is "technically a tattoo."',
  'Insurance does not cover "whatever that is."',
]);

const SUBHEADS_GOOD = new ShuffleBag([
  'Lines "crisp," client "thrilled," parking lot "mooned."',
  'Critics call it "a triumph of the posterior arts."',
  'Client reportedly now does all errands in assless chaps.',
]);

const SIDEBARS = new ShuffleBag([
  'WEATHER: Cheeky, with a chance of moons.',
  'SPORTS: Local man clenches through entire Little League game.',
  'OPINION: Are we sitting too much? A rear view.',
  'BUSINESS: Donut cushion stocks hit record high.',
  'HEALTH: Doctors urge public to "please stop asking about the tattoo."',
  'LOCAL: Gym installs mirror at waist height "for safety reasons."',
]);

const CLASSIFIEDS = new ShuffleBag([
  'LOST: Pants. Reward. No questions.',
  'FOR SALE: Bench, lightly used. Very lightly. Okay, heavily.',
  'WANTED: Laser removal tech. Urgent. Will pay in quarters.',
  'SEEKING: Person who saw my tattoo at the pool. You know what you did.',
  'FREE: Donut cushion. Do not ask why.',
]);

function fill(t: string, s: StoryInput, misread: string): string {
  return t
    .replaceAll('{D}', s.designName.toUpperCase())
    .replaceAll('{NAME}', s.clientName.toUpperCase())
    .replaceAll('{PERSON}', s.sex === 'f' ? 'WOMAN' : 'MAN')
    .replaceAll('{X}', misread.toUpperCase());
}

/** Build the front page. `story` should be the day's worst job; good days get happy news. */
export function frontPage(story: StoryInput): FrontPage {
  const good = story.score >= 80;
  const misread = MISREADS.next();
  return {
    headline: fill((good ? GOOD_HEADLINES : BAD_HEADLINES).next(), story, misread),
    subhead: (good ? SUBHEADS_GOOD : SUBHEADS_BAD).next(),
    sidebar: SIDEBARS.next(),
    classified: CLASSIFIEDS.next(),
  };
}

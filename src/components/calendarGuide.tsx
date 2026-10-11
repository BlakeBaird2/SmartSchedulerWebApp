/**
 * Where to find the calendar link in each app, and what SmartScheduler does with each kind
 * of calendar. Shared by the setup screens and the home page, so nothing here
 * points at a particular spot on either one.
 */
import type { Provider } from "@/lib/types";

export interface LinkSteps {
  name: string;
  steps: React.ReactNode[];
  note?: string;
}

export interface LinkHelp extends LinkSteps {
  id: Provider;
  /** Short name, for tabs. */
  label: string;
}

export const LINK_HELP: LinkHelp[] = [
  {
    id: "canvas",
    label: "Canvas",
    name: "Canvas",
    steps: [
      "Open Canvas and go to Calendar in the left menu.",
      <>
        At the bottom of the right-hand column, click <b>Calendar Feed</b>.
      </>,
      "Copy the link it shows. One link covers all of your Canvas classes.",
    ],
    note: "SmartScheduler sorts the feed into classes automatically, and each assignment links straight back to Canvas.",
  },
  {
    id: "learningsuite",
    label: "Learning Suite",
    name: "Learning Suite",
    steps: [
      "Open the course in Learning Suite and go to its Schedule.",
      "Find the calendar (iCal) subscription link and copy it.",
      <>
        It looks like{" "}
        <span className="font-mono text-[0.8em] break-words">
          learningsuite.byu.edu/
          <wbr />
          iCalFeed/
          <wbr />
          ical.php?courseID=…
        </span>{" "}
        Each course has its own link, so add one per class.
      </>,
    ],
    note: "Each course calendar becomes one class. If one shows up without its course code, you can rename it (for example to FIN 201).",
  },
  {
    id: "google",
    label: "Google",
    name: "Google Calendar",
    steps: [
      "On a computer, open Google Calendar and click the gear, then Settings.",
      "Under “Settings for my calendars”, pick the calendar.",
      <>
        In <b>Integrate calendar</b>, copy the <b>Secret address in iCal format</b>.
      </>,
    ],
    note: "Use the secret address, not the “public address”: the public one only works for calendars shared with everyone. School and work Google accounts sometimes have this turned off by an administrator.",
  },
  {
    id: "outlook",
    label: "Outlook",
    name: "Outlook",
    steps: [
      "Open Outlook on the web, then Settings → Calendar → Shared calendars.",
      <>
        Under <b>Publish a calendar</b>, pick your calendar and “Can view all details”, then Publish.
      </>,
      <>
        Copy the <b>ICS</b> link.
      </>,
    ],
    note: "“Can view when I'm busy” also works if you'd rather not share titles. Outlook can take a few hours to publish changes.",
  },
  {
    id: "icloud",
    label: "Apple",
    name: "Apple Calendar",
    steps: [
      "In the Calendar app (or iCloud.com), open the calendar's sharing settings.",
      <>
        Turn on <b>Public Calendar</b> and copy the link. A webcal:// link is fine.
      </>,
    ],
    note: "Anyone who has an Apple public calendar link can view it, so keep it to yourself.",
  },
  {
    id: "other",
    label: "Other",
    name: "Anything else",
    steps: [
      "Any calendar that gives you an iCal, ICS or webcal link works: work rosters, sports schedules, clubs.",
      "SmartScheduler guesses whether it holds coursework or just busy time. You can switch it after adding.",
    ],
  },
];

const help = (id: Provider) => LINK_HELP.find((h) => h.id === id)!;

export type CalendarKindId = "school" | "work" | "personal";

export interface CalendarKind {
  id: CalendarKindId;
  label: string;
  color: string;
  /** What SmartScheduler does with this kind of calendar. */
  does: string;
  cards: LinkSteps[];
}

/** The calendars people bring, by what they're for. */
export const CALENDAR_KINDS: CalendarKind[] = [
  {
    id: "school",
    label: "School",
    color: "#4f46e5",
    does: "SmartScheduler pulls in every assignment, quiz and exam, sorted by class.",
    cards: [
      help("canvas"),
      help("learningsuite"),
      {
        name: "Other course sites",
        steps: ["Look on the course site for a calendar, iCal or “subscribe” link.", "Copy it. Each course calendar becomes one class."],
        note: "Class calendars rarely say when class meets. SmartScheduler asks for your class times during setup.",
      },
    ],
  },
  {
    id: "work",
    label: "Work",
    color: "#0f766e",
    does: "SmartScheduler plans around your work schedule and meetings, so homework never lands on top of them.",
    cards: [
      help("outlook"),
      help("google"),
      {
        name: "Scheduling apps",
        steps: ["In your scheduling app's settings, look for “Calendar sync”, “Subscribe” or an iCal / webcal link.", "Copy the link."],
        note: "No link at all? Add your work hours as a weekly busy time during setup.",
      },
    ],
  },
  {
    id: "personal",
    label: "Personal",
    color: "#9333ea",
    does: "SmartScheduler plans around everything else you have going on, so the free time it finds is really free.",
    cards: [
      help("google"),
      help("icloud"),
      {
        name: "Anything else",
        steps: ["Sports schedules, clubs, a shared family calendar: any calendar with an iCal, ICS or webcal link works."],
        note: "Outlook works for personal calendars too, with the same steps as under Work.",
      },
    ],
  },
];

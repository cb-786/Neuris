import {
  Activity,
  AudioLines,
  CircleUser,
  Clock3,
  Radar,
  Settings2,
  ShieldHalf,
  Waypoints,
} from 'lucide-react';

/**
 * NEURIS navigation.
 *
 * Grouped by what the user is doing, not by which screen the code lives in:
 * MEMORY is the act of using memory, TRACES is looking back through it, and
 * SYSTEM is everything about the machinery. Recall and Capture lead because
 * they are the two modes the whole product is built around.
 *
 * `key` is the digit that jumps to the route; `short` is the mobile bar label.
 */
export const NAV_SECTIONS = [
  {
    label: 'Memory',
    items: [
      {
        to: '/',
        label: 'Recall',
        short: 'Recall',
        icon: Radar,
        end: true,
        key: '1',
        blurb: 'Ask what NEURIS remembers',
        primary: true,
      },
      {
        to: '/capture',
        label: 'Capture',
        short: 'Capture',
        icon: AudioLines,
        key: '2',
        blurb: 'Record a conversation',
        primary: true,
      },
      {
        to: '/space',
        label: 'Memory Space',
        short: 'Space',
        icon: Waypoints,
        key: '3',
        blurb: 'Everything, connected',
        primary: true,
      },
    ],
  },
  {
    label: 'Traces',
    items: [
      {
        to: '/timeline',
        label: 'Timeline',
        short: 'Timeline',
        icon: Clock3,
        key: '4',
        blurb: 'Memories in order',
        primary: true,
      },
      {
        to: '/people',
        label: 'People',
        short: 'People',
        icon: CircleUser,
        key: '5',
        blurb: 'Who you spoke with',
      },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/insights', label: 'Insights', short: 'Insights', icon: Activity, key: '6', blurb: 'How memory is growing' },
      { to: '/privacy', label: 'Privacy', short: 'Privacy', icon: ShieldHalf, key: '7', blurb: 'Where your voice goes' },
      { to: '/settings', label: 'Settings', short: 'Settings', icon: Settings2, key: '8', blurb: 'Backend and capture' },
    ],
  },
];

export const FLAT_NAV = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, section: section.label }))
);

/** The four that earn a slot in the mobile bar; the rest live behind More. */
export const PRIMARY_NAV = FLAT_NAV.filter((item) => item.primary);

export function matchNav(pathname) {
  return (
    FLAT_NAV.find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to))) ??
    FLAT_NAV[0]
  );
}

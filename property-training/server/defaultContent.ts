import type { BoardSpace, GameCard, GameContent } from './types.js';

/** Classic 40-space layout with horse-training themed defaults (fully editable by host). */
export const DEFAULT_SPACES: BoardSpace[] = [
  { id: 0, kind: 'go', name: 'Starting Gate' },
  { id: 1, kind: 'property', name: 'Dirt Warmup Lane', price: 60, rent: 2, group: 'dirt-a', color: '#8B5A2B' },
  { id: 2, kind: 'community', name: 'Stable Memo' },
  { id: 3, kind: 'property', name: 'Morning Jog Path', price: 60, rent: 4, group: 'dirt-a', color: '#8B5A2B' },
  { id: 4, kind: 'tax', name: 'Entry Fee', taxAmount: 200 },
  { id: 5, kind: 'rail', name: 'Tokyo Transport', price: 200, rent: 25 },
  { id: 6, kind: 'property', name: 'Turf Stretch A', price: 100, rent: 6, group: 'turf-a', color: '#2F6B3A' },
  { id: 7, kind: 'chance', name: 'Race Day Draw' },
  { id: 8, kind: 'property', name: 'Turf Stretch B', price: 100, rent: 6, group: 'turf-a', color: '#2F6B3A' },
  { id: 9, kind: 'property', name: 'Turf Stretch C', price: 120, rent: 8, group: 'turf-a', color: '#2F6B3A' },
  { id: 10, kind: 'jail', name: 'Rest Box' },
  { id: 11, kind: 'property', name: 'Sprint Hill', price: 140, rent: 10, group: 'hill', color: '#3B6EA5' },
  { id: 12, kind: 'utility', name: 'Feed Mill', price: 150, rent: 0 },
  { id: 13, kind: 'property', name: 'Corner Curve', price: 140, rent: 10, group: 'hill', color: '#3B6EA5' },
  { id: 14, kind: 'property', name: 'Home Stretch Rise', price: 160, rent: 12, group: 'hill', color: '#3B6EA5' },
  { id: 15, kind: 'rail', name: 'Osaka Transport', price: 200, rent: 25 },
  { id: 16, kind: 'property', name: 'Shoreline Mile', price: 180, rent: 14, group: 'shore', color: '#C45C26' },
  { id: 17, kind: 'community', name: 'Stable Memo' },
  { id: 18, kind: 'property', name: 'Sea Breeze Track', price: 180, rent: 14, group: 'shore', color: '#C45C26' },
  { id: 19, kind: 'property', name: 'Harbor Finish', price: 200, rent: 16, group: 'shore', color: '#C45C26' },
  { id: 20, kind: 'free', name: 'Winner’s Circle' },
  { id: 21, kind: 'property', name: 'Night Practice Oval', price: 220, rent: 18, group: 'night', color: '#B33A3A' },
  { id: 22, kind: 'chance', name: 'Race Day Draw' },
  { id: 23, kind: 'property', name: 'Floodlight Lane', price: 220, rent: 18, group: 'night', color: '#B33A3A' },
  { id: 24, kind: 'property', name: 'Midnight Derby', price: 240, rent: 20, group: 'night', color: '#B33A3A' },
  { id: 25, kind: 'rail', name: 'Kyoto Transport', price: 200, rent: 25 },
  { id: 26, kind: 'property', name: 'Mountain Pass', price: 260, rent: 22, group: 'mountain', color: '#E8C547' },
  { id: 27, kind: 'property', name: 'Alpine Mile', price: 260, rent: 22, group: 'mountain', color: '#E8C547' },
  { id: 28, kind: 'utility', name: 'Water Station', price: 150, rent: 0 },
  { id: 29, kind: 'property', name: 'Summit Trial', price: 280, rent: 24, group: 'mountain', color: '#E8C547' },
  { id: 30, kind: 'gotojail', name: 'Sent to Rest Box' },
  { id: 31, kind: 'property', name: 'Grand Lawn', price: 300, rent: 26, group: 'grand', color: '#2E8B57' },
  { id: 32, kind: 'property', name: 'Pavilion Row', price: 300, rent: 26, group: 'grand', color: '#2E8B57' },
  { id: 33, kind: 'community', name: 'Stable Memo' },
  { id: 34, kind: 'property', name: 'Clubhouse Gate', price: 320, rent: 28, group: 'grand', color: '#2E8B57' },
  { id: 35, kind: 'rail', name: 'Sapporo Transport', price: 200, rent: 25 },
  { id: 36, kind: 'chance', name: 'Race Day Draw' },
  { id: 37, kind: 'property', name: 'Championship Mile', price: 350, rent: 35, group: 'champ', color: '#1F4E79' },
  { id: 38, kind: 'tax', name: 'Trainer License Tax', taxAmount: 100 },
  { id: 39, kind: 'property', name: 'Crown Stakes', price: 400, rent: 50, group: 'champ', color: '#1F4E79' },
];

export const DEFAULT_CHANCE: GameCard[] = [
  { id: 'ch1', text: 'Advance to Starting Gate. Collect ¥200.', effect: { type: 'move', position: 0 } },
  { id: 'ch2', text: 'Sprint to Crown Stakes.', effect: { type: 'move', position: 39 } },
  { id: 'ch3', text: 'Take a recovery day in the Rest Box.', effect: { type: 'jail' } },
  { id: 'ch4', text: 'Sponsor bonus! Collect ¥150.', effect: { type: 'money', amount: 150 } },
  { id: 'ch5', text: 'Equipment upgrade costs ¥50.', effect: { type: 'money', amount: -50 } },
  { id: 'ch6', text: 'Back up 3 spaces.', effect: { type: 'move_relative', steps: -3 } },
  { id: 'ch7', text: 'Advance to nearest Transport hub.', effect: { type: 'nearest_rail' } },
  { id: 'ch8', text: 'Get out of Rest Box free. Keep until needed.', effect: { type: 'get_out_of_jail' } },
  { id: 'ch9', text: 'Fan meetup! Collect ¥100.', effect: { type: 'money', amount: 100 } },
  { id: 'ch10', text: 'Fine for false start: pay ¥30.', effect: { type: 'money', amount: -30 } },
];

export const DEFAULT_COMMUNITY: GameCard[] = [
  { id: 'cm1', text: 'Advance to Starting Gate. Collect ¥200.', effect: { type: 'move', position: 0 } },
  { id: 'cm2', text: 'Stable fund dividend: collect ¥100.', effect: { type: 'money', amount: 100 } },
  { id: 'cm3', text: 'Doctor visit: pay ¥50.', effect: { type: 'money', amount: -50 } },
  { id: 'cm4', text: 'Inheritance from a legendary trainer: ¥200.', effect: { type: 'money', amount: 200 } },
  { id: 'cm5', text: 'Pay training camp fees: ¥100.', effect: { type: 'money', amount: -100 } },
  { id: 'cm6', text: 'Beauty sleep in the Rest Box.', effect: { type: 'jail' } },
  { id: 'cm7', text: 'Get out of Rest Box free.', effect: { type: 'get_out_of_jail' } },
  { id: 'cm8', text: 'Sale of old tack: collect ¥45.', effect: { type: 'money', amount: 45 } },
  { id: 'cm9', text: 'Income tax refund: collect ¥20.', effect: { type: 'money', amount: 20 } },
  { id: 'cm10', text: 'Birthday cake from the team: collect ¥10 from each vibe — take ¥50.', effect: { type: 'money', amount: 50 } },
];

export function defaultContent(): GameContent {
  return {
    properties: structuredClone(DEFAULT_SPACES),
    chance: structuredClone(DEFAULT_CHANCE),
    community: structuredClone(DEFAULT_COMMUNITY),
  };
}

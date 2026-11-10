import type { BoardSpace, GameCard, GameContent } from './types.js';

/** Classic 40-space layout with horse-training themed defaults (fully editable by host). */
export const DEFAULT_SPACES: BoardSpace[] = [
  { id: 0, kind: 'go', name: 'Collect Race Earnings' },
  { id: 1, kind: 'property', name: "Tama's House", price: 60, rent: 2, group: 'dirt-a', color: '#8B5A2B' },
  { id: 2, kind: 'community', name: 'Raffle Ticket' },
  { id: 3, kind: 'property', name: 'The Stump', price: 60, rent: 4, group: 'dirt-a', color: '#8B5A2B' },
  { id: 4, kind: 'tax', name: 'Race Entry Fee', taxAmount: 200 },
  { id: 5, kind: 'rail', name: 'Exile 1', price: 200, rent: 25 },
  { id: 6, kind: 'property', name: 'Haneda Hai', price: 100, rent: 6, group: 'turf-a', color: '#2F6B3A' },
  { id: 7, kind: 'chance', name: "Fuji's Hat" },
  { id: 8, kind: 'property', name: 'Tokyo Derby', price: 100, rent: 6, group: 'turf-a', color: '#2F6B3A' },
  { id: 9, kind: 'property', name: 'Japan Dirt Classic', price: 120, rent: 8, group: 'turf-a', color: '#2F6B3A' },
  { id: 10, kind: 'jail', name: 'Infirmary' },
  { id: 11, kind: 'property', name: 'Oka Sho', price: 140, rent: 10, group: 'hill', color: '#3B6EA5' },
  { id: 12, kind: 'utility', name: 'Cafeteria', price: 150, rent: 0 },
  { id: 13, kind: 'property', name: 'Japanese Oaks', price: 140, rent: 10, group: 'hill', color: '#3B6EA5' },
  { id: 14, kind: 'property', name: 'Shuka Sho', price: 160, rent: 12, group: 'hill', color: '#3B6EA5' },
  { id: 15, kind: 'rail', name: 'Exile 2', price: 200, rent: 25 },
  { id: 16, kind: 'property', name: 'Team Trials', price: 180, rent: 14, group: 'shore', color: '#C45C26' },
  { id: 17, kind: 'community', name: 'Raffle Ticket' },
  { id: 18, kind: 'property', name: 'League of Heroes', price: 180, rent: 14, group: 'shore', color: '#C45C26' },
  { id: 19, kind: 'property', name: 'Champions Meeting', price: 200, rent: 16, group: 'shore', color: '#C45C26' },
  { id: 20, kind: 'free', name: 'Winner’s Circle' },
  { id: 21, kind: 'property', name: 'Satsuki Sho', price: 220, rent: 18, group: 'night', color: '#B33A3A' },
  { id: 22, kind: 'chance', name: "Fuji's Hat" },
  { id: 23, kind: 'property', name: 'Tokyo Yushun', price: 220, rent: 18, group: 'night', color: '#B33A3A' },
  { id: 24, kind: 'property', name: 'Kikuka Sho', price: 240, rent: 20, group: 'night', color: '#B33A3A' },
  { id: 25, kind: 'rail', name: 'Exile 3', price: 200, rent: 25 },
  { id: 26, kind: 'property', name: 'Osaka Hai', price: 260, rent: 22, group: 'mountain', color: '#E8C547' },
  { id: 27, kind: 'property', name: 'Tenno Sho Spring', price: 260, rent: 22, group: 'mountain', color: '#E8C547' },
  { id: 28, kind: 'utility', name: 'Dorms', price: 150, rent: 0 },
  { id: 29, kind: 'property', name: 'Takarazuka Kinen', price: 280, rent: 24, group: 'mountain', color: '#E8C547' },
  { id: 30, kind: 'gotojail', name: 'New Condition Slacker' },
  { id: 31, kind: 'property', name: 'Minecraft', price: 300, rent: 26, group: 'grand', color: '#2E8B57' },
  { id: 32, kind: 'property', name: 'Overwatch', price: 300, rent: 26, group: 'grand', color: '#2E8B57' },
  { id: 33, kind: 'community', name: 'Raffle Ticket' },
  { id: 34, kind: 'property', name: 'Dungeons and Dragons', price: 320, rent: 28, group: 'grand', color: '#2E8B57' },
  { id: 35, kind: 'rail', name: 'Exile Dawn', price: 200, rent: 25 },
  { id: 36, kind: 'chance', name: "Fuji's Hat" },
  { id: 37, kind: 'property', name: 'Hot Spring Getaway', price: 350, rent: 35, group: 'champ', color: '#1F4E79' },
  { id: 38, kind: 'tax', name: 'Trainer Fee', taxAmount: 100 },
  { id: 39, kind: 'property', name: 'Mejiro Mansion', price: 400, rent: 50, group: 'champ', color: '#1F4E79' },
];

const DEVELOPMENT_RENTS: Record<number, number[]> = {
  1: [10,30,90,160,250], 3: [20,60,180,320,450],
  6: [30,90,270,400,550], 8: [30,90,270,400,550], 9: [40,100,300,450,600],
  11: [50,150,450,625,750], 13: [50,150,450,625,750], 14: [60,180,500,700,900],
  16: [70,200,550,750,950], 18: [70,200,550,750,950], 19: [80,220,600,800,1000],
  21: [90,250,700,875,1050], 23: [90,250,700,875,1050], 24: [100,300,750,925,1100],
  26: [110,330,800,975,1150], 27: [110,330,800,975,1150], 29: [120,360,850,1025,1200],
  31: [130,390,900,1100,1275], 32: [130,390,900,1100,1275], 34: [150,450,1000,1200,1400],
  37: [175,500,1100,1300,1500], 39: [200,600,1400,1700,2000],
};
for (const space of DEFAULT_SPACES) {
  if (space.kind === 'property') {
    space.buildingCost = (Math.floor(space.id / 10) + 1) * 50;
    space.rentLevels = DEVELOPMENT_RENTS[space.id];
  }
}

export const DEFAULT_CHANCE: GameCard[] = [
  { id: 'ch1', text: 'Kitasan helps you on your way to work. Advance to Collect Race Earnings.', effect: { type: 'move', position: 0 } },
  { id: 'ch2', text: 'You enter an eating contest with Oguri. Roll a d20. Below 18, you get Slow Metabolism and subtract 2 from your movement rolls for the next 3 turns.', d20Below: 18, effect: { type: 'movement_modifier', amount: -2, turns: 3 } },
  { id: 'ch3', text: 'You fail to meet your fan quota and are afflicted with Slacker. Go to the Infirmary.', effect: { type: 'jail' } },
  { id: 'ch4', text: 'Ozy and Roxi prepare a goated CM guide, but you can’t read it because you’re an Exile member. Go back 2 spaces.', effect: { type: 'move_relative', steps: -2 } },
  { id: 'ch5', text: 'You receive a hug from Taiki Shuttle. Skip your next turn to recover.', effect: { type: 'skip_turns', turns: 1 } },
  { id: 'ch6', text: 'Maruzensky offers you a ride. On your next turn, choose one die’s face from 1 to 6 and roll the other.', effect: { type: 'choose_die' } },
  { id: 'ch7', text: 'You win the raffle for the Hot Spring Getaway. Advance there. If unowned, you may buy it. If owned, stay for free.', effect: { type: 'move', position: 37, rentFree: true } },
  { id: 'ch8', text: 'Ines Fujin gifts you some Toughness Bars. Add 2 to your movement rolls for the next 3 turns.', effect: { type: 'movement_modifier', amount: 2, turns: 3 } },
  { id: 'ch9', text: 'You hang out with Haru Urara and chase butterflies. Move forward 3 spaces.', effect: { type: 'move_relative', steps: 3 } },
  { id: 'ch10', text: 'Seiun Sky’s attitude influences you. Skip your next turn.', effect: { type: 'skip_turns', turns: 1 } },
  { id: 'ch11', text: 'Exile Recruitment. Advance to the next Exile branch. If unowned, you may buy it. If owned by another player, pay double rent.', effect: { type: 'nearest_rail' } },
  { id: 'ch12', text: 'You and Bumkin are playing Overwatch and can’t leave with a loss. Roll a d20. Below 10, skip your next 2 turns.', d20Below: 10, effect: { type: 'skip_turns', turns: 2 } },
  { id: 'ch13', text: 'Your gutsmax build lets you outduel everyone late in the race. Move forward 3 spaces.', effect: { type: 'move_relative', steps: 3 } },
  { id: 'ch14', text: 'You were caught buying Shatterproof on your Team Trials trainee and sustained mysterious injuries. Go to the Infirmary.', effect: { type: 'jail' } },
  { id: 'ch15', text: 'You hit Fast Learner but the run dies. Skip your next turn.', effect: { type: 'skip_turns', turns: 1 } },
  { id: 'ch16', text: 'You get a 5-win ticket in CM. Move forward 5 spaces.', effect: { type: 'move_relative', steps: 5 } },
];

export const DEFAULT_COMMUNITY: GameCard[] = [
  { id: 'cm1', text: 'You let Mihono Bourbon use your phone and it breaks. Spend 100 Carats on a new phone.', effect: { type: 'money', amount: -100 } },
  { id: 'cm2', text: 'You activated Dodging Danger, Prudent Positioning, Ignited Spirit Wit, Taking the Lead, Concentration, Front Runner Savvy, and Groundwork. Collect 50 Carats from each other player.', effect: { type: 'collect_each', amount: 50 } },
  { id: 'cm3', text: 'You retained Class 6. Gain 375 Carats.', effect: { type: 'money', amount: 375 } },
  { id: 'cm4', text: 'You take Oguri out to dinner. Lose 200 Carats.', effect: { type: 'money', amount: -200 } },
  { id: 'cm5', text: 'Your Umatube video goes viral. Gain 300 Carats.', effect: { type: 'money', amount: 300 } },
  { id: 'cm6', text: 'You are forced to spark your Oshi. Lose 500 Carats.', effect: { type: 'money', amount: -500 } },
  { id: 'cm7', text: 'You roll 1-star Guts and 2-star Pace on a parent with three days left before CM. Pay 10 Carats.', effect: { type: 'money', amount: -10 } },
  { id: 'cm8', text: 'Your Oshi wins CM. Gain 2,700 Carats.', effect: { type: 'money', amount: 2700 } },
  { id: 'cm9', text: 'You pick up a part-time shift with Ines. Gain 300 Carats.', effect: { type: 'money', amount: 300 } },
  { id: 'cm10', text: 'Gold Ship dropkicks you. Lose 200 Carats.', effect: { type: 'money', amount: -200 } },
  { id: 'cm11', text: 'Sweep Tosho casts a magical Carat-producing spell. Gain 20% more Carats for the next 3 turns.', effect: { type: 'carat_bonus', percent: 20, turns: 3 } },
  { id: 'cm12', text: 'You start independent training and forget to set the agenda. Lose 10 Carats.', effect: { type: 'money', amount: -10 } },
  { id: 'cm13', text: 'You pulled for Throne and it had a one-CM shelf life. Lose 300 Carats.', effect: { type: 'money', amount: -300 } },
  { id: 'cm14', text: 'You pull an RJ and MLB Maru in 200 pulls. Gain 900 Carats.', effect: { type: 'money', amount: 900 } },
  { id: 'cm15', text: 'You get placed in a six-Front Group A Final. Give 30 Carats to each other player.', effect: { type: 'pay_each', amount: 30 } },
  { id: 'cm16', text: 'Three cheers for trainer! Everyone gets 600 Carats.', effect: { type: 'money_all', amount: 600 } },
];

export function defaultContent(): GameContent {
  return {
    properties: structuredClone(DEFAULT_SPACES),
    chance: structuredClone(DEFAULT_CHANCE),
    community: structuredClone(DEFAULT_COMMUNITY),
  };
}

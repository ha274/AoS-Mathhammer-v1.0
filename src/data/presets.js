export const PRESETS = [
  {
    name: "Shiny Lads (5)", faction: "Golden Boys", points: 120, modelCount: 5,
    health: "2", save: "3+", move: '5"', control: 1,
    keywords: ["INFANTRY", "CHAMPION", "GOLDEN BOYS"],
    weapons: [
      { name: "Bonk Hammers", type: "melee", attacks: "2", hit: "3+", wound: "3+", rend: "1", damage: "1", ability: "Crit (Mortal)", modelCount: 5, enabled: true },
    ],
  },
  {
    name: "Pointy Sticks (5)", faction: "Golden Boys", points: 110, modelCount: 5,
    health: "2", save: "3+", move: '5"', control: 1,
    keywords: ["INFANTRY", "CHAMPION", "GOLDEN BOYS"],
    weapons: [
      { name: "Glorified Spear", type: "melee", attacks: "2", hit: "3+", wound: "3+", rend: "1", damage: "1", ability: "Anti-charge (+1 Rend)", modelCount: 5, enabled: true },
    ],
  },
  {
    name: "Expendable Rats (20)", faction: "Definitely Not Rats", points: 120, modelCount: 20,
    health: "1", save: "5+", move: '6"', control: 1,
    keywords: ["INFANTRY", "CHAMPION", "RATFOLK"],
    weapons: [
      { name: "Tetanus Blades", type: "melee", attacks: "2", hit: "4+", wound: "4+", rend: "-", damage: "1", ability: "-", modelCount: 20, enabled: true },
    ],
  },
  {
    name: "Big Angry Rats (2)", faction: "Definitely Not Rats", points: 100, modelCount: 2,
    health: "4", save: "5+", move: '6"', control: 1,
    keywords: ["INFANTRY", "RATFOLK", "BEAST"],
    weapons: [
      { name: "Claws, Teeth & Anger Issues", type: "melee", attacks: "4", hit: "4+", wound: "3+", rend: "1", damage: "2", ability: "-", modelCount: 2, enabled: true },
    ],
  },
  {
    name: "Militia Lads (10)", faction: "Free Peoples", points: 100, modelCount: 10,
    health: "1", save: "4+", move: '5"', control: 1,
    keywords: ["INFANTRY", "CHAMPION", "FREE PEOPLES", "HUMAN"],
    weapons: [
      { name: "Whatever Was In The Shed", type: "melee", attacks: "2", hit: "4+", wound: "4+", rend: "-", damage: "1", ability: "-", modelCount: 10, enabled: true },
    ],
  },
  {
    name: "Spooky Skeletons (10)", faction: "Bone Collectors", points: 120, modelCount: 10,
    health: "1", save: "3+", move: '4"', control: 1,
    keywords: ["INFANTRY", "CHAMPION", "BONE COLLECTORS"],
    weapons: [
      { name: "Suspiciously Sharp Swords", type: "melee", attacks: "2", hit: "3+", wound: "4+", rend: "1", damage: "1", ability: "-", modelCount: 10, enabled: true },
    ],
  },
  {
    name: "Lads On Dragons (2)", faction: "Golden Boys", points: 340, modelCount: 2,
    health: "9", save: "3+", move: '10"', control: 2,
    keywords: ["CAVALRY", "FLY", "GOLDEN BOYS", "MONSTER"],
    weapons: [
      { name: "Overcompensating Lance", type: "melee", attacks: "3", hit: "3+", wound: "3+", rend: "1", damage: "1", ability: "Charge (+1 Damage), Anti-MONSTER (+1 Rend)", modelCount: 2, enabled: true },
      { name: "Dragon Bites", type: "melee", attacks: "4", hit: "4+", wound: "2+", rend: "2", damage: "2", ability: "Companion", modelCount: 2, enabled: true },
    ],
  },
  {
    name: "Angry Red Daemons (10)", faction: "Team Blood", points: 120, modelCount: 10,
    health: "1", save: "5+", move: '5"', control: 1,
    keywords: ["INFANTRY", "CHAMPION", "DAEMON", "BLOOD GOD"],
    weapons: [
      { name: "Unreasonably Hot Swords", type: "melee", attacks: "2", hit: "3+", wound: "3+", rend: "1", damage: "1", ability: "Crit (Auto-wound)", modelCount: 10, enabled: true },
    ],
  },
];

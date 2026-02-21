export const emptyWeapon = () => ({
  name: "Weapon",
  type: "melee",
  attacks: "2",
  hit: "4+",
  wound: "4+",
  rend: "-",
  damage: "1",
  ability: "-",
  companion: false,
  modelCount: 1,
  enabled: true,
});

export const defaultMods = () => ({
  hitMod: 0,
  woundMod: 0,
  rendMod: 0,
  damageMod: 0,
  extraAttacks: 0,
  allOutAttack: false,
  allOutDefence: false,
  champion: true,
  ward: "",
  saveMod: 0,
  critOn: 6,
  critBuff: "",
  // "Roll a dice, on X+ do Y mortals" (breath attacks etc)
  onXThreshold: "",
  onXDamage: "",
  onXTiming: "after", // "before" | "during" | "after" combat
  // "Roll per enemy model, on X+ do 1 mortal each"
  perModelThreshold: "",
  // Rerolls: "off" | "ones" | "full"
  hitReroll: "off",
  woundReroll: "off",
  saveReroll: "off",
});

export const defaultOpts = () => ({
  charged: false,
  wasCharged: false,
  powerThrough: false,
  save6Reflect: false,
  fightTwice: false,
});

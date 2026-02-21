import { C } from '../styles';

const S = {
  section: {
    marginBottom: 24,
  },
  h2: {
    fontFamily: "'Cinzel', serif",
    fontSize: 16,
    fontWeight: 700,
    color: C.gold,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: `1px solid ${C.gold}22`,
  },
  h3: {
    fontFamily: "'Cinzel', serif",
    fontSize: 13,
    fontWeight: 700,
    color: C.dGold,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 8,
  },
  p: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "#e8dcc4",
    marginBottom: 8,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: 12,
    fontSize: 13,
  },
  th: {
    textAlign: "left",
    padding: "6px 10px",
    borderBottom: `1px solid ${C.gold}33`,
    color: C.gold,
    fontFamily: "'Cinzel', serif",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  td: {
    padding: "5px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    color: "#e8dcc4",
    fontSize: 13,
    lineHeight: 1.5,
  },
  code: {
    background: "rgba(201,168,76,0.1)",
    border: `1px solid ${C.gold}22`,
    borderRadius: 3,
    padding: "1px 5px",
    fontSize: 12,
    fontFamily: "monospace",
    color: C.gold,
  },
  li: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "#e8dcc4",
    marginBottom: 4,
  },
  bold: {
    fontWeight: 700,
    color: C.dGold,
  },
};

const Code = ({ children }) => <span style={S.code}>{children}</span>;
const B = ({ children }) => <span style={S.bold}>{children}</span>;

export default function GuidePanel() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "8px 0" }}>

      {/* BEFORE YOU START */}
      <div style={S.section}>
        <h2 style={S.h2}>Before You Start</h2>
        <p style={S.p}>
          Download the <B>BSData</B> file first. The simulator uses this to power the unit import library.
          Without it, you will need to enter all unit stats and weapons manually.
        </p>
      </div>

      {/* QUICK START */}
      <div style={S.section}>
        <h2 style={S.h2}>Quick Start</h2>
        <ol style={{ paddingLeft: 20 }}>
          <li style={S.li}>Fill in each unit's <B>Name</B>, <B>Points</B>, <B>Models</B>, <B>Health</B>, and <B>Save</B></li>
          <li style={S.li}>Click <B>+ Add Weapon</B> and fill in the weapon profile</li>
          <li style={S.li}>Pick a combat mode and hit simulate</li>
        </ol>
        <p style={S.p}>Or use <B>Import</B> to load a unit from the library with stats and weapons pre-filled.</p>
      </div>

      {/* WHAT GETS IMPORTED */}
      <div style={S.section}>
        <h2 style={S.h2}>What Gets Imported vs What Doesn't</h2>
        <p style={S.p}>
          The import pulls in <B>base stats and weapon profiles</B> from the unit card.
          That covers attacks, hit, wound, rend, damage, save, health, etc.
        </p>
        <p style={S.p}>
          <B>Unit special abilities need to be added manually</B> using the modifier buttons.
          Things like extra mortal wounds on a threshold, ward saves, fight twice, rerolls -
          if it is not a base stat or weapon ability, you need to toggle it yourself.
        </p>
      </div>

      {/* COMBAT MODES */}
      <div style={S.section}>
        <h2 style={S.h2}>Combat Modes</h2>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Mode</th>
              <th style={S.th}>What It Does</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={S.td}><B>Melee</B></td><td style={S.td}>Both units fight in combat, casualties removed between strikes</td></tr>
            <tr><td style={S.td}><B>Shoot Only</B></td><td style={S.td}>Shooting phase only</td></tr>
            <tr><td style={S.td}><B>Shoot + Charge</B></td><td style={S.td}>Attacking unit shoots, then both units fight in melee</td></tr>
          </tbody>
        </table>
        <p style={S.p}>Click the <B>"strikes first"</B> bar to swap who swings first.</p>
      </div>

      {/* DICE NOTATION */}
      <div style={S.section}>
        <h2 style={S.h2}>Dice Notation</h2>
        <p style={S.p}>Anywhere you see a number field, you can use:</p>
        <table style={S.table}>
          <tbody>
            <tr><td style={S.td}><Code>1</Code>, <Code>2</Code>, <Code>3</Code></td><td style={S.td}>Flat values</td></tr>
            <tr><td style={S.td}><Code>D3</Code>, <Code>D6</Code></td><td style={S.td}>Single die</td></tr>
            <tr><td style={S.td}><Code>2D6</Code>, <Code>3D3</Code></td><td style={S.td}>Multiple dice</td></tr>
            <tr><td style={S.td}><Code>D6+3</Code>, <Code>2D6+1</Code></td><td style={S.td}>Dice plus bonus</td></tr>
            <tr><td style={S.td}><Code>-</Code></td><td style={S.td}>Zero / none</td></tr>
          </tbody>
        </table>
      </div>

      {/* WEAPON OPTIONS */}
      <div style={S.section}>
        <h2 style={S.h2}>Weapon Options</h2>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Field</th>
              <th style={S.th}>Format</th>
              <th style={S.th}>Example</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={S.td}>Attacks</td><td style={S.td}>dice notation</td><td style={S.td}><Code>2D6</Code>, <Code>4</Code></td></tr>
            <tr><td style={S.td}>Hit</td><td style={S.td}>threshold</td><td style={S.td}><Code>3+</Code>, <Code>4+</Code></td></tr>
            <tr><td style={S.td}>Wound</td><td style={S.td}>threshold</td><td style={S.td}><Code>3+</Code>, <Code>4+</Code></td></tr>
            <tr><td style={S.td}>Rend</td><td style={S.td}>number</td><td style={S.td}><Code>0</Code>, <Code>1</Code>, <Code>2</Code></td></tr>
            <tr><td style={S.td}>Damage</td><td style={S.td}>dice notation</td><td style={S.td}><Code>D3</Code>, <Code>2</Code></td></tr>
          </tbody>
        </table>

        <h3 style={S.h3}>Checkboxes</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li style={S.li}><B>Companion</B> - mount/beast attacks (only All-out Attack and negative mods apply)</li>
          <li style={S.li}><B>Ranged</B> - marks weapon as shooting</li>
        </ul>

        <h3 style={S.h3}>Weapon Abilities (text field)</h3>
        <table style={S.table}>
          <tbody>
            <tr><td style={S.td}><Code>Crit (Mortal)</Code></td><td style={S.td}>Crits bypass saves</td></tr>
            <tr><td style={S.td}><Code>Crit (Auto-wound)</Code></td><td style={S.td}>Crits skip wound roll</td></tr>
            <tr><td style={S.td}><Code>Crit (2 Hits)</Code></td><td style={S.td}>Crits generate 2 wound rolls</td></tr>
            <tr><td style={S.td}><Code>Charge (+1 Damage)</Code></td><td style={S.td}>Bonus damage on charge</td></tr>
            <tr><td style={S.td}><Code>Anti-KEYWORD (+X Rend)</Code></td><td style={S.td}>Bonus rend vs keyword</td></tr>
            <tr><td style={S.td}><Code>Anti-KEYWORD (+X Damage)</Code></td><td style={S.td}>Bonus damage vs keyword</td></tr>
          </tbody>
        </table>
      </div>

      {/* MODIFIER BUTTONS */}
      <div style={S.section}>
        <h2 style={S.h2}>Modifier Buttons</h2>
        <p style={S.p}>
          These are for adding bonuses and abilities that are not part of the base stats or weapon profiles.
          Use these to represent unit special abilities, command abilities, and buffs.
        </p>

        <h3 style={S.h3}>Attack Modifiers</h3>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Modifier</th>
              <th style={S.th}>What It Does</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={S.td}>All-out Attack</td><td style={S.td}>+1 to hit, -1 to your own save</td></tr>
            <tr><td style={S.td}>Hit Modifier</td><td style={S.td}>+1 or -1 to hit rolls</td></tr>
            <tr><td style={S.td}>Wound Modifier</td><td style={S.td}>+1 or -1 to wound rolls</td></tr>
            <tr><td style={S.td}>Extra Rend</td><td style={S.td}>Adds rend to all weapons</td></tr>
            <tr><td style={S.td}>Extra Damage</td><td style={S.td}>Adds damage to all weapons</td></tr>
            <tr><td style={S.td}>Extra Attacks</td><td style={S.td}>Adds attacks to all weapons</td></tr>
            <tr><td style={S.td}>Champion</td><td style={S.td}>+1 attack to the weapon with the most models</td></tr>
            <tr><td style={S.td}>Hit Reroll</td><td style={S.td}><Code>ones</Code> or <Code>full</Code> reroll</td></tr>
            <tr><td style={S.td}>Wound Reroll</td><td style={S.td}><Code>ones</Code> or <Code>full</Code> reroll</td></tr>
            <tr><td style={S.td}>Crit Buff</td><td style={S.td}><Code>2 hits</Code>, <Code>auto-wound</Code>, or <Code>mortal</Code></td></tr>
            <tr><td style={S.td}>Crit On</td><td style={S.td}><Code>5</Code> or <Code>6</Code> (default 6)</td></tr>
            <tr><td style={S.td}>On X Mortals</td><td style={S.td}>Deal mortals on a threshold (e.g. D3 on 5+)</td></tr>
            <tr><td style={S.td}>Per Model Mortals</td><td style={S.td}>Mortals based on enemy models in range</td></tr>
            <tr><td style={S.td}>Power Through</td><td style={S.td}>D3 wounds at the end of combat</td></tr>
            <tr><td style={S.td}>Fight Twice</td><td style={S.td}>Full second activation at strike-last</td></tr>
          </tbody>
        </table>

        <h3 style={S.h3}>Defence Modifiers</h3>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Modifier</th>
              <th style={S.th}>What It Does</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={S.td}>All-out Defence</td><td style={S.td}>+1 to save</td></tr>
            <tr><td style={S.td}>Save Modifier</td><td style={S.td}>+1 or -1 to saves</td></tr>
            <tr><td style={S.td}>Ward</td><td style={S.td}>Ward save (e.g. <Code>5+</Code>, <Code>4+</Code>)</td></tr>
            <tr><td style={S.td}>Save Reroll</td><td style={S.td}><Code>ones</Code> or <Code>full</Code> reroll</td></tr>
            <tr><td style={S.td}>Save 6 Reflect</td><td style={S.td}>Unmodified 6s on saves reflect 1 mortal back</td></tr>
          </tbody>
        </table>

        <h3 style={S.h3}>Combat Options</h3>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Option</th>
              <th style={S.th}>What It Does</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={S.td}>Charged</td><td style={S.td}>Unit charged this turn (triggers Charge weapon abilities)</td></tr>
            <tr><td style={S.td}>Was Charged</td><td style={S.td}>Activates Anti-CHARGE bonuses</td></tr>
          </tbody>
        </table>
      </div>

      {/* UNIT KEYWORDS */}
      <div style={S.section}>
        <h2 style={S.h2}>Unit Keywords</h2>
        <p style={S.p}>
          Units can have keywords like <Code>INFANTRY</Code>, <Code>MONSTER</Code>, <Code>HERO</Code>, <Code>CAVALRY</Code>, <Code>FLY</Code>, etc.
          These are used for Anti-ability matching.
        </p>
      </div>

      {/* IMPORTING UNITS */}
      <div style={S.section}>
        <h2 style={S.h2}>Importing Units</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li style={S.li}><B>Import</B> - load a unit from the built-in library with stats and weapons pre-filled</li>
          <li style={S.li}>After importing, edit anything you want - it is just a starting point</li>
          <li style={S.li}>Change <B>Models</B> to simulate different unit sizes</li>
          <li style={S.li}>Your changes are saved locally in your browser</li>
        </ul>
      </div>

      {/* READING RESULTS */}
      <div style={S.section}>
        <h2 style={S.h2}>Reading Results</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li style={S.li}><B>Attack Sequence</B> - step-by-step combat breakdown</li>
          <li style={S.li}><B>Total Damage</B> - headline damage and kills, expandable per-weapon breakdown</li>
          <li style={S.li}><B>Points Efficiency</B> - damage per 100pts, points per kill, ROI, and a verdict on who won the trade</li>
        </ul>
      </div>

    </div>
  );
}

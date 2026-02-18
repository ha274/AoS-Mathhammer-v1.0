import { C } from '../../styles';

export default function Tog({ on, click, color, children }) {
  return <button onClick={click} style={{
    padding: "3px 8px", borderRadius: 4, border: `1px solid ${on ? color + "66" : "rgba(255,255,255,0.08)"}`,
    background: on ? color + "22" : "transparent", color: on ? color : C.fGold,
    cursor: "pointer", fontSize: 11, fontFamily: "'Cinzel', serif", fontWeight: on ? 700 : 400,
    letterSpacing: 0.5, transition: "all 0.15s", lineHeight: 1.4,
  }}>{children}</button>;
}

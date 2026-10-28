import { mkdir, writeFile } from "node:fs/promises";
await mkdir("public/art", { recursive: true });
let seed = 1471;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const defs = `<defs><radialGradient id="bg"><stop stop-color="#18303c"/><stop offset=".5" stop-color="#09151d"/><stop offset="1" stop-color="#03080d"/></radialGradient><radialGradient id="amber"><stop stop-color="#ffd6a4"/><stop offset=".2" stop-color="#ff6a20"/><stop offset=".55" stop-color="#a02e0e"/><stop offset="1" stop-color="#0a1015" stop-opacity="0"/></radialGradient><linearGradient id="glass" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#d7f8ff" stop-opacity=".85"/><stop offset=".15" stop-color="#6da7c1" stop-opacity=".13"/><stop offset=".46" stop-color="#203948" stop-opacity=".7"/><stop offset=".52" stop-color="#c1dce8" stop-opacity=".7"/><stop offset=".57" stop-color="#32546b" stop-opacity=".1"/><stop offset="1" stop-color="#8bbfd5" stop-opacity=".6"/></linearGradient><linearGradient id="edge"><stop stop-color="#e6f8ff"/><stop offset=".45" stop-color="#5792ac" stop-opacity=".5"/><stop offset="1" stop-color="#ff6a23"/></linearGradient><radialGradient id="sphere" cx=".3" cy=".25" r=".8"><stop stop-color="#ffe5c5"/><stop offset=".27" stop-color="#e9904b"/><stop offset=".62" stop-color="#a74120"/><stop offset=".85" stop-color="#411c19"/><stop offset="1" stop-color="#120e13"/></radialGradient><radialGradient id="metal" cx=".3" cy=".2" r=".85"><stop stop-color="#ecf5f4"/><stop offset=".15" stop-color="#a8bfca"/><stop offset=".42" stop-color="#304550"/><stop offset=".67" stop-color="#8095a0"/><stop offset=".8" stop-color="#1a2836"/><stop offset="1" stop-color="#03090e"/></radialGradient><linearGradient id="ribbon"><stop stop-color="#b1b2fb"/><stop offset=".2" stop-color="#5b41d5"/><stop offset=".5" stop-color="#f19dac"/><stop offset=".7" stop-color="#ff633d"/><stop offset="1" stop-color="#39184a"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="12"/></filter><filter id="blur"><feGaussianBlur stdDeviation="50"/></filter><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".065"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter></defs>`;
async function save(name, body) {
  await writeFile(
    `public/art/${name}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1200" width="1920" height="1200">${defs}${body}<rect width="1920" height="1200" opacity=".3" filter="url(#grain)"/></svg>`,
  );
}
let prism =
  '<rect width="1920" height="1200" fill="url(#bg)"/><ellipse cx="1230" cy="650" rx="670" ry="540" fill="url(#amber)" opacity=".5"/><ellipse cx="1500" cy="250" rx="300" ry="550" fill="#275679" filter="url(#blur)" opacity=".12"/>';
for (let i = 0; i < 95; i++) {
  const angle = random() * Math.PI * 2,
    r = 180 + random() * 850,
    x = 1230 + Math.cos(angle) * r,
    y = 610 + Math.sin(angle) * r * 0.65;
  const len = 20 + random() * 180;
  if (i % 5 === 0)
    prism += `<path d="M${x},${y}l${Math.cos(angle) * len},${Math.sin(angle) * len}" stroke="${i % 2 ? "#ff7626" : "#6db0cb"}" stroke-width="${1 + random() * 3}" opacity="${0.08 + random() * 0.25}" filter="url(#glow)"/>`;
  const w = 10 + random() * 80,
    h = 20 + random() * 140;
  prism += `<g transform="translate(${x} ${y}) rotate(${random() * 360})" opacity="${0.1 + random() * 0.65}"><path d="M0,0L${w},${h * 0.2}L${w * 0.45},${h}L${-w * 0.3},${h * 0.5}Z" fill="url(#glass)" stroke="url(#edge)" stroke-width=".8"/><path d="M0,0L${w * 0.45},${h}L${w},${h * 0.2}" fill="none" stroke="#c9edff" stroke-width=".6" opacity=".45"/></g>`;
}
prism += `<g transform="translate(1200 500) rotate(-17)"><path d="M-130,-180L180,-90L65,250L-210,105Z" fill="url(#glass)" stroke="url(#edge)" stroke-width="2"/><path d="M-130,-180L65,250L180,-90L-210,105Z" fill="url(#glass)" stroke="#90bfd4" stroke-opacity=".5"/><path d="M-130,-180L-15,0L180,-90M-15,0L65,250M-15,0L-210,105" fill="none" stroke="#cdebf4" stroke-opacity=".4"/><path d="M-130,-180L-15,0L65,250Z" fill="#bfd6e7" opacity=".15"/></g>`;
for (let i = 0; i < 180; i++) {
  const x = 550 + random() * 1370,
    y = random() * 1200;
  prism += `<circle cx="${x}" cy="${y}" r="${random() * 2 + 0.3}" fill="#97c7d9" opacity="${random() * 0.45}"/>`;
}
await save("prism", prism);
let orb =
  '<rect width="1920" height="1200" fill="#13161c"/><ellipse cx="1020" cy="1010" rx="610" ry="130" fill="#030508" filter="url(#blur)"/><circle cx="990" cy="570" r="380" fill="url(#sphere)"/>';
for (let i = 0; i < 30; i++) {
  const y = 330 + i * 17;
  const x = Math.sqrt(Math.max(0, 370 ** 2 - (y - 570) ** 2));
  orb += `<path d="M${990 - x},${y} Q990,${y + 120} ${990 + x},${y}" fill="none" stroke="${i < 15 ? "#f6b886" : "#35131c"}" opacity=".28" stroke-width="2"/>`;
}
orb +=
  '<ellipse cx="1010" cy="660" rx="535" ry="180" fill="none" stroke="#9babb7" stroke-width="22" transform="rotate(-28 1010 660)"/><ellipse cx="1010" cy="654" rx="535" ry="180" fill="none" stroke="#dce6ed" stroke-width="3" transform="rotate(-28 1010 654)"/><circle cx="1410" cy="355" r="85" fill="url(#metal)"/>';
await save("orb", orb);
let type =
  '<rect width="1920" height="1200" fill="#19151a"/><circle cx="1350" cy="500" r="700" fill="url(#amber)" opacity=".7"/>';
for (let i = 0; i < 14; i++)
  type += `<path d="M${i * 190 - 400},0L${i * 190 + 500},1200" stroke="#e2642c" stroke-width="2" opacity=".2"/>`;
type +=
  '<g fill="#ece5d9" font-family="Arial,sans-serif" font-weight="700" font-size="220" letter-spacing="-16"><text x="190" y="540">AFTER</text><text x="450" y="765" fill="none" stroke="#f1a876" stroke-width="2">HOURS</text></g><text x="205" y="910" fill="#eeac75" font-family="monospace" letter-spacing="10" font-size="17">A STUDY IN TYPE, TENSION &amp; LIGHT</text>';
await save("type", type);
let ribbon =
  '<rect width="1920" height="1200" fill="#dcd5d0"/><ellipse cx="970" cy="1010" rx="500" ry="70" fill="#6b5475" opacity=".25" filter="url(#blur)"/>';
for (let i = 0; i < 25; i++) {
  const w = 330 - i * 3;
  ribbon += `<path d="M${650 + i * 11},${220 + i * 9} C${1350 - i * 9},${70 + i * 18} ${1380 - i * 4},${670 - i * 5} ${940 + i * 4},${650 + i * 5} S${470 + i * 8},${1070 - i * 8} ${1230 - i * 8},${940 - i * 4}" fill="none" stroke="url(#ribbon)" stroke-width="${w / 16}" opacity=".86"/>`;
}
await save("ribbon", ribbon);
let orbit =
  '<rect width="1920" height="1200" fill="#c9d0c5"/><ellipse cx="960" cy="1030" rx="400" ry="80" fill="#4f6c61" opacity=".25" filter="url(#blur)"/>';
for (let i = 0; i < 9; i++)
  orbit += `<ellipse cx="960" cy="600" rx="${340 - i * 22}" ry="${390 - i * 24}" transform="rotate(${i * 21} 960 600)" fill="none" stroke="${i % 2 ? "#d8e9db" : "#2d4f45"}" stroke-width="${25 - i}"/>`;
orbit +=
  '<circle cx="960" cy="600" r="150" fill="url(#metal)"/><circle cx="1220" cy="330" r="65" fill="url(#sphere)"/>';
await save("orbit", orbit);
let bloom =
  '<rect width="1920" height="1200" fill="#c65a3c"/><circle cx="960" cy="600" r="550" fill="#e79462" opacity=".4" filter="url(#blur)"/>';
for (let i = 0; i < 12; i++)
  bloom += `<ellipse cx="960" cy="450" rx="105" ry="225" transform="rotate(${i * 30} 960 600)" fill="url(#sphere)" stroke="#ffbc82" stroke-opacity=".3"/>`;
bloom +=
  '<circle cx="960" cy="600" r="100" fill="#f3c18a"/><text x="960" y="1040" text-anchor="middle" fill="#f3d7b2" font-family="monospace" font-size="20" letter-spacing="10">GROW IN MOTION</text>';
await save("bloom", bloom);
let wave = '<rect width="1920" height="1200" fill="#0a1d32"/>';
for (let i = 0; i < 60; i++) {
  const y = 190 + i * 14;
  wave += `<path d="M340,${y} Q650,${y - 300 * Math.sin(i / 15)} 960,${y} T1580,${y}" fill="none" stroke="${i < 30 ? "#6aa7de" : "#e69565"}" stroke-width="${2 + (i % 4)}" opacity="${0.4 + i / 180}"/>`;
}
await save("wave", wave);

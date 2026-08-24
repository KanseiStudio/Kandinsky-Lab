/**
 * Tastiera virtuale.
 *
 * Motivo per cui non uso <input> con la tastiera di sistema: su un chiosco
 * Windows in kiosk mode la tastiera touch di Chrome è inaffidabile, apre
 * scorciatoie di sistema e può far uscire dall'app. La disegniamo noi.
 *
 * Due layout: `letters` per il titolo dell'opera, `email` con @ e . in evidenza.
 */
const LETTERS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

const EMAIL_EXTRA = ["@", ".", "-", "_", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function renderKeyboard(
  root: HTMLElement,
  mode: "letters" | "email",
  onChange: (value: string) => void,
  initial = "",
) {
  let value = initial;
  const wrap = document.createElement("div");
  wrap.className = "keyboard";

  const emit = () => onChange(value);

  const rows = mode === "email" ? [...LETTERS, chunk(EMAIL_EXTRA, 14)[0]] : LETTERS;

  rows.forEach((row) => {
    const r = document.createElement("div");
    r.className = "keyboard__row";
    row.forEach((k) => {
      const b = document.createElement("button");
      b.className = "key";
      b.textContent = mode === "email" ? k.toLowerCase() : k;
      b.onclick = () => {
        value += mode === "email" ? k.toLowerCase() : k;
        emit();
      };
      r.append(b);
    });
    wrap.append(r);
  });

  const last = document.createElement("div");
  last.className = "keyboard__row";

  const space = document.createElement("button");
  space.className = "key key--wide";
  space.textContent = "spazio";
  space.onclick = () => {
    value += " ";
    emit();
  };

  const back = document.createElement("button");
  back.className = "key key--wide";
  back.textContent = "cancella";
  back.onclick = () => {
    value = value.slice(0, -1);
    emit();
  };

  last.append(space, back);
  wrap.append(last);
  root.append(wrap);

  return {
    element: wrap,
    get value() {
      return value;
    },
    set value(v: string) {
      value = v;
      emit();
    },
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

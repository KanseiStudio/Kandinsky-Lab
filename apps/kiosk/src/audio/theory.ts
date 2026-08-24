import type { MusicalScale } from "@kandinsky/schema";

/**
 * Il motore armonico sta tutto qui, in trenta righe.
 *
 * Nessuna nota viene mai generata in altro modo che passando da questa
 * funzione. È il punto in cui si realizza la promessa del deck:
 * "non esiste una nota sbagliata". Le note fuori scala non sono vietate,
 * semplicemente non esistono nel sistema.
 */
const SEMITONES: Record<MusicalScale, number[]> = {
  major_pentatonic: [0, 2, 4, 7, 9],
  minor_pentatonic: [0, 3, 5, 7, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  whole_tone: [0, 2, 4, 6, 8, 10],
};

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function scaleLength(scale: MusicalScale) {
  return SEMITONES[scale].length;
}

/**
 * Grado -> nota. I gradi oltre la lunghezza della scala salgono di ottava
 * invece di uscire dalla scala: un elemento con degree 7 su una pentatonica
 * suona la seconda nota dell'ottava sopra, non una nota estranea.
 */
export function noteFor(key: string, scale: MusicalScale, degree: number, octave: number) {
  const steps = SEMITONES[scale];
  const root = NOTES.indexOf(key.toUpperCase());
  if (root < 0) throw new Error(`Tonalità sconosciuta: ${key}`);

  const octaveShift = Math.floor(degree / steps.length);
  const index = ((degree % steps.length) + steps.length) % steps.length;
  const semitone = root + steps[index];

  return `${NOTES[semitone % 12]}${octave + octaveShift + Math.floor(semitone / 12)}`;
}

/** Triade costruita saltando un grado: consonante per costruzione. */
export function chordFor(key: string, scale: MusicalScale, degree: number, octave: number) {
  return [degree, degree + 2, degree + 4].map((d) => noteFor(key, scale, d, octave));
}

/**
 * Sceglie il grado per un nuovo strato evitando di raddoppiare quelli già
 * in uso. Con pochi strati la composizione si apre invece di ispessirsi
 * sempre sulla stessa nota.
 */
export function pickDegree(scale: MusicalScale, used: number[]) {
  const len = SEMITONES[scale].length;
  const free = Array.from({ length: len }, (_, i) => i).filter((d) => !used.includes(d));
  const pool = free.length ? free : Array.from({ length: len }, (_, i) => i);
  return pool[Math.floor(Math.random() * pool.length)];
}

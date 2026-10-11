/** « 1 panneau », « 12 panneaux ». */
export function panneauxCount(n: number): string {
  return `${n.toLocaleString("fr-CA")} panneau${n === 1 ? "" : "x"}`;
}

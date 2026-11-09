export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CURRENT_YEAR = new Date().getFullYear();
// 5 years back through 4 years ahead of now — 10 options total.
export const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - 5 + i);

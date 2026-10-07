/** Subject -> tint classes for chips, panels and lesson rows. One map, one look. */

const STYLES = {
  Physics: { chip: 'bg-sky-100 text-sky-800', panel: 'bg-sky-100', accent: 'text-sky-700' },
  Chemistry: { chip: 'bg-emerald-100 text-emerald-800', panel: 'bg-emerald-100', accent: 'text-emerald-700' },
  Maths: { chip: 'bg-violet-100 text-violet-800', panel: 'bg-violet-100', accent: 'text-violet-700' },
  Biology: { chip: 'bg-amber-100 text-amber-800', panel: 'bg-amber-100', accent: 'text-amber-700' },
  default: { chip: 'bg-indigo-100 text-indigo-800', panel: 'bg-indigo-100', accent: 'text-indigo-700' },
};

export function subjectStyle(subject) {
  return STYLES[subject] || STYLES.default;
}

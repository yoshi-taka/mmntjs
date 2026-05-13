export interface DurationMomentLike {
  isValid(): boolean;
  valueOf(): number;
  year(): number;
  month(): number;
  clone(): DurationMomentLike;
  add(amount: number, unit: string): DurationMomentLike;
}

export interface DurationBetweenParts {
  months: number;
  milliseconds: number;
  days: number;
}

export function diffMomentsForDuration(
  from: DurationMomentLike,
  to: DurationMomentLike,
): DurationBetweenParts {
  if (!from.isValid() || !to.isValid()) {
    return { months: 0, milliseconds: 0, days: 0 };
  }

  if (from.valueOf() <= to.valueOf()) {
    let months =
      to.month() -
      from.month() +
      (to.year() - from.year()) * 12;
    const adjusted = from.clone().add(months, "months");
    if (adjusted.valueOf() > to.valueOf()) {months--;}
    const base = from.clone().add(months, "months");
    const ms = to.valueOf() - base.valueOf();
    return {
      months: months || 0,
      milliseconds: ms || 0,
      days: 0,
    };
  }

  let months =
    from.month() -
    to.month() +
    (from.year() - to.year()) * 12;
  const adjusted = to.clone().add(months, "months");
  if (adjusted.valueOf() > from.valueOf()) {months--;}
  const base = to.clone().add(months, "months");
  const ms = -(from.valueOf() - base.valueOf());
  return {
    months: -months || 0,
    milliseconds: ms || 0,
    days: 0,
  };
}

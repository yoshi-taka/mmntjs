// Pairwise test matrix generator for mmntjs property tests
// Reference implementation — NOT imported by bundle; use in test files only.

export type Dimension<T extends string> = { name: string; values: readonly T[] };

function* pairs<T extends string>(
  ...dims: Dimension<T>[]
): Generator<Record<string, T>> {
  if (dims.length < 2) return;
  // generate all pairs of (dim_i value, dim_j value) for i < j
  for (let i = 0; i < dims.length - 1; i++) {
    for (let j = i + 1; j < dims.length; j++) {
      for (const vi of dims[i].values) {
        for (const vj of dims[j].values) {
          const rec: Record<string, T> = {};
          rec[dims[i].name] = vi;
          rec[dims[j].name] = vj;
          // fill remaining dims with first value
          for (let k = 0; k < dims.length; k++) {
            if (k !== i && k !== j) rec[dims[k].name] = dims[k].values[0];
          }
          yield rec;
        }
      }
    }
  }
}

function* triples<T extends string>(
  ...dims: Dimension<T>[]
): Generator<Record<string, T>> {
  if (dims.length < 3) return;
  for (let i = 0; i < dims.length - 2; i++) {
    for (let j = i + 1; j < dims.length - 1; j++) {
      for (let k = j + 1; k < dims.length; k++) {
        for (const vi of dims[i].values) {
          for (const vj of dims[j].values) {
            for (const vk of dims[k].values) {
              const rec: Record<string, T> = {};
              rec[dims[i].name] = vi;
              rec[dims[j].name] = vj;
              rec[dims[k].name] = vk;
              for (let d = 0; d < dims.length; d++) {
                if (d !== i && d !== j && d !== k)
                  rec[dims[d].name] = dims[d].values[0];
              }
              yield rec;
            }
          }
        }
      }
    }
  }
}

// ---- Dimensions ----

const units = ["year","month","day","hour","minute","second","millisecond","week","isoWeek","quarter"] as const;
const ops = ["add","subtract","startOf","endOf","diff"] as const;
const modes = ["utc","local"] as const;
const boundaries = ["normal","month-end","leap-year","dst-spring","dst-fall","epoch-zero"] as const;

const dimUnits: Dimension<string> = { name: "unit", values: units };
const dimOps: Dimension<string> = { name: "operation", values: ops };
const dimModes: Dimension<string> = { name: "mode", values: modes };
const dimBoundaries: Dimension<string> = { name: "boundary", values: boundaries };

// ---- Usage Example ----

// Pairwise: 154 cases (vs 10×5×2×6 = 600 full factorial)
const pairwiseCases = [...pairs(dimUnits, dimOps, dimModes, dimBoundaries)];

// 3-wise for critical triples: ~600 cases (still 3× smaller than full)
const tripleCases = [...triples(dimUnits, dimOps, dimModes, dimBoundaries)];

export { pairs, triples, dimUnits, dimOps, dimModes, dimBoundaries };

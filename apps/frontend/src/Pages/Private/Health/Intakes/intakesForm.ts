import type { IntakeKind, IntakeValues } from '../../../../Hooks/Health/intakesTypes';
import { alcoholFromAbv, numberField, parseDecimal, roundTo } from './intakesFormat';

export interface IntakeValuesForm {
  volumeMl: string;
  caffeineMg: string;
  abv: string;
  alcoholG: string;
}

export const EMPTY_VALUES_FORM: IntakeValuesForm = { volumeMl: '', caffeineMg: '', abv: '', alcoholG: '' };

export const valuesForm = (values: IntakeValues | null): IntakeValuesForm =>
  values
    ? {
        volumeMl: numberField(values.volumeMl),
        caffeineMg: numberField(values.caffeineMg),
        abv: '',
        alcoholG: numberField(values.alcoholG),
      }
    : EMPTY_VALUES_FORM;

const inRange = (value: number | null, max: number) => value == null || (!Number.isNaN(value) && value >= 0 && value <= max);

export const parseValues = (kind: IntakeKind, form: IntakeValuesForm): { values: IntakeValues; valid: boolean } => {
  const volumeMl = parseDecimal(form.volumeMl);
  const caffeineMg = parseDecimal(form.caffeineMg);
  const abv = parseDecimal(form.abv);
  const alcoholInput = parseDecimal(form.alcoholG);
  const alcoholG =
    alcoholInput == null && abv != null && !Number.isNaN(abv) && volumeMl != null && !Number.isNaN(volumeMl)
      ? alcoholFromAbv(volumeMl, abv)
      : alcoholInput;
  const valid =
    inRange(volumeMl, 10000) &&
    (kind !== 'CAFFEINE' || inRange(caffeineMg, 5000)) &&
    (kind !== 'ALCOHOL' || (inRange(abv, 100) && inRange(alcoholG, 1000)));
  const round = (value: number | null, digits: number) => (value == null || Number.isNaN(value) ? null : roundTo(value, digits));

  return {
    valid,
    values: {
      volumeMl: round(volumeMl, 0),
      caffeineMg: kind === 'CAFFEINE' ? round(caffeineMg, 1) : null,
      alcoholG: kind === 'ALCOHOL' ? round(alcoholG, 1) : null,
    },
  };
};

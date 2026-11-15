export type LabFlag = 'LOW' | 'HIGH' | 'ABNORMAL';

/**
 * Se um resultado está fora da referência. Nos numéricos decide-se aqui, a
 * partir dos limites; nos de texto ("Contém(+--)" quando o normal é "Ausente")
 * fica a marca que veio da leitura.
 */
export function labFlag(result: {
  value?: number | null;
  refLow?: number | null;
  refHigh?: number | null;
  flag?: string | null;
}): LabFlag | null {
  if (result.value != null) {
    if (result.refLow != null && result.value < result.refLow) return 'LOW';
    if (result.refHigh != null && result.value > result.refHigh) return 'HIGH';
    return null;
  }
  return result.flag === 'ABNORMAL' ? 'ABNORMAL' : null;
}

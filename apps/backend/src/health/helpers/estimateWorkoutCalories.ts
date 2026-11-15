/**
 * Calorias gastas num treino a partir do batimento médio (fórmula de Keytel et
 * al., 2005), com a idade, o sexo e o peso do perfil. Sem algum destes dados
 * não se estima. Para "outro" usa-se a média das duas fórmulas.
 */
export function estimateWorkoutCalories(input: {
  avgBpm: number;
  minutes: number;
  age: number | null;
  sex: string | null;
  weightKg: number | null;
}): number | null {
  const { avgBpm, minutes, age, sex, weightKg } = input;
  if (!age || !sex || !weightKg || minutes <= 0) return null;
  const male =
    (-55.0969 + 0.6309 * avgBpm + 0.1988 * weightKg + 0.2017 * age) / 4.184;
  const female =
    (-20.4022 + 0.4472 * avgBpm - 0.1263 * weightKg + 0.074 * age) / 4.184;
  const perMinute =
    sex === 'MALE' ? male : sex === 'FEMALE' ? female : (male + female) / 2;
  if (perMinute <= 0) return null;
  return Math.round(perMinute * minutes);
}

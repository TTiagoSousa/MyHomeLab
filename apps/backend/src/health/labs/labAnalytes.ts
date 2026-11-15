/**
 * As chaves normalizadas das análises mais comuns. O mesmo parâmetro aparece com
 * nomes diferentes de laboratório para laboratório ("Hemoglobina (Hgb)",
 * "Hemoglobina", "Hb"); a chave junta-os, para o histórico. O Claude escolhe
 * daqui quando o parâmetro existe; senão cria uma chave nova no mesmo formato.
 */
export const LAB_ANALYTES: Record<string, string> = {
  hemoglobin: 'Hemoglobina',
  red_blood_cells: 'Eritrócitos',
  hematocrit: 'Hematócrito',
  mcv: 'Volume globular médio (VGM)',
  mch: 'Hemoglobina globular média (HGM)',
  mchc: 'Concentração hemoglobínica globular média (CHGM)',
  rdw: 'RDW',
  white_blood_cells: 'Leucócitos',
  neutrophils: 'Neutrófilos',
  neutrophils_pct: 'Neutrófilos (%)',
  lymphocytes: 'Linfócitos',
  lymphocytes_pct: 'Linfócitos (%)',
  monocytes: 'Monócitos',
  monocytes_pct: 'Monócitos (%)',
  eosinophils: 'Eosinófilos',
  eosinophils_pct: 'Eosinófilos (%)',
  basophils: 'Basófilos',
  basophils_pct: 'Basófilos (%)',
  platelets: 'Plaquetas',
  mpv: 'Volume plaquetário médio',
  esr: 'Velocidade de sedimentação',
  glucose: 'Glicose',
  hba1c: 'Hemoglobina glicada (HbA1c)',
  insulin: 'Insulina',
  creatinine: 'Creatinina',
  egfr: 'Taxa de filtração glomerular estimada',
  urea: 'Ureia',
  uric_acid: 'Ácido úrico',
  total_cholesterol: 'Colesterol total',
  hdl_cholesterol: 'Colesterol HDL',
  ldl_cholesterol: 'Colesterol LDL',
  triglycerides: 'Triglicerídeos',
  sodium: 'Sódio',
  potassium: 'Potássio',
  chloride: 'Cloretos',
  calcium: 'Cálcio',
  magnesium: 'Magnésio',
  phosphorus: 'Fósforo',
  ast: 'AST (TGO)',
  alt: 'ALT (TGP)',
  ggt: 'Gama-glutamiltransferase (GGT)',
  alkaline_phosphatase: 'Fosfatase alcalina',
  total_bilirubin: 'Bilirrubina total',
  direct_bilirubin: 'Bilirrubina direta',
  total_protein: 'Proteínas totais',
  albumin: 'Albumina',
  crp: 'Proteína C reativa (PCR)',
  ferritin: 'Ferritina',
  iron: 'Ferro',
  transferrin: 'Transferrina',
  vitamin_d: 'Vitamina D (25-OH)',
  vitamin_b12: 'Vitamina B12',
  folate: 'Ácido fólico',
  tsh: 'TSH',
  free_t4: 'T4 livre',
  free_t3: 'T3 livre',
  psa: 'PSA',
  testosterone: 'Testosterona',
  cortisol: 'Cortisol',
  urine_color: 'Urina — cor',
  urine_appearance: 'Urina — aspeto',
  urine_ph: 'Urina — pH',
  urine_density: 'Urina — densidade',
  urine_protein: 'Urina — proteínas',
  urine_glucose: 'Urina — glicose',
  urine_ketones: 'Urina — corpos cetónicos',
  urine_hemoglobin: 'Urina — hemoglobina',
  urine_bilirubin: 'Urina — bilirrubina',
  urine_urobilinogen: 'Urina — urobilinogénio',
  urine_nitrites: 'Urina — nitritos',
  urine_leukocytes: 'Urina — leucócitos',
  urine_erythrocytes: 'Urina — eritrócitos',
  urine_epithelial_cells: 'Urina — células epiteliais',
};

/**
 * A chave de um resultado: a que vier, ou a do catálogo cujo nome bate com o
 * nome escrito (ex: "Vitamina D" → vitamin_d), ou uma nova feita do nome.
 */
export function resolveAnalyteKey(
  key: string | undefined,
  name: string,
): string {
  if (key) return analyteKey(key);
  const written = analyteKey(name);
  const catalog = Object.entries(LAB_ANALYTES).map(
    ([entryKey, entryName]) => [entryKey, analyteKey(entryName)] as const,
  );
  const exact = catalog.find(([, entryName]) => entryName === written);
  if (exact) return exact[0];
  const prefixed = catalog.filter(([, entryName]) =>
    entryName.startsWith(`${written}_`),
  );
  return prefixed.length === 1 ? prefixed[0][0] : written;
}

/** Uma chave no formato das outras (minúsculas, sem acentos, com _), para os parâmetros novos. */
export function analyteKey(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'parametro'
  );
}

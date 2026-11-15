/**
 * Os consumos predefinidos do site, com os valores de uma dose. O nome aqui é
 * o português (fica no registo e é o que o assistente usa); a interface mostra
 * a tradução pelo id. A cafeína e o álcool são valores médios de referência.
 */
export interface IntakePreset {
  id: string;
  kind: 'CAFFEINE' | 'ALCOHOL';
  name: string;
  volumeMl: number | null;
  caffeineMg: number | null;
  /** Teor alcoólico (% vol.), para calcular os gramas de álcool. */
  abv: number | null;
  alcoholG: number | null;
  /** Outros nomes por que se pede (para o assistente encontrar o predefinido). */
  aliases: string[];
}

/** Densidade do etanol: gramas de álcool = ml × %vol × 0,789. */
const ETHANOL_DENSITY = 0.789;

const caffeine = (
  id: string,
  name: string,
  volumeMl: number | null,
  caffeineMg: number,
  aliases: string[] = [],
): IntakePreset => ({
  id,
  kind: 'CAFFEINE',
  name,
  volumeMl,
  caffeineMg,
  abv: null,
  alcoholG: null,
  aliases,
});

const alcohol = (
  id: string,
  name: string,
  volumeMl: number,
  abv: number,
  aliases: string[] = [],
): IntakePreset => ({
  id,
  kind: 'ALCOHOL',
  name,
  volumeMl,
  caffeineMg: null,
  abv,
  alcoholG: Math.round(volumeMl * (abv / 100) * ETHANOL_DENSITY * 10) / 10,
  aliases,
});

export const INTAKE_PRESETS: IntakePreset[] = [
  caffeine('espresso', 'Café expresso', 30, 63, [
    'café',
    'bica',
    'cimbalino',
    'expresso',
  ]),
  caffeine('double_espresso', 'Café duplo', 60, 126, ['duplo']),
  caffeine('abatanado', 'Abatanado', 150, 80, ['americano', 'café americano']),
  caffeine('pingado', 'Café pingado', 40, 63, ['pingado']),
  caffeine('galao', 'Galão', 250, 63),
  caffeine('meia_de_leite', 'Meia de leite', 200, 63),
  caffeine('cappuccino', 'Cappuccino', 180, 63),
  caffeine('filter_coffee', 'Café de filtro', 240, 95, ['café de saco']),
  caffeine('instant_coffee', 'Café solúvel', 250, 60, ['nescafé', 'solúvel']),
  caffeine('decaf', 'Descafeinado', 30, 3, ['descafeinado']),
  caffeine('black_tea', 'Chá preto', 250, 47, ['chá']),
  caffeine('green_tea', 'Chá verde', 250, 28),
  caffeine('cola', 'Cola (lata)', 330, 34, ['coca-cola', 'pepsi', 'coca cola']),
  caffeine('energy_drink', 'Bebida energética (lata)', 250, 80, [
    'red bull',
    'monster pequeno',
  ]),
  caffeine('energy_drink_large', 'Bebida energética grande', 500, 160, [
    'monster',
  ]),
  caffeine('pre_workout', 'Pré-treino', null, 200, ['pre treino']),
  caffeine('caffeine_pill', 'Cafeína em comprimido', null, 200),

  alcohol('beer_imperial', 'Imperial / fino', 200, 5, [
    'imperial',
    'fino',
    'cerveja',
  ]),
  alcohol('beer_mini', 'Mini', 250, 5, ['mini']),
  alcohol('beer_bottle', 'Cerveja (garrafa 33 cl)', 330, 5, [
    'garrafa de cerveja',
    'cerveja de garrafa',
  ]),
  alcohol('beer_pint', 'Caneca de cerveja', 500, 5, ['caneca', 'pint']),
  alcohol('beer_craft', 'Cerveja artesanal', 330, 7, ['artesanal', 'ipa']),
  alcohol('beer_free', 'Cerveja sem álcool', 330, 0.5, ['sem álcool']),
  alcohol('cider', 'Sidra', 330, 4.5),
  alcohol('wine_glass', 'Copo de vinho', 150, 13, [
    'vinho',
    'vinho tinto',
    'vinho branco',
  ]),
  alcohol('wine_green', 'Copo de vinho verde', 150, 10, ['vinho verde']),
  alcohol('sparkling', 'Flute de espumante', 125, 12, [
    'espumante',
    'champanhe',
  ]),
  alcohol('port', 'Vinho do Porto', 75, 19, ['porto', 'moscatel']),
  alcohol('sangria', 'Copo de sangria', 250, 8, ['sangria']),
  alcohol('spirit_shot', 'Shot', 40, 40, [
    'shot',
    'aguardente',
    'tequila',
    'vodka',
  ]),
  alcohol('whisky', 'Whisky', 40, 40, ['whiskey']),
  alcohol('gin_tonic', 'Gin tónico', 50, 40, ['gin', 'gin tónico']),
  alcohol('cocktail', 'Cocktail', 60, 40, ['caipirinha', 'mojito']),
  alcohol('liqueur', 'Licor', 40, 25, ['licor', 'licor beirão', 'ginjinha']),
];

export const INTAKE_PRESET_BY_ID = new Map(
  INTAKE_PRESETS.map((preset) => [preset.id, preset]),
);

/** Gramas de álcool puro numa bebida padrão (o valor usado em Portugal). */
export const STANDARD_DRINK_G = 10;

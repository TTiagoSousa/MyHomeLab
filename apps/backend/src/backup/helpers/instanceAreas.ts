/**
 * A pasta de cada tabela dentro do backup do MyHomeLab. Uma tabela que não está aqui
 * (ex: uma nova) vai para "outros/" — nada fica de fora.
 */
const AREAS: Record<string, string[]> = {
  utilizadores: ['User'],
  agentes: [
    'Agent',
    'AgentSetting',
    'AgentLog',
    'AgentAppAccess',
    'AssistantPermissionSetting',
  ],
  disparos: ['AgentSchedule', 'AgentScheduleRun'],
  assistente: ['Conversation', 'ChatMessage'],
  ia: ['AiCredential', 'AiUsage', 'AiRouting'],
  documentos: [
    'Doc',
    'DocSection',
    'DocLink',
    'DocVersion',
    'DocProposal',
    'DocSeed',
  ],
  projetos: [
    'Project',
    'BoardState',
    'BoardModule',
    'BoardCycle',
    'BoardTask',
    'BoardTaskModule',
    'BoardTaskRelation',
    'BoardTaskAttachment',
    'BoardTaskComment',
    'BoardTaskLink',
    'BoardTaskActivity',
  ],
  tarefas: [
    'TodoList',
    'Todo',
    'TodoSyncSetting',
    'TodoSyncGroup',
    'TodoSyncLink',
    'TodoSyncItem',
  ],
  'apps-ligadas': [
    'ConnectedAccount',
    'OpenGymConnection',
    'OpenGymExercise',
    'CronJob',
  ],
  atualizacoes: [
    'AppUpdate',
    'UpdateWorkflowSetting',
    'UpdateAttempt',
    'UpdateAttemptCheck',
  ],
  servidores: ['ServerConnection', 'ServerCommand', 'DiskReading', 'DiskAlert'],
  servicos: ['Category', 'Service', 'ServiceMonitor'],
  email: ['EmailRule', 'EmailRuleLabelPath', 'EmailRuleProposal'],
  backups: [
    'BackupDestination',
    'BackupJob',
    'BackupRun',
    'InstanceBackupSetting',
  ],
  notificacoes: ['Notification'],
  saude: [
    'HealthProfile',
    'SleepSession',
    'HeartRateDay',
    'SkinTemperatureDay',
    'BloodOxygenDay',
    'StressDay',
    'ActivityDay',
    'ExerciseType',
    'Workout',
    'WeightEntry',
    'WaterEntry',
    'LabReport',
    'LabResult',
    'Medication',
    'HealthCondition',
    'HealthDiaryEntry',
    'Meal',
    'IntakeEntry',
    'IntakeItem',
    'IntakeSettings',
    'BodyMeasurement',
    'ProgressPhoto',
    'VitalReading',
    'MoodEntry',
    'Habit',
    'HabitCheck',
    'Fast',
    'MedicalAppointment',
    'Vaccine',
    'MedicalExam',
    'IllnessEpisode',
    'VisionPrescription',
    'ContactLensCycle',
    'HealthReminderSent',
  ],
};

const AREA_OF = new Map(
  Object.entries(AREAS).flatMap(([area, tables]) =>
    tables.map((table) => [table, area] as const),
  ),
);

/** "projetos/BoardTask.jsonl" */
export const tableFile = (table: string) =>
  `${AREA_OF.get(table) ?? 'outros'}/${table}.jsonl`;

export const AREA_DESCRIPTIONS: Record<string, string> = {
  utilizadores: 'as contas do MyHomeLab (as passwords vão com hash)',
  agentes:
    'os agentes, a equipa, as definições e os acessos de cada um (agentes/*.md: o prompt de cada agente, para ler)',
  disparos: 'os disparos (tarefas agendadas dos agentes) e as execuções',
  assistente: 'as conversas com o Jarvis',
  ia: 'as credenciais da IA (cifradas) e o consumo',
  documentos:
    'os documentos, as secções, as ligações entre eles e as versões (documentos/leitura/: cada documento em Markdown, para ler)',
  projetos:
    'os projetos, as colunas, as tarefas, os comentários, as ligações e o histórico',
  tarefas: 'as tarefas pessoais e a sincronização',
  'apps-ligadas':
    'as apps ligadas, com os logins e tokens (cifrados com a chave que vai em _restauro/)',
  atualizacoes: 'as atualizações das apps, os estudos e as tentativas',
  servidores:
    'os servidores, os comandos, as leituras dos discos e os avisos de disco',
  servicos: 'os serviços, as categorias e os monitores',
  email: 'as regras do email e as propostas',
  backups: 'os destinos e os backups automáticos',
  notificacoes: 'as notificações',
  saude: 'a saúde: sono, treinos, peso, análises, medicação, refeições, …',
  outros: 'as tabelas que ainda não têm pasta própria',
};

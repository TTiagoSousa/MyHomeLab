import { needsDocsFirst } from './readFirstTools';

describe('ler as regras antes de alterar', () => {
  it.each([
    'tplink_router_reboot',
    'tplink_router_port_forward',
    'draft_email',
    'board_update',
    'schedule_create',
    'create_agent',
    'todo_create',
    'update_set_status',
    'server_run_command',
    'health_log',
  ])('%s precisa das regras lidas', (name) => {
    expect(needsDocsFirst(name)).toBe(true);
  });

  it.each(['board_comment', 'docs_log', 'docs_propose', 'list_servers'])(
    '%s não precisa',
    (name) => {
      expect(needsDocsFirst(name)).toBe(false);
    },
  );
});

import { isReadOnlyOpenGymTool, openGymMcpOf } from './openGymMcp.client';

describe('openGymMcp', () => {
  it('só há MCP com o endereço e o token de API', () => {
    expect(
      openGymMcpOf({ baseUrl: 'https://gym.lan/', apiClientSecret: null }),
    ).toBeNull();
    expect(
      openGymMcpOf({ baseUrl: 'https://gym.lan/', apiClientSecret: 'ogt_x' }),
    ).toEqual({ baseUrl: 'https://gym.lan/', token: 'ogt_x' });
  });

  it('a anotação manda; sem ela, a lista das que só leem', () => {
    expect(isReadOnlyOpenGymTool({ name: 'estimate_1rm' })).toBe(true);
    expect(isReadOnlyOpenGymTool({ name: 'log_workout' })).toBe(false);
    expect(
      isReadOnlyOpenGymTool({
        name: 'log_workout',
        annotations: { readOnlyHint: true },
      }),
    ).toBe(true);
  });
});

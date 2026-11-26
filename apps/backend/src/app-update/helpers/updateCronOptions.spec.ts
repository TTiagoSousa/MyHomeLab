import { BadRequestException } from '@nestjs/common';
import {
  UPDATE_CRON_JOBS,
  partOfJob,
  partOfUpdate,
  updateCronOptions,
} from './updateCronOptions';

describe('opções do cron job das atualizações', () => {
  it('sem nada fica só disponível, com Espera por estudo como coluna', () => {
    expect(updateCronOptions(undefined, true)).toEqual({
      board: false,
      projectId: null,
      column: 'study',
    });
  });

  it('com quadro, ao ligar, pede o projeto', () => {
    expect(() => updateCronOptions({ board: true }, true)).toThrow(
      BadRequestException,
    );
    expect(updateCronOptions({ board: true }, false).board).toBe(true);
  });

  it('só aceita Todo ou Espera por estudo', () => {
    expect(
      updateCronOptions({ board: true, projectId: 'p', column: 'new' }, true)
        .column,
    ).toBe('new');
    expect(
      updateCronOptions({ board: true, projectId: 'p', column: 'ready' }, true)
        .column,
    ).toBe('study');
  });

  it('a app e as peças são cron jobs à parte', () => {
    expect(partOfJob(UPDATE_CRON_JOBS.app)).toBe('app');
    expect(partOfJob(UPDATE_CRON_JOBS.haComponents)).toBe('components');
    expect(partOfJob(UPDATE_CRON_JOBS.nextcloudApps)).toBe('components');
    expect(partOfJob('adguard.refresh_blocklists')).toBeNull();
    expect(partOfUpdate({ component: null })).toBe('app');
    expect(partOfUpdate({ component: 'update.tapo' })).toBe('components');
  });
});

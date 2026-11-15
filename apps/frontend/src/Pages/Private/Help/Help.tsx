import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './Help.scss';
import * as Icon from '../../../Imports/icons';

interface Help_Topic {
  id: string;
  adminOnly?: boolean;
  page?: string;
  links?: { label: string; url: string }[];
}

const TOPICS: Help_Topic[] = [
  { id: 'start' },
  { id: 'today', page: '/MyHomeLab/Today' },
  { id: 'shortcuts', page: '/MyHomeLab/Services' },
  { id: 'apps', page: '/MyHomeLab/Apps' },
  { id: 'ai', page: '/MyHomeLab/Assistant/Settings?section=ai', links: [{ label: 'console.anthropic.com', url: 'https://console.anthropic.com/settings/keys' }] },
  { id: 'google', adminOnly: true, page: '/MyHomeLab/Apps/Gmail', links: [{ label: 'console.cloud.google.com', url: 'https://console.cloud.google.com/' }] },
  { id: 'emailRules', page: '/MyHomeLab/Apps/Gmail/Rules' },
  { id: 'nextcloud', page: '/MyHomeLab/Apps' },
  { id: 'proxmox', page: '/MyHomeLab/Apps/Proxmox' },
  { id: 'services', page: '/MyHomeLab/Servers' },
  { id: 'forgejo', page: '/MyHomeLab/Apps/Forgejo' },
  { id: 'trek', page: '/MyHomeLab/Apps/Trek' },
  { id: 'homeAssistant', page: '/MyHomeLab/Apps/HomeAssistant' },
  { id: 'adguard', page: '/MyHomeLab/Apps/AdGuard' },
  { id: 'docs', page: '/MyHomeLab/Docs' },
  { id: 'todos', page: '/MyHomeLab/Tasks' },
  { id: 'tasks', page: '/MyHomeLab/Projects' },
  { id: 'appUpdates', page: '/MyHomeLab/Projects' },
  { id: 'assistant', page: '/MyHomeLab/Assistant' },
  { id: 'updates', adminOnly: true, page: '/MyHomeLab/Admin' },
  { id: 'users', adminOnly: true, page: '/MyHomeLab/Admin' },
];

const asList = (value: unknown): string[] => (Array.isArray(value) ? value : []);

const Help = () => {
  const { t } = useTranslation('help');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const linkedTopic = TOPICS.find((topic) => topic.id === params.get('topic'))?.id;
  const [openTopic, setOpenTopic] = useState<string | null>(linkedTopic ?? 'start');

  const toggle = (id: string) => setOpenTopic(openTopic === id ? null : id);

  const goTo = (id: string) => {
    setOpenTopic(id);
    document.getElementById(`help-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (linkedTopic) document.getElementById(`help-${linkedTopic}`)?.scrollIntoView({ block: 'start' });
  }, [linkedTopic]);

  return (
    <div className='Help'>
      <header>
        <div className='Right_Side'>
          <span>{t('title')}</span>
        </div>
      </header>

      <p className='Help_intro'>{t('intro')}</p>

      <div className='Help_layout'>
        <nav className='Help_index'>
          {TOPICS.map((topic) => (
            <button
              key={topic.id}
              type='button'
              className={openTopic === topic.id ? 'active' : ''}
              onClick={() => goTo(topic.id)}
            >
              {t(`topics.${topic.id}.title`)}
            </button>
          ))}
        </nav>

        <div className='Help_topics'>
          {TOPICS.map((topic) => {
            const steps = asList(t(`topics.${topic.id}.steps`, { returnObjects: true }));
            const notes = asList(t(`topics.${topic.id}.notes`, { returnObjects: true }));
            const expanded = openTopic === topic.id;

            return (
              <section id={`help-${topic.id}`} key={topic.id} className={`Help_topic${expanded ? ' expanded' : ''}`}>
                <button type='button' className='Help_topic_head' onClick={() => toggle(topic.id)}>
                  <span className='Help_topic_chevron'>
                    <Icon.Chevron />
                  </span>
                  <span className='Help_topic_text'>
                    <span className='Help_topic_title'>
                      {t(`topics.${topic.id}.title`)}
                      {topic.adminOnly && <span className='Help_tag'>{t('adminTag')}</span>}
                    </span>
                    <span className='Help_topic_summary'>{t(`topics.${topic.id}.summary`)}</span>
                  </span>
                </button>

                <div className='Help_topic_body'>
                  <div className='Help_topic_inner'>
                    <ol className='Help_steps'>
                      {steps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>

                    {notes.length > 0 && (
                      <ul className='Help_notes'>
                        {notes.map((note, index) => (
                          <li key={index}>{note}</li>
                        ))}
                      </ul>
                    )}

                    {(topic.page || topic.links) && (
                      <div className='Help_actions'>
                        {topic.links?.map((link) => (
                          <a key={link.url} href={link.url} target='_blank' rel='noreferrer'>
                            {t('open', { name: link.label })} ↗
                          </a>
                        ))}
                        {topic.page && (
                          <button type='button' onClick={() => navigate(topic.page!)}>
                            {t(`topics.${topic.id}.goTo`)}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Help;

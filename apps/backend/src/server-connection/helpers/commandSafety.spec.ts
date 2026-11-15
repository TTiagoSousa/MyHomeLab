import { classifyCommand } from './commandSafety';

describe('classifyCommand', () => {
  it.each([
    'df -h',
    'cat /etc/os-release',
    'journalctl -u nginx -n 50',
    'pct list',
    'pct exec 113 -- df -h',
    'docker ps -a',
    'systemctl status forgejo',
    'ls -la /var/log | grep error | tail -n 20',
    'sudo free -m',
    `pct exec 103 -- docker inspect --format '{{.Name}} | {{range .Mounts}}{{.Source}} -> {{.Destination}}; {{end}}' coolify`,
    'grep -E "a|b" /etc/hosts',
    'qm guest cmd 101 network-get-interfaces',
    'dpkg-query -W grub-common shim-signed systemd pve-manager',
    'qm guest exec 101 -- df -h /var/www/nextcloud',
    'qm guest exec 101 --timeout 60 -- runuser -u www-data -- php /var/www/nextcloud/occ status',
    'qm guest exec 101 --timeout 120 -- runuser -u www-data -- php /var/www/nextcloud/occ app:update --showonly',
    'qm guest exec 101 -- runuser -u www-data -- php /var/www/nextcloud/occ db:schema:check',
    'qm guest exec 101 -- runuser -u www-data -- php /var/www/nextcloud/occ log:file',
    'qm guest exec 101 -- tail -n 40 /var/www/nextcloud-data/nextcloud.log',
  ])('"%s" só lê', (command) => {
    expect(classifyCommand(command)).toBe('read');
  });

  it.each([
    '',
    'rm -rf /tmp/x',
    'pct resize 113 rootfs +5G',
    'systemctl restart nginx',
    'apt upgrade -y',
    'tail -f /var/log/syslog',
    'cat a > b',
    'df -h; reboot',
    'echo $(whoami)',
    'find / -name x -delete',
    'pct exec 113 -- rm -rf /data',
    'ls | xargs rm',
    'cat "sem fim',
    'echo "$(reboot)"',
    'cat "`reboot`"',
    "grep 'x' a > b",
    'qm guest cmd 101 fsfreeze-freeze',
    'qm guest exec 101 -- rm -rf /',
    'qm guest exec 101 df -h',
    'qm guest exec 101 --timeout 300 -- runuser -u www-data -- php /var/www/nextcloud/occ app:update calendar',
    'qm guest exec 101 -- runuser -u www-data -- php /var/www/nextcloud/occ maintenance:mode --on',
    'qm guest exec 101 -- runuser -u www-data -- php /var/www/nextcloud/occ upgrade',
    'runuser -u www-data -- rm -rf /var/www',
    'sed -i s/a/b/ /etc/x.conf',
    'sed -n 18,80p -i /etc/x',
    "sed -n '1w /tmp/x' /etc/x",
    'forgejo --version --config x',
  ])('"%s" altera', (command) => {
    expect(classifyCommand(command)).toBe('write');
  });

  it.each([
    'pct exec 113 -- /usr/local/bin/forgejo --version',
    'pct exec 113 -- sed -n 18,80p /etc/forgejo/app.ini',
    "sed -n '$p' /var/log/syslog",
    'nginx -V',
  ])('"%s" só lê', (command) => {
    expect(classifyCommand(command)).toBe('read');
  });

  it('2>&1 e 2>/dev/null não contam como redireção', () => {
    expect(classifyCommand('df -h 2>&1')).toBe('read');
    expect(classifyCommand('ls /root 2>/dev/null')).toBe('read');
  });
});

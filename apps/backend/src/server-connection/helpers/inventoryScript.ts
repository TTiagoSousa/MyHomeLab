/**
 * O inventário do servidor num só comando: o host (versão, CPU, RAM, discos,
 * pools, storages, rede, serviços falhados, backups) e, para cada CT e VM, a
 * configuração e — nos CTs ligados — os IPs, os serviços, os contentores Docker
 * e as portas. Só lê. É escrito aqui e não pelo agente, por isso corre sem
 * aprovação; poupa dezenas de voltas ao estudar o servidor.
 */
export const INVENTORY_SCRIPT = String.raw`
section() { printf '\n===== %s =====\n' "$1"; }

section HOST
hostname; pveversion 2>/dev/null; uptime; echo "CPUs: $(nproc)"
free -h
df -h -x tmpfs -x devtmpfs -x overlay 2>/dev/null

section DISCOS
lsblk -o NAME,SIZE,TYPE,MODEL,MOUNTPOINT 2>/dev/null

section ZFS
zpool list 2>/dev/null; zpool status -x 2>/dev/null

section STORAGES
pvesm status 2>/dev/null

section REDE
ip -br a 2>/dev/null; ip route 2>/dev/null | head -5

section FALHAS
systemctl --failed --no-legend --no-pager 2>/dev/null || true

section BACKUPS
pvesh get /cluster/backup --output-format json-pretty 2>/dev/null | head -c 4000

section CONTAINERS
for id in $(pct list 2>/dev/null | awk 'NR>1{print $1}'); do
  echo "--- CT $id"
  pct config "$id" 2>/dev/null | grep -E '^(hostname|cores|memory|swap|rootfs|mp[0-9]+|net[0-9]+|onboot|startup|features|tags|unprivileged):'
  state=$(pct status "$id" 2>/dev/null | awk '{print $2}')
  echo "status: $state"
  if [ "$state" = "running" ]; then
    timeout 20 pct exec "$id" -- sh -c '
      echo "ip: $(ip -4 -o addr show scope global 2>/dev/null | awk "{print \$4}" | tr "\n" " ")"
      echo "servicos: $(systemctl list-units --type=service --state=running --no-legend --no-pager 2>/dev/null | awk "{print \$1}" | grep -vE "^(systemd|dbus|cron|getty|ssh|rsyslog|postfix|networking|ifupdown|console-getty|container-getty|user@|serial-getty|polkit|unattended|chrony|apparmor)" | head -25 | tr "\n" " ")"
      if command -v docker >/dev/null 2>&1; then
        echo "docker:"
        docker ps --format "  {{.Names}} | {{.Image}} | {{.Status}} | {{.Ports}}" 2>/dev/null | head -30
      fi
      echo "portas: $(ss -tlnH 2>/dev/null | awk "{print \$4}" | sort -u | head -20 | tr "\n" " ")"
    ' 2>/dev/null || echo "(sem resposta de dentro do CT)"
  fi
done

section VMS
for id in $(qm list 2>/dev/null | awk 'NR>1{print $1}'); do
  echo "--- VM $id"
  qm config "$id" 2>/dev/null | grep -E '^(name|cores|sockets|memory|scsi[0-9]+|virtio[0-9]+|sata[0-9]+|net[0-9]+|onboot|startup|agent|tags):'
  qm status "$id" 2>/dev/null
done
`;

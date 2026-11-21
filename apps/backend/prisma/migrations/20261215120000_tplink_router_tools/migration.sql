-- O Engenheiro de Infraestrutura recebe as ferramentas do router TP-Link.
UPDATE "Agent"
SET "tools" = "tools" || ARRAY['tplink_router_overview', 'tplink_router_clients', 'tplink_router_wifi', 'tplink_router_dhcp', 'tplink_router_port_forwards', 'tplink_router_access', 'tplink_router_wifi_set', 'tplink_router_block', 'tplink_router_access_control', 'tplink_router_reservation', 'tplink_router_port_forward', 'tplink_router_wan_renew', 'tplink_router_reboot']::TEXT[], "updatedAt" = NOW()
WHERE "template" = 'infra' AND NOT ('tplink_router_overview' = ANY("tools"));

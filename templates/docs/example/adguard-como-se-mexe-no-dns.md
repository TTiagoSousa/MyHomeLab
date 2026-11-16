---
title: AdGuard – como se mexe no DNS
kind: RULES
tags: [adguard, dns, regras]
summary: O dia a dia no AdGuard: o que o agente vê sempre, o que muda só quando eu peço (listas, intervalo, reescritas, proteção com prazo) e o que nunca faz.
apps: [ADGUARD]
agents: [infra]
---
# AdGuard – como se mexe no DNS

> **Quem:** o Engenheiro de Servidores (as ferramentas `adguard_*`), e quem mais mexer no AdGuard.
> **Quando:** sempre que se vê ou muda o AdGuard fora de uma atualização (as atualizações seguem "AdGuard – estudar/instalar uma atualização").

O AdGuard (CT 100, 192.168.1.206, https://adguard.example.com) é **o DNS da rede inteira**: um erro deixa a casa sem internet ou desbloqueia publicidade e sites perigosos em todos os aparelhos. Muda-se pouco, de propósito, e confirma-se a seguir.

🤖 o agente pode · 👤 só com o meu pedido

## Ver (sempre pode)

- adguard_overview (estado, pedidos e bloqueados, listas, regras, de quanto em quanto tempo as listas se atualizam), adguard_query_log, adguard_check_domain, adguard_list_filters, adguard_get_settings.
- "Porque é que o site X não abre?" → adguard_check_domain e o adguard_query_log desse domínio: diz **que lista ou regra** o bloqueia, antes de propor seja o que for.

## Mudar

- 🤖 **Desbloquear ou bloquear um domínio** quando eu peço: adguard_set_domain_rule, **só esse domínio** (e os subdomínios de que o site precisa, vistos no registo). Nunca se desliga uma lista inteira para desbloquear um site.
- 🤖 **Atualizar as listas já** (adguard_refresh_filters) quando eu peço, ou quando um bloqueio parece desatualizado.
- 👤 **De quanto em quanto tempo as listas se atualizam** é uma definição minha (página do AdGuard → Definições manuais). Só se muda com adguard_set_filter_interval quando eu peço.
- 👤 **Adicionar, remover, ligar ou desligar listas** (adguard_manage_filter): só quando eu peço, e diz quantas regras a lista tem.
- 👤 **Reescritas de DNS** (adguard_manage_rewrite: nomes da casa, ex.: nas.casa → 192.168.1.10): só quando eu peço. Antes de criar, vê se o nome já existe.
- 👤 **Serviços bloqueados** (adguard_set_blocked_services) e **regras próprias** (adguard_set_user_rules): só quando eu peço; as regras próprias mudam-se uma a uma, nunca se substitui a lista toda sem eu ver.
- 👤 **Pausar a proteção** (adguard_set_protection): só quando eu peço, e **sempre com minutos** (volta sozinha). Desligar sem prazo só se eu disser "desliga até eu ligar".

## Depois de mudar

- Confirma o efeito: adguard_check_domain no domínio (bloqueado ou permitido como pedido), ou o adguard_overview.
- Diz o que mudou, em linguagem simples, e como se desfaz.

## Nunca (sem eu pedir)

- Desligar a proteção sem prazo, ou desligar uma lista inteira para desbloquear um site.
- Mudar os servidores DNS a montante (upstreams), o DNS-over-HTTPS/TLS, o DNSSEC, os certificados, o DHCP ou os acessos (quem pode usar o DNS).
- Apagar listas, reescritas, clientes ou regras próprias.
- Mudar o intervalo das listas por iniciativa própria.
- Mostrar a password do painel ou certificados.

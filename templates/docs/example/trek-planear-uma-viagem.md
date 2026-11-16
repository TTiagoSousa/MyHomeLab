---
title: TREK – planear uma viagem
kind: RULES
tags: [trek, viagens]
summary: Como pôr uma viagem no TREK bem feita: lugares verdadeiros por ordem e com hora, trajetos de carro ou a pé, alojamento, transportes, horários e tempo, e a verificação no fim.
apps: [TREK]
agents: [travel]
---
# TREK – planear uma viagem

> **Quando usar:** sempre que se cria ou muda uma viagem no TREK (https://trek.example.com).
> **Quem:** o Agente de Viagens. As ferramentas do TREK chegam **diretamente do MCP do TREK**, com o nome `mcp__trek__<ferramenta>` (ex.: `mcp__trek__create_trip`) e os argumentos de cada uma. Se não aparecerem (o TREK em baixo ou sem o cliente MCP), `trek_overview` diz porquê, e há as de recurso: `trek_tools`, `trek_tool_help`, `trek_read` e `trek_write`.

A viagem tem de ficar como eu a faria na app: **lugares verdadeiros no mapa, por ordem e com hora, com os trajetos de carro ou a pé**. Uma lista de notas de texto não serve.

Os nomes abaixo são os do MCP do TREK (sem o prefixo `mcp__trek__`). Mudam com a versão do TREK: usa os que tens na lista de ferramentas. Num disparo, sem ele a acompanhar, só tens as que leem.

## 1. Antes de criar

- **Datas com ano:** "16 a 17" sem mês → pergunta. O ano é o atual se as datas ainda não passaram.
- **De onde saio e para onde volto** (por omissão, a tua cidade), **o transporte** (carro, comboio, avião) e **o alojamento**.
- O que faltar pergunta-se **numa só mensagem**, tudo junto.
- Já há uma viagem parecida? `list_trips`. Não cries outra por cima.

## 2. A viagem e os dias

- `create_trip` com o título ("Casa → Viana do Castelo"), as datas e a moeda (EUR). Os dias criam-se sozinhos.
- `update_day` dá um título a cada dia ("Viana e Santa Luzia").
- Uma capa: `search_cover_images` e o URL escolhido em `update_trip` (opcional, fica bonito).

## 3. Os lugares (o mais importante)

Cada paragem é um **lugar** com coordenadas, ligado ao dia:

1. `search_place` com o nome e a cidade ("Templo de Santa Luzia, Viana do Castelo"). Tira as coordenadas, a morada e o `google_place_id` (ou `osm_id`).
2. `create_and_assign_place` com esses dados, a **categoria** certa (`list_categories`: monumento, restaurante, hotel, miradouro…) e o dia. Uma só chamada cria o lugar e põe-no no dia.
3. **A hora** de cada paragem: `update_assignment_time` (início e fim, ex.: "16:00"–"16:45").
4. **A ordem** do dia: `reorder_day_assignments` (a ordem é a do trajeto).

Regras:
- **O ponto de partida e o de chegada são lugares**: a cidade ou a casa no início do primeiro dia (com a hora de saída) e no fim do último (com a hora de chegada). Assim o trajeto começa e acaba lá.
- **Nunca notas de texto a repetir o plano** (`create_day_note`). As notas só servem para avisos que não são um lugar ("check-out até às 12:00", "levar casaco"). Na dúvida, a nota fica no próprio lugar (`update_assignment_notes`).
- **Nunca duas paragens à mesma hora.** Uma alternativa ("praia ou Ponte de Lima") cria-se com `create_place` sem dia (fica na lista de lugares) e pergunta-se qual entra no percurso.
- Um nome que não aparece (ex.: "Hotel de Santa Luzia" é hoje a "Pousada Viana do Castelo"): usa o mais provável e diz qual escolheste, para eu confirmar.
- Um sítio que é só passagem (abastecer, portagem): `stop_type` de serviço, ou `set_assignment_route_excluded` para ficar no dia mas fora da rota.

## 4. Os trajetos

O TREK desenha as rotas entre paragens seguidas de um dia, com o modo de cada troço:

- `set_day_default_transport_mode`: o modo do dia (o normal numa viagem de carro: `driving`).
- `set_leg_transport_mode` no lugar (`direction: outgoing`, o troço que sai dele): **a pé** entre sítios perto uns dos outros (um centro histórico, um monte), **de carro** entre zonas ou cidades.
- Exemplo (Viana): carro Casa → Vila do Conde → Viana; a pé no centro (Praça da República → Chafariz → Sé → Gil Eannes → Ponte Eiffel → Castelo); carro do Castelo até à Pousada; a pé Pousada → Templo → Citânia.
- **O TREK não calcula distâncias nem tempos de carro ou a pé**, só de transportes públicos. Dá estimativas tuas e diz que são estimativas.
- Comboio, metro, autocarro: `search_transit_stops` e `search_transit_routes` (com a hora) e guarda a escolhida com `create_transit_journey`. Aí o TREK tem horários e tempos reais.

## 5. Transportes e alojamento

- **Entre cidades:** `create_transport` (tipo `car`, `train`, `flight`, `bus`…) com a origem, o destino, o dia e a hora. Uma ida e uma volta. Voos: `search_airports` para os códigos IATA.
- **Alojamento:** `create_place_accommodation` (o lugar e a estadia juntos), com o check-in e o check-out (dias e horas). Se o hotel já for um lugar, `create_accommodation`.
- **Estado:** as reservas ficam **pendentes**. Só passam a confirmadas (`update_reservation` status `confirmed`) se eu disser que estão reservadas.
- Restaurantes, bilhetes, visitas guiadas com hora marcada: `create_reservation` com o link e a hora.

## 6. Afinar com dados reais

- **Horários:** `get_place_details` (pelo `google_place_id`) mostra se abre nesse dia e hora. Museus fecham muitas vezes à segunda. Ajusta e diz.
- **Tempo:** `get_weather` / `get_detailed_weather` nos dias com previsão. Chuva → troca o ar livre por coberto, ou avisa.
- **Ideias perto:** `search_nearby_places` (raio em metros) ou `search_pois` (por categoria no mapa) para encher as horas mortas com o que está mesmo ao lado.
- **Ritmo:** contar tempo para estacionar, comer e andar. Um dia cheio demais não é bom plano.

## 7. Extra (só se eu pedir ou der preços)

- **Orçamento:** `create_budget_item` (ligado ao lugar ou à reserva), na moeda da viagem.
- **Bagagem:** a lista de bagagem da viagem (ferramentas `packing`).
- **Tarefas:** as tarefas da viagem (ferramentas `todos`): "reservar mesa", "levar carregador".
- **Quem vai:** `create_trip_guest` para quem não tem conta. Partilhar (`create_share_link`) ou convidar só se eu pedir.

## 8. No fim

1. `get_trip_summary`: cada dia tem os lugares por ordem, com hora; o alojamento tem as horas; os transportes estão lá; não ficaram notas a repetir o plano.
2. `get_trip_warnings`: sem avisos (se houver, corrige ou diz).
3. O relatório diz: o dia a dia com as horas e o modo de cada troço (🚗/🚶), o alojamento, os transportes e o estado, o que mudaste e porquê, as estimativas de tempo, e o que eu tenho de decidir.
4. Não vês o mapa, só os dados: pede para eu confirmar os trajetos na app.

## Nunca

- Planos como notas de texto em vez de lugares.
- Duas paragens à mesma hora.
- Apagar ou mudar uma viagem, lugar ou reserva que eu já tinha sem eu pedir (o que apaga pede `confirm`).
- Confirmar reservas, partilhar a viagem, convidar pessoas ou mudar as definições do TREK sem eu pedir.
- Inventar distâncias e tempos como se fossem do TREK.

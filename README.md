# MOP — Monitoramento Operacional

![NOXUZ — Cybersecurity & Technology](assets/noxuz-logo.png)

**Aplicativo de livro de turno, ocorrências e continuidade operacional para Windows.** Desenvolvido por NOXUZ.

O MOP reúne os registros da operação, as pendências que precisam de acompanhamento e as informações da troca de turno em um só lugar. Ele foi pensado para equipes que trabalham em turnos — como portarias, centrais de monitoramento e operações prediais — e precisam saber o que aconteceu, o que continua aberto, quem está acompanhando e o que precisa ser feito a seguir.

## Objetivo de uso

Utilize o MOP para registrar e acompanhar a rotina operacional e entregar cada turno ao seguinte com contexto claro. Cada ocorrência tem protocolo, prioridade, status, responsável, prazo, histórico de atualizações e próxima ação. A passagem de turno preserva uma fotografia das pendências no momento do recebimento.

O aplicativo pode ser usado em um computador sem internet. Quando a equipe precisa compartilhar informações entre computadores, o MOP sincroniza as alterações com uma central Supabase depois do login. O trabalho offline fica salvo no computador e entra na fila de sincronização.

## Funcionalidades

### Central operacional

- **Painel do turno:** resumo de registros abertos, urgentes, aguardando resposta ou manutenção, prazos e pendências prioritárias.
- **Livro de ocorrências:** cadastro com condomínio, categoria, assunto, descrição, prioridade, origem, empresa, referência e protocolo automático.
- **Acompanhamento:** status, prazo, responsável, próxima ação, atualizações registradas e histórico consultável.
- **Correção após resolução:** acrescenta uma correção ao histórico sem reabrir nem apagar a resolução original.
- **Passagem de turno:** lista pendências abertas, identifica itens críticos e registra operadores, recado e confirmação de recebimento.
- **Checklists e rotinas:** modelos com verificações configuráveis e frequência única, por turno, diária, semanal ou mensal. Cada item recebe uma resposta — conforme, não conforme ou não se aplica — e as execuções ficam no histórico.
- **Alertas:** painel para prazos próximos, itens urgentes e prazos vencidos. O aplicativo pode também exibir uma notificação do Windows quando há alertas e o sistema permite notificações.
- **Anexos e evidências:** vincula imagens PNG ou JPEG e documentos PDF aos registros. O limite atual é de 512 KB por arquivo.

### Gestão

- **Relatórios PDF, Excel e CSV:** exportam registros, histórico e passagens no período escolhido, com filtros por condomínio e status.
- **Indicadores:** total de registros, abertos, atrasados e resolvidos; média até a resolução; percentual de registros com prazo concluídos no prazo; agrupamento por condomínio e categoria.
- **Perfis de acesso:** administrador, supervisor, operador e consulta. O administrador atribui acesso a condomínios e gerencia contas já cadastradas na central.
- **Autoria autenticada:** operações registram a conta que criou ou atualizou os dados. Os nomes de operador permanecem associados às atividades e à passagem de turno.
- **Portal web e celular:** estrutura preparada no repositório, mas **desativada e indisponível no lançamento inicial**. A publicação em hospedagem HTTPS será feita em uma etapa futura.

### Ferramentas e proteção dos dados

- **Calendário:** consulta registros e passagens por data.
- **Sincronização:** fila local persistente, atualização entre computadores autorizados e revisão de conflitos de edição.
- **Trabalho offline:** após uma validação online, o operador pode entrar offline neste computador com a mesma conta por até sete dias.
- **SQLite local e backups JSON:** a base fica no perfil do usuário do Windows; o aplicativo mantém cópias automáticas e permite salvar um backup em outro local.
- **Histórico de passagem:** mudanças de horário não confirmam automaticamente o recebimento. O operador que assume confirma a troca.

## Organização do menu

- **Central operacional:** Início, Novo registro, Registros, Passagem de turno, Checklists e rotinas e Alertas.
- **Gestão:** Relatórios, Indicadores, Acessos e Portal web/celular.
- **Ferramentas:** Calendário, Sincronização, exportação e backups.

Algumas opções dependem do perfil. O portal permanece desativado.

## Instalação e execução para desenvolvimento

Requisitos: Windows 10/11 de 64 bits, Node.js 24 ou superior e acesso à internet para instalar as ferramentas de desenvolvimento.

```powershell
npm ci
npm start
```

Para instalar as dependências e gerar o instalador para Windows:

```powershell
npm test
npm run dist:win
```

O resultado é criado em `dist/MOP-Instalador-2.1.0.exe`. Para gerar a versão portátil:

```powershell
npm run dist:portable
```

O aplicativo instalado inclui o runtime e não exige Node.js no computador operacional. A primeira geração de pacotes exige internet. O aplicativo não está assinado digitalmente.

## Configuração da central compartilhada

O projeto usa Supabase Auth e Postgres com regras de acesso por conta e condomínio. O aplicativo aceita somente a chave publicável ou a chave legada `anon`; nunca adicione uma chave secreta ou `service_role` ao cliente.

- Consulte [SUPABASE.md](SUPABASE.md) para criar contas e conectar os computadores.
- Use [supabase/mop.sql](supabase/mop.sql) ao criar um ambiente novo. O script prepara as tabelas, políticas e funções da central.
- Para conceder a administração inicial ao endereço já cadastrado `marcelosantostoledo1@gmail.com`, execute [supabase/autorizar-admin-inicial.sql](supabase/autorizar-admin-inicial.sql) no SQL Editor do projeto. Para outra organização, substitua o endereço no script antes de executá-lo.
- Depois da instalação inicial, prefira administrar os demais operadores na opção **Gestão → Acessos**.

A migração de permissões e funcionalidades da versão 2.1.0 está registrada em [supabase/migrations](supabase/migrations/) e já foi aplicada na central Supabase deste projeto. Instalações locais anteriores precisam atualizar o aplicativo para usar os novos recursos.

## Dados, backups e limites

Os dados ficam em `%APPDATA%\MOP\dados\mop.sqlite`, fora da pasta do programa. Não mova o SQLite enquanto o aplicativo estiver aberto nem o compartilhe diretamente por OneDrive ou pasta de rede. Use a sincronização da central para compartilhar dados entre computadores.

O aplicativo cria cópias automáticas antes de alterações e mantém até 30 backups locais. O botão **Salvar backup** permite guardar uma cópia JSON em outra pasta ou unidade. Uma cópia na mesma unidade não protege contra a perda do disco. O SQLite e os arquivos JSON não são criptografados pelo MOP; proteja a conta e os arquivos do Windows.

Cada anexo pode ter até 512 KB. As bases têm limite de 64 MB por estado local e as operações sincronizadas têm limite de 1 MB por registro. A importação JSON substitui dados e não fica disponível para bases vinculadas à central. Confirme sempre o condomínio e os registros antes da primeira conexão.

O login online e a sincronização precisam de internet. Sem internet, os dados deste computador permanecem disponíveis após um login autorizado recente. Uma revogação de acesso na central é recebida quando o dispositivo volta a se conectar.

## Testes

```powershell
npm test
npm run test:management
```

A suíte automatizada verifica o armazenamento, o login, as regras SQL em um PostgreSQL de teste, os limites de acesso, checklists, anexos, relatórios e sincronização offline. O teste de gestão abre uma instância temporária do Electron para conferir fluxos operacionais e a geração de PDF e Excel. Ele não utiliza a base de dados real do usuário.

## Estrutura principal

- `src/index.html`, `src/app.js` e `src/style.css`: interface e fluxo operacional.
- `src/management.js` e `src/operations.js`: gestão, regras de operação, checklists e indicadores.
- `src/workbook.js`: geração do arquivo Excel.
- `desktop/main.cjs`, `desktop/access.cjs` e `desktop/preload.cjs`: janela, autenticação, permissões e comunicação segura com o sistema.
- `desktop/store.cjs` e `desktop/sync-store.cjs`: base local, backups e fila de sincronização.
- `supabase/mop.sql`: esquema e regras da central.
- `portal/`: portal preparado para uma publicação futura; desabilitado nesta versão.
- `test/`: testes automatizados e de interface.

## Licença

Aplicativo proprietário desenvolvido por NOXUZ. Consulte a NOXUZ antes de redistribuir ou comercializar o código e os instaladores.

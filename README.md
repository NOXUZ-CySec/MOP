# MOP — Monitoramento Operacional

![NOXUZ — Cybersecurity & Technology](assets/noxuz-logo.png)

**Aplicativo de livro de turno, ocorrências e continuidade operacional para Windows.** Desenvolvido por NOXUZ.

> **Base atual: 2.1.0; próxima versão: 2.2.0 em preparação.** Este documento distingue os recursos implementados das mudanças ainda pendentes. O número do pacote continua sendo o definido em `package.json`. O portal web/mobile não está liberado.

Este é o repositório **privado de desenvolvimento**. Instaladores e notas para usuários são distribuídos em [MOP-Releases](https://github.com/NOXUZ-CySec/MOP-Releases/releases), sem publicar o código-fonte deste projeto.

O MOP reúne os registros da operação, as pendências que precisam de acompanhamento e as informações da troca de turno em um só lugar. Ele foi pensado para equipes que trabalham em turnos — como portarias, centrais de monitoramento e operações prediais — e precisam saber o que aconteceu, o que continua aberto, quem está acompanhando e o que precisa ser feito a seguir.

## Objetivo de uso

Utilize o MOP para registrar e acompanhar a rotina operacional e entregar cada turno ao seguinte com contexto claro. Cada ocorrência tem protocolo, prioridade, status, responsável, prazo, histórico de atualizações e próxima ação. A passagem de turno preserva uma fotografia das pendências no momento do recebimento.

O primeiro acesso exige internet, conta autenticada e autorização na central Supabase. Depois de um login online autorizado, é possível trabalhar offline neste computador dentro do período de autorização local. Cada estação mantém seu banco e sua fila de sincronização; o compartilhamento ocorre pela central.

## Funcionalidades

### Central operacional

- **Painel do turno:** resumo de registros abertos, urgentes, aguardando resposta ou manutenção, prazos e pendências prioritárias.
- **Livro de ocorrências:** cadastro com condomínio, categoria, assunto, descrição, prioridade, origem, empresa, referência e protocolo automático.
- **Acompanhamento:** status, prazo, responsável, próxima ação, atualizações registradas e histórico consultável.
- **Dados de solicitações:** categorias de solicitação de relatório ou vídeo/imagens incluem período solicitado, local/área e escopo. Esse período é distinto do prazo de atendimento.
- **Correção após resolução:** acrescenta uma correção ao histórico sem reabrir nem apagar a resolução original.
- **Passagem de turno na base atual:** lista pendências abertas, exige ciência individual de itens críticos e preserva operadores, recado e uma fotografia das pendências. A conta autenticada ainda corresponde a quem recebe; a inversão para quem entrega está pendente na 2.2.0.
- **Checklists e rotinas:** modelos com verificações configuráveis e frequência única, por turno, diária, semanal ou mensal. Cada item recebe uma resposta — conforme, não conforme ou não se aplica — e as execuções ficam no histórico.
- **Alertas e prazos:** painel para ocorrências urgentes, vencimentos em até uma hora e prazos vencidos, com confirmação de ciência por usuário e atualização. Após uma hora de atraso, o painel sinaliza escalonamento à supervisão. Os avisos são avaliados com o aplicativo aberto; notificações do Windows dependem do suporte e das permissões do sistema. Não há envio implementado de e-mail/SMS para esse escalonamento.
- **Anexos e evidências:** vincula imagens PNG ou JPEG e documentos PDF aos registros. O limite atual é de 512 KB por arquivo.

### Gestão

- **Relatórios:** PDF com registros, histórico e passagens de turno; Excel e CSV com a listagem dos registros. Filtros por período, condomínio e status. Os três formatos não possuem o mesmo conteúdo.
- **Indicadores:** total de registros, abertos, atrasados e resolvidos; média até a resolução; percentual de registros com prazo concluídos no prazo; agrupamento por condomínio e categoria.
- **Perfis de acesso:** administrador, supervisor, operador e consulta. O administrador atribui acesso a condomínios e gerencia contas já cadastradas na central.
- **Autoria autenticada:** operações registram a conta que criou ou atualizou os dados. Os nomes de operador permanecem associados às atividades e à passagem de turno.
- **Portal web e celular:** estrutura presente em `portal/`, mas **não liberada**. A tela informativa no desktop não equivale a um serviço publicado nem a um aplicativo mobile disponível.

### Ferramentas e proteção dos dados

- **Calendário:** consulta registros e passagens por data.
- **Sincronização multiestação:** fila local persistente, atualização entre computadores autorizados no mesmo workspace e revisão de conflitos de edição. Compare registros pelo protocolo MOP; os IDs locais podem diferir entre estações.
- **Conflitos:** comparação e escolha da versão inteira que deve prevalecer, sem fusão automática por campo. A decisão e as versões ficam registradas localmente; eventos permanecem no histórico.
- **Trabalho offline:** o último operador validado online pode entrar neste computador com a mesma conta e senha por até sete dias, desde que a proteção local de credenciais esteja disponível. A fila é reenviada ao reconectar. Alterações de permissão/revogação exigem contato com a central para serem conhecidas pela estação.
- **SQLite local e backups JSON:** a base fica no perfil do usuário do Windows; o aplicativo mantém cópias automáticas e permite salvar um backup em outro local.
- **Histórico de passagem:** mudanças de horário não confirmam automaticamente o recebimento. O operador que assume confirma a troca.

## Organização do menu

- **Central operacional:** Início, Novo registro, Registros, Passagem de turno, Checklists e rotinas e Alertas.
- **Gestão:** Relatórios, Indicadores, Acessos e Portal web/celular.
- **Ferramentas:** Calendário, Sincronização, exportação e backups.

Algumas opções dependem do perfil. O portal permanece desativado.

## Perfis e permissões

Todos os perfis estão sujeitos aos condomínios autorizados. Criar uma conta não concede, por si só, acesso ao workspace.

| Perfil | Recursos implementados |
| --- | --- |
| Consulta (`viewer`) | Consulta dados autorizados, históricos, anexos, relatórios e indicadores; não grava operações. |
| Operador (`operator`) | Cria e acompanha registros, resolve e corrige ocorrências, registra passagem, executa checklists, adiciona anexos e confirma ciência. |
| Supervisor (`supervisor`) | Recursos operacionais e criação, pausa e reativação de modelos de checklist. |
| Administrador (`admin`) | Recursos de supervisão, gestão de perfis/condomínios e ferramentas administrativas de dados. |

## Novidades e estado da próxima versão

- **2.1.0 / base atual:** checklists, alertas e ciência, anexos, relatórios, indicadores, perfis por condomínio e sincronização autenticada com fila offline e revisão de conflitos estão implementados. A documentação acima descreve essa base, sem limitar o produto à antiga apresentação da 2.0.
- **Presentes nas alterações locais para a 2.2.0, ainda em validação:** corretor ortográfico em português com sugestões no menu de contexto; remoção lógica de registros exclusiva do administrador, com motivo e autoria, preservando auditoria. Essas alterações não significam que um instalador 2.2.0 já foi publicado. A remoção inclui alteração SQL e migração que precisam ser verificadas na central antes da distribuição.
- **Pendentes na 2.2.0:** passagem registrada pelo operador que sai, com seleção de quem entra entre contas autorizadas do workspace; verificação de atualizações e download do instalador pelo canal público. Não estão disponíveis na base inspecionada.
- **Não liberado:** portal web/mobile. Sua existência no repositório não indica disponibilidade operacional.

Ao concluir a implementação e a validação, atualize esta seção com o comportamento efetivo, a versão do pacote e as notas da release. Preserve a tag `v2.1.0` como referência; não antecipe a publicação da `v2.2.0` na documentação.

## Instalação para usuários e testadores

1. Use Windows 10/11 de 64 bits e baixe o instalador da versão disponibilizada em [Releases oficiais](https://github.com/NOXUZ-CySec/MOP-Releases/releases).
2. Execute o instalador e abra o MOP. Node.js e ferramentas de desenvolvimento não são necessários na estação operacional.
3. No primeiro login, mantenha internet disponível e utilize uma conta autorizada pelo administrador no workspace e nos condomínios corretos.
4. Aguarde a sincronização antes de iniciar o teste em outra estação. Consulte [LEIA-ME.md](LEIA-ME.md) para uso e recuperação.

Para atualizar, salve um backup, feche o MOP e execute o instalador disponibilizado. Os dados ficam fora da pasta do programa. Valide preservação dos dados, configuração e sincronização antes de distribuir cada nova build. A versão 2.1.0 não contém o verificador integrado planejado para a 2.2.0.

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
- Para conceder a administração inicial, revise o endereço configurado em [supabase/autorizar-admin-inicial.sql](supabase/autorizar-admin-inicial.sql) antes de executar o script para a conta desejada.
- Depois da instalação inicial, prefira administrar os demais operadores na opção **Gestão → Acessos**.

As migrações estão em [supabase/migrations](supabase/migrations/). A presença de um arquivo no repositório não comprova sua aplicação em um ambiente hospedado: confira o estado da central e a compatibilidade com as estações antes de distribuir a atualização. Instalações locais anteriores precisam atualizar o aplicativo para usar os novos recursos.

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

Consulte também [test/STARTUP.md](test/STARTUP.md) e o roteiro de duas estações em [SUPABASE.md](SUPABASE.md). Antes de publicar, valide login, perfis, anexos, checklists, passagem, exportações e preservação dos dados; teste criação/edição entre A e B, fila offline, reconexão e conflito no mesmo registro. Testes locais não comprovam, sozinhos, que as migrações e notificações funcionam na central hospedada.

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

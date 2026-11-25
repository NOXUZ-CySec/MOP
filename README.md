# MOP — Monitoramento Operacional

![NOXUZ — Cybersecurity & Technology](assets/noxuz-logo.png)

**Aplicativo para Windows que reúne registros, turnos, acompanhamento e continuidade operacional. Desenvolvido por NOXUZ.**

Esta árvore contém o código da **Preview 110 de homologação**, com versão de pacote `2.3.0-preview.110`. O código e as prereleases desta linha usam o repositório [NOXUZ-CySec/MOP](https://github.com/NOXUZ-CySec/MOP). A construção local não publica uma release automaticamente.

## O que o aplicativo oferece

- Registros operacionais com protocolo, histórico, anexos, prioridade e acompanhamento de status.
- Entrega e recebimento de turno, pendências e confirmação de ciência.
- Painel, indicadores, calendário, checklists e rotinas.
- Perfis `admin`, `supervisor`, `operator` e `viewer`, com escopo por condomínio.
- Autenticação e sincronização entre estações autorizadas, com fila local para o trabalho offline.
- Exportações e recursos de continuidade, incluindo backup e recuperação em ambiente separado.

A interface atual fica em `ui-next`, com componentes React e o catálogo visual do projeto. O processo principal do Electron controla armazenamento, sessões, permissões, IPC e integrações com o Windows.

## Preview 110

Esta preview refina a Passagem de Turno para orientar a continuidade entre os plantões:

- Pendências organizadas por risco, prazo e informações de continuidade ausentes, com busca e filtros.
- Responsável e próxima ação editáveis na própria aba pelo autor do registro ou pela supervisão, com validação de versão e auditoria.
- Rascunho do resumo e das ressalvas preservado durante atualizações e navegação na mesma sessão.
- Conferência renovada quando os dados relevantes mudam, com leitura obrigatória vinculada à versão atual das pendências importantes.
- Separação entre o retrato da entrega e o estado atual dos registros, incluindo alterações posteriores.
- Confirmação acessível e indicação clara de gravação local pendente ou sincronização confirmada.

A entrega continua exigindo o resumo e os três itens de conferência. Campos de orientação ausentes são destacados para revisão. A classificação para leitura obrigatória segue a mesma regra da ciência inicial: prioridade Urgente, Alta, Crítica ou Atenção, ou prazo vencido.

Os recursos de backup integral, atualização e build canônico das previews anteriores continuam disponíveis. As alterações de continuidade usam os campos e a fila de sincronização existentes.

Os resultados de validação do executável distribuído devem acompanhar as notas da respectiva release. A existência do código ou do template de CI não comprova, por si só, a aprovação de um pacote.

## Obter uma versão

As prereleases de homologação ficam em [Releases do MOP](https://github.com/NOXUZ-CySec/MOP/releases). Use Windows x64 e siga as instruções da release selecionada.

O instalador mantém a identidade **MOP Homologacao**. O executável portátil tem distribuição manual. O atualizador da homologação consulta o canal `preview` deste repositório e não permite downgrade.

O conjunto de publicação do instalador inclui o executável, seu arquivo `.blockmap` e os metadados de atualização correspondentes. Não misture arquivos de builds diferentes.

## Construir a partir do código

Use um checkout dedicado à construção e instale as dependências da raiz e da interface:

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd --prefix ui-next ci --no-audit --no-fund
npm.cmd run check:release-config
npm.cmd run check:types
npm.cmd run test:foundation
npm.cmd run dist:preview
```

O procedimento completo, os requisitos e os comandos alternativos estão em [BUILDING.md](BUILDING.md).

A saída desta versão é `dist-ui-next-110`:

- `MOP-Preview110-Instalador.exe`;
- `MOP-Preview110-Portable.exe`;
- metadados e arquivos auxiliares da construção.

`dist:preview`, `dist:win` e `dist:portable` usam `--publish never`. A publicação no GitHub é uma etapa separada.

## Validação

`npm.cmd run test:foundation` executa uma lista explícita de testes locais. Os testes de interface e do Electron devem usar bases sintéticas e perfis temporários; abrir um perfil operacional não faz parte desse comando.

O arquivo `tools/ci1098/preview-validation.template.yml` é um modelo inativo de integração contínua. Ele descreve a preparação de Windows e Node.js, a instalação dos dois lockfiles e a verificação de configuração, TypeScript, fundação e build da interface, sem deploy ou acesso à central Supabase. Não existe execução automática a partir desse template. Sua ativação futura em `.github/workflows` requer uma integração GitHub autorizada a alterar workflows.

O catálogo visual é construído separadamente com:

```powershell
npm.cmd run build:catalog
```

## Central Supabase

O MOP usa Supabase Auth e Postgres para autenticação, autorização e sincronização. A configuração distribuída no cliente deve conter somente a URL e a chave publicável. Não coloque senha do banco, chave secreta ou `service_role` no código ou no executável.

[SUPABASE.md](SUPABASE.md) descreve a preparação de um ambiente próprio, os arquivos SQL disponíveis e os templates de autorização. Esses arquivos não são aplicados automaticamente durante o build.

Os exemplos públicos não identificam usuários da instalação existente. Scripts locais com identidades reais e relatórios da central devem permanecer fora do snapshot público.

## Dados e recuperação

A homologação usa a pasta de perfil `%APPDATA%\MOP-UI-Next-Homologacao`, definida no processo principal. A base operacional fica no subdiretório `dados`. Uma construção do aplicativo não precisa abrir essa pasta.

Não compartilhe o SQLite diretamente por pasta de rede ou serviço de sincronização de arquivos. A sincronização entre estações deve passar pelo fluxo do MOP e pelas permissões da central.

Guarde backups em local protegido. A recuperação deve usar uma pasta separada e ser verificada antes de reconectar uma base à central. Preserve a instalação anterior até concluir a validação da nova release.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `ui-next/src` | Interface React atual. |
| `ui-next/catalog` e `ui-next/.storybook` | Catálogo visual de componentes. |
| `desktop` | Processo principal, preload, armazenamento, sessões, permissões e sincronização. |
| `src` | Módulos e recursos mantidos pelo projeto. |
| `supabase` | Esquema, alterações incrementais e exemplos de configuração. |
| `test` | Testes de lógica, integração e roteiros de interface. |
| `scripts` | Exportação da configuração e empacotamento da preview. |
| `electron-builder-preview.cjs` | Configuração canônica da homologação. |
| `BUILDING.md` | Instalação de dependências e construção reproduzível. |

## Licença

Aplicativo proprietário desenvolvido por **NOXUZ**. Consulte a NOXUZ antes de redistribuir, reutilizar ou comercializar o código-fonte e os instaladores.

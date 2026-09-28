# MOP ÔÇö Monitoramento Operacional

![NOXUZ ÔÇö Cybersecurity & Technology](assets/noxuz-logo.png)

**Aplicativo de livro de turno, ocorr├¬ncias e continuidade operacional para Windows.** Desenvolvido por **NOXUZ**.

> **Vers├úo atual: 2.2.1.** Esta ├® a vers├úo mais recente do reposit├│rio privado de desenvolvimento. O canal p├║blico de distribui├º├úo permanece em [MOP-Releases](https://github.com/NOXUZ-CySec/MOP-Releases/releases). O portal web/mobile ainda n├úo est├í liberado.

Este ├® o reposit├│rio **privado de desenvolvimento** do MOP. Ele concentra o c├│digo-fonte, testes, migra├º├Áes, documenta├º├úo e fluxo de build. Os instaladores destinados a testadores e usu├írios s├úo publicados separadamente no reposit├│rio p├║blico de releases.

O MOP re├║ne registros operacionais, pend├¬ncias, checklists, alertas, anexos, relat├│rios, indicadores e passagem de turno em uma ├║nica aplica├º├úo, com sincroniza├º├úo entre esta├º├Áes autorizadas e opera├º├úo offline controlada.

## Vers├úo 2.2.1

A vers├úo **2.2.1** corrige o travamento da interface ao marcar registros como **Resolvido** pelo seletor r├ípido de status. A confirma├º├úo passou a usar um modal pr├│prio do MOP, eliminando o bloqueio de foco/cliques observado no Electron.

A corre├º├úo foi validada com a su├¡te automatizada e teste de interface de gest├úo, mantendo a opera├º├úo dispon├¡vel ap├│s resolver registros.

## Principais recursos atuais

### Central operacional

- Painel do turno com abertos, urgentes, aguardando resposta/manuten├º├úo, prazos e destaques.
- Cadastro de registros com protocolo, condom├¡nio, categoria, assunto, descri├º├úo, prioridade, origem, empresa, refer├¬ncia e prazo.
- Atualiza├º├úo por hist├│rico, a├º├úo realizada e pr├│xima a├º├úo, com autoria da conta autenticada.
- Altera├º├úo r├ípida de status por dropdown com confirma├º├úo pr├│pria do MOP para **Resolvido**.
- Corre├º├úo de registros resolvidos sem apagar a resolu├º├úo original.
- Calend├írio de registros e passagens.
- Anexos PNG/JPEG/PDF vinculados a registros.
### Turnos, autentica├º├úo e acessos

- Tela **Novidades do MOP** ap├│s o login para vers├Áes ainda n├úo lidas.
- Login por **usu├írio ou e-mail + senha**; o e-mail continua sendo a identidade de autentica├º├úo no Supabase.
- Recebimento obrigat├│rio do turno antes de liberar a├º├Áes operacionais.
- Ci├¬ncia das pend├¬ncias cr├¡ticas e registro audit├ível de quem assumiu o turno.
- Indicador permanente do turno assumido.
- Perfis `admin`, `supervisor`, `operator` e `viewer`, com escopo por condom├¡nio.
- Administra├º├úo de username, nome de exibi├º├úo, perfil e condom├¡nios em **Acessos**.

### Gest├úo e continuidade

- Checklists e rotinas configur├íveis por frequ├¬ncia.
- Alertas de urg├¬ncia, vencimento e atraso.
- Relat├│rios PDF, Excel e CSV.
- Indicadores operacionais por per├¡odo, condom├¡nio e categoria.
- Sincroniza├º├úo multiesta├º├úo via Supabase com fila offline e revis├úo de conflitos.
- SQLite local e backups autom├íticos; backup manual restrito a perfis autorizados.
- Importa├º├úo/exporta├º├úo destrutiva da base operacional n├úo faz parte da interface sincronizada atual.

## Atualiza├º├úo autom├ítica

A atualiza├º├úo autom├ítica foi introduzida na **2.1.1**. O cliente consulta o canal `NOXUZ-CySec/MOP-Releases`, detecta uma vers├úo superior, baixa o instalador e o `.blockmap` e oferece reinicializa├º├úo para instala├º├úo.

A **2.2.1** foi publicada especificamente para atualizar automaticamente os clientes 2.2.0 com a corre├º├úo do fluxo de status **Resolvido**.

Os artefatos oficiais de uma release Windows s├úo:

- `MOP-Instalador-<vers├úo>.exe`
- `MOP-Instalador-<vers├úo>.exe.blockmap`
- `latest.yml`

N├úo substitua apenas o execut├ível de uma release sem atualizar tamb├®m o `.blockmap` e o `latest.yml`.
## Instala├º├úo para usu├írios e testadores

1. Use Windows 10/11 de 64 bits.
2. Baixe a vers├úo publicada em [MOP-Releases](https://github.com/NOXUZ-CySec/MOP-Releases/releases).
3. No primeiro acesso, mantenha internet dispon├¡vel e utilize uma conta autorizada no workspace.
4. Se estiver em uma vers├úo compat├¡vel com o updater, prefira **Verificar atualiza├º├úo** dentro do pr├│prio MOP.

Os dados operacionais ficam fora da pasta de instala├º├úo. A atualiza├º├úo do aplicativo n├úo deve apagar a base local, mas cada build deve ser validada antes de distribui├º├úo ampla.

## Desenvolvimento

Requisitos: Windows 10/11 64 bits, Node.js compat├¡vel com o projeto e acesso ├á internet para instalar depend├¬ncias.

```powershell
npm ci
npm start
```

Testes e build:

```powershell
npm test
npm run test:management
npm run dist:win
```

O instalador atual ├® gerado em `dist/MOP-Instalador-2.2.1.exe`.

## Central Supabase

O MOP usa Supabase Auth e Postgres para autentica├º├úo, autoriza├º├úo por workspace/condom├¡nio e sincroniza├º├úo. O cliente utiliza apenas configura├º├úo public├ível; nunca inclua `service_role` ou segredo equivalente no aplicativo desktop.

- `SUPABASE.md`: configura├º├úo e opera├º├úo da central.
- `supabase/mop.sql`: esquema consolidado para novos ambientes.
- `supabase/migrations/`: hist├│rico de migra├º├Áes incrementais.

As migra├º├Áes de username e fluxo 2.2 foram preparadas/aplicadas no ambiente de testes atual. Sempre confira o estado da central antes de distribuir uma nova build para outra instala├º├úo.

## Dados e backups

A base local fica em `%APPDATA%\MOP\dados\mop.sqlite`. N├úo compartilhe esse SQLite diretamente por pasta de rede ou servi├ºo de sincroniza├º├úo de arquivos; use a sincroniza├º├úo do pr├│prio MOP.

O aplicativo mant├®m backups locais autom├íticos antes de altera├º├Áes. Backups manuais devem ser tratados como dados operacionais sens├¡veis e protegidos conforme as regras da organiza├º├úo.

## Testes

A su├¡te automatizada cobre autentica├º├úo, autoriza├º├úo, armazenamento, regras SQL, sincroniza├º├úo offline, conflitos, checklists, anexos, relat├│rios e fluxos operacionais. O teste `test:management` abre uma inst├óncia tempor├íria do Electron para validar a interface de gest├úo.

Para a **2.2.1**, o resultado de valida├º├úo antes da publica├º├úo foi **45/45 testes aprovados** e `MANAGEMENT_UI_OK`.

## Estrutura principal

- `src/`: interface e m├│dulos operacionais/gest├úo.
- `desktop/`: Electron, autentica├º├úo, permiss├Áes, IPC, updater e integra├º├úo com o sistema.
- `supabase/`: esquema e migra├º├Áes da central.
- `test/`: testes automatizados e smoke tests.
- `portal/`: estrutura preparada para uso futuro; ainda n├úo liberada.

## Licen├ºa

Aplicativo propriet├írio desenvolvido por **NOXUZ**. Consulte a NOXUZ antes de redistribuir, reutilizar ou comercializar o c├│digo-fonte e os instaladores.

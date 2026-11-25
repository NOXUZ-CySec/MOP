# Construção do MOP Preview

Este guia descreve a linha de homologação do MOP. A versão da aplicação e o ponto de entrada ficam em `package.json`: atualmente `2.3.0-preview.110.1` e `desktop/main-next43.cjs`.

## Ambiente

Use Windows x64 e Node.js compatível com `engines.node` da raiz (24 ou superior). A preparação desta versão foi verificada com Node.js 26.7.0 e npm 11.19.0. Electron e electron-builder são dependências locais do projeto; não é necessária uma instalação global.

Execute os comandos abaixo no PowerShell, a partir da raiz do repositório. O sufixo `.cmd` evita depender da política de execução de scripts PowerShell para os atalhos do npm.

## Instalação reprodutível

A raiz e `ui-next` têm manifestos e lockfiles próprios. Instale os dois conjuntos:

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd --prefix ui-next ci --no-audit --no-fund
```

`npm ci` usa as versões e os hashes registrados nos lockfiles. Execute-o em um checkout dedicado à construção; ele recria `node_modules` daquela pasta. Não é necessário atualizar dependências para gerar a release.

Se a instalação informar um script de instalação bloqueado, examine o pacote e a finalidade antes de aprová-lo. Não habilite todos os scripts indiscriminadamente. Qualquer aprovação necessária depende da versão do npm e deve ser registrada no ambiente de construção.

O Playwright está declarado na raiz como `@playwright/test` com versão exata `1.65.1`. Os testes podem usar `require("@playwright/test")` sem depender de uma instalação externa. Para preparar o Chromium usado pelos testes de navegador:

```powershell
node node_modules/@playwright/test/cli.js install chromium
```

Esse comando baixa o navegador para o cache padrão do Playwright. Um ambiente que já mantenha os navegadores em outra pasta pode definir `PLAYWRIGHT_BROWSERS_PATH` antes da instalação e dos testes. A variável deve apontar para os navegadores compatíveis com a versão instalada; ela não substitui a dependência de desenvolvimento no projeto.

## Comandos principais

| Comando | Resultado |
| --- | --- |
| `npm.cmd run check:release-config` | Verifica a versão dos lockfiles, a identidade da homologação e a configuração JSON derivada. |
| `npm.cmd run config:preview` | Gera ou atualiza o JSON de compatibilidade a partir da configuração canônica. |
| `npm.cmd run check:types` | Executa o TypeScript de `ui-next` sem emitir arquivos. |
| `npm.cmd run test:foundation` | Executa a lista explícita de testes de fundação. |
| `npm.cmd run build:ui` | Gera a interface em `ui-next/dist`. |
| `npm.cmd run build:catalog` | Gera o catálogo de componentes em `ui-next/storybook-static`. |
| `npm.cmd run dist:preview` | Verifica tipos, gera a interface e empacota instalador NSIS e versão portátil para Windows x64. |
| `npm.cmd run dist:win` | Executa a mesma preparação e empacota apenas o instalador NSIS. |
| `npm.cmd run dist:portable` | Executa a mesma preparação e empacota apenas a versão portátil. |

### Verificação de fundação

```powershell
npm.cmd run check:release-config
npm.cmd run check:types
npm.cmd run test:foundation
```

O comando `test:foundation` usa uma lista explícita de arquivos, incluindo armazenamento, sincronização, identidade da sessão, permissões e backup. Essa seleção evita incluir automaticamente roteiros antigos que abrem o aplicativo.

A aprovação dos testes de fundação não substitui a validação visual ou o teste do pacote final. Os testes de interface e Electron devem usar perfis temporários e dados sintéticos próprios. Não execute roteiros históricos em um perfil operacional para validar uma release.

`npm start` e `npm run start:preview` abrem o aplicativo de homologação e podem acessar seu perfil normal. Eles não fazem parte da construção nem do comando de testes de fundação.

### Conferência inicial e barra superior da Preview 110.1

Depois de construir a interface, execute os testes direcionados com dados sintéticos:

```powershell
node --test test/preview107-startup-gate.test.cjs test/startup1101.test.cjs
node test/topbar1101-ui.cjs
node test/startup1101-ui.cjs
```

Os dois roteiros de interface usam Chromium e a pasta ui-next/dist por padrão. Iniciam um servidor local temporário, simulam a ponte Electron e bloqueiam requisições externas. Não fazem login real, não recebem um turno operacional e não alteram a base em uso. Os relatórios registram os hashes do build testado.

Esses testes cobrem os atalhos que antes deslocavam a barra, a conferência individual, o bloqueio de dados desatualizados, as exceções do recebimento e o layout em três larguras. A verificação dos controles de janela em Electron deve usar um perfil separado.
### Construção da release

```powershell
npm.cmd run dist:preview
```

O comando executa, na ordem:

1. Geração da configuração JSON de compatibilidade.
2. Verificação TypeScript.
3. Construção Vite da interface.
4. Empacotamento Windows x64 com electron-builder e `--publish never`.
5. Preparação dos metadados de atualização `latest.yml` e `preview.yml` para o instalador.

Para a versão atual, a saída é `dist-ui-next-110-1`, com:

- `MOP-Preview110.1-Instalador.exe`;
- `MOP-Preview110.1-Portable.exe`;
- metadados de atualização e arquivos auxiliares produzidos pelo empacotador.

A opção somente portátil não exige metadados de atualização do instalador. As pastas de versões anteriores são preservadas.

O catálogo é uma saída separada. Execute `npm.cmd run build:catalog` quando também precisar validar ou distribuir a documentação visual dos componentes.

Os comandos de distribuição não publicam arquivos no GitHub. O wrapper aceita somente `--target nsis` ou `--target portable` e rejeita argumentos de publicação. A publicação de uma release continua sendo uma etapa separada, após a revisão dos artefatos.

## Integração contínua opcional

O arquivo `tools/ci1098/preview-validation.template.yml` é um modelo inativo. Ele reúne instalação por lockfile, configuração, TypeScript, testes de fundação e build da interface em Windows com Node.js. Não publica releases nem acessa o banco central.

O template permanece fora de `.github/workflows` e não dispara execuções no GitHub. Uma ativação futura exige autorização adequada para alterar workflows na integração GitHub; ela não faz parte do procedimento de construção local.

## Configuração canônica e identidade do aplicativo

`electron-builder-preview.cjs` deriva o número de preview, os nomes dos artefatos e a pasta de saída a partir de `package.json`. O campo `build` do manifesto estende essa configuração, inclusive para chamadas diretas ao electron-builder.

A configuração mantém a identidade da homologação:

| Campo | Valor |
| --- | --- |
| `appId` | `br.com.mop.preview94.homologacao` |
| Produto e atalho | `MOP Homologacao` |
| Arquitetura | Windows x64 |
| Tipo de release configurado | Prerelease do repositório `NOXUZ-CySec/MOP` |
| Exclusão de dados na desinstalação | Desativada |

Esses campos não devem ser alterados apenas para incrementar o número de preview: fazem parte da continuidade da instalação. A localização dos dados e o comportamento de sessão continuam sendo definidos pelo código de desktop.

`electron-builder-ui-next110-1.json` é um arquivo gerado de compatibilidade. Edite a fonte canônica, execute `npm.cmd run config:preview` e depois `npm.cmd run check:release-config`. Não mantenha divergências manuais entre os dois arquivos.

As configurações históricas permanecem disponíveis no repositório quando necessárias para referência ou testes antigos. Os comandos desta página usam a configuração canônica, sem selecionar uma configuração antiga por nome.

## Preparação de uma nova versão

Atualize a versão da raiz e o lockfile em conjunto, mantendo o formato `MAJOR.MINOR.PATCH-preview.N[.N]`. A versão de `ui-next` identifica o pacote da interface e não substitui a versão da aplicação.

Depois da alteração:

```powershell
npm.cmd run config:preview
npm.cmd run check:release-config
npm.cmd run check:types
npm.cmd run test:foundation
npm.cmd run dist:preview
```

Verifique também os rótulos visíveis da interface, as notas da release e os testes do pacote. A configuração de empacotamento centraliza os metadados do instalador; ela não reescreve textos da interface.

Mantenha em controle de versão o código, os manifests, os lockfiles e as configurações necessárias à construção. Dados operacionais, credenciais, arquivos de ambiente, backups reais, relatórios privados e saídas de testes ou de construção devem permanecer fora do snapshot público.

As versões fixadas e os lockfiles tornam o conjunto de dependências reproduzível. Arquivos executáveis podem variar por carimbos de data, assinatura e ambiente de construção; valide o pacote final e registre seus hashes antes da publicação.

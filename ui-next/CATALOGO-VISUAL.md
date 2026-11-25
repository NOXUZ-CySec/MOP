# Catálogo visual do MOP — Preview 109.8

## Construir e abrir

Instale as dependências conforme [BUILDING.md](../BUILDING.md). No PowerShell, a partir da raiz do repositório:

```powershell
npm.cmd run build:catalog
node ui-next/.storybook/serve.mjs --open
```

Também é possível executar `ui-next/Abrir-Catalogo-MOP.cmd` depois de gerar o catálogo. O launcher resolve os caminhos a partir da sua própria pasta; não depende de uma letra de disco específica nem de um atalho previamente criado no Windows.

O catálogo compilado é servido em http://127.0.0.1:6006/ e fica acessível somente no computador em que o servidor está rodando. Feche a janela do servidor para encerrá-lo. Se a porta já estiver em uso, verifique o processo correspondente antes de iniciar outra instância.

## Conteúdo

Os exemplos interativos são agrupados em:

- Fundamentos: superfícies, paleta e identidade MOP.
- Campos e ações: login, senha visível/oculta, carregamento, erro e estados de controles.
- Sobreposições: confirmação de saída, dropdown e calendários de escala/rotina.
- Indicadores: dados, vazio, carregamento, erro, bloqueio antes do aceite e somente consulta.
- Registros: tabela, página completa, vazio, carregamento e erro.

Os exemplos usam componentes reais com dados sintéticos. Não dependem de login ou da base operacional. O addon de acessibilidade auxilia a inspeção; seus resultados não equivalem a uma certificação completa.

## Atualizar os exemplos

Edite os componentes ou as histórias e execute novamente `npm.cmd run build:catalog` na raiz. O servidor estático não recompila a interface automaticamente.

Este procedimento usa o catálogo compilado. O servidor de desenvolvimento do aplicativo é um fluxo separado e ainda possui uma limitação de compatibilidade com o módulo CommonJS de arraste de escala.

## Organização

| Caminho em `ui-next` | Finalidade |
| --- | --- |
| `.storybook` | Configuração, tema, comandos de build e servidor local. |
| `catalog` | Exemplos e estilos restritos ao catálogo. |
| `storybook-static` | Saída gerada para consulta local. |

O catálogo não entra no executável do MOP e sua saída não precisa ser versionada. As dependências Storybook são de desenvolvimento. A telemetria está desabilitada na configuração e no launcher do projeto.

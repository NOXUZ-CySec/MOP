# shadcn/ui no MOP

## Integração

O frontend React em `ui-next` mantém componentes shadcn/ui no próprio código, com configuração `new-york` e primitivas Radix. A versão da CLI e suas dependências estão registradas no manifesto e no lockfile da interface.

Componentes e adaptações principais:

- Button, Input, Label e AlertDialog em `src/components/ui`.
- `MopLoginFields`: rótulos associados, autocomplete, visibilidade de senha e estado de autenticação.
- `MopCloseDialog`: foco inicial em Cancelar, retenção de foco, Esc e restauração do foco.
- Integração com os estados e o contrato de autenticação existentes em `src/main.tsx`.
- Tema azul-marinho/ciano e estilos específicos dos componentes migrados.

O backend, as permissões e a sessão continuam sob responsabilidade das camadas do aplicativo. Componentes visuais não devem assumir decisões de autorização.

## Organização

| Arquivo | Responsabilidade |
| --- | --- |
| `components.json` | Aliases e configuração dos componentes. |
| `vite.config.js` e `tsconfig.json` | Resolução de `@/*` para `src/*`. |
| `src/shadcn.css` | Tokens do tema. |
| `src/shadcn-mop.css` | Ajustes visuais dos componentes integrados. |
| `src/style.css` | Importação dos estilos do aplicativo. |
| `LICENSE-shadcn-ui.txt` e `public/licenses/shadcn-ui.txt` | Licença dos componentes. |

O `AlertDialogContent` local inclui a prop opcional `overlayClassName`. Revise alterações geradas pela CLI para preservar essa adaptação e os contratos utilizados pelo MOP.

## Construir e visualizar

Instale as dependências da raiz e de `ui-next` conforme [BUILDING.md](../BUILDING.md). A partir da raiz do repositório:

```powershell
npm.cmd run check:types
npm.cmd run build:ui
npm.cmd --prefix ui-next run preview -- --port 5176 --strictPort
```

A prévia serve o bundle compilado em http://127.0.0.1:5176/. O aplicativo completo depende da ponte Electron; abrir o bundle no navegador é adequado para a inspeção visual e para os testes que fornecem uma ponte simulada.

O servidor `npm run dev` do aplicativo ainda tem uma incompatibilidade conhecida com o módulo CommonJS de arraste de escala. Use o build seguido de preview para o fluxo documentado aqui. A construção de produção converte esse módulo durante o bundle.

Para consultar propostas de alteração de componentes, use a CLI local de `ui-next` e revise o resultado antes de aplicar mudanças. Não sobrescreva automaticamente componentes já adaptados.

## Teste visual de shadcn

O roteiro `test/shadcn-ui-smoke.cjs` verifica login, visibilidade de senha, teclado, diálogo, foco e layout em tamanhos de desktop e de tela compacta. Ele simula a ponte Electron e bloqueia solicitações externas no navegador de teste.

Prepare o Chromium uma vez, a partir da raiz:

```powershell
node node_modules/@playwright/test/cli.js install chromium
```

Com o servidor de preview acima em execução, abra outro terminal na raiz e execute:

```powershell
node test/shadcn-ui-smoke.cjs
```

A dependência `@playwright/test` é resolvida na raiz do projeto. Não é necessário apontar para uma instalação externa. Se o seu ambiente utiliza `PLAYWRIGHT_BROWSERS_PATH`, mantenha a mesma pasta na instalação e na execução dos testes.

O endereço padrão é `http://127.0.0.1:5176/`; `MOP_SHADCN_URL` permite selecionar outro servidor local. Relatórios e capturas ficam em `ui-next/test-results/shadcn` e não devem entrar no snapshot do código.

Esse roteiro valida componentes e contratos simulados. A homologação do executável Windows deve verificar separadamente a ponte real, o perfil isolado e os controles de acesso. Resultados históricos não substituem uma execução sobre a versão que será distribuída.

## Referências

- [Código shadcn/ui](https://github.com/shadcn-ui/ui)
- [Instalação manual](https://ui.shadcn.com/docs/installation/manual)
- [CLI](https://ui.shadcn.com/docs/cli)

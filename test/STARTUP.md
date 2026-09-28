# Testes de inicialização

Execute na raiz do projeto, sem gerar executável:

```powershell
npm test
node_modules/.bin/electron.cmd test/startup-smoke.cjs
node_modules/.bin/electron.cmd test/startup-smoke.cjs --failure
node_modules/.bin/electron.cmd test/startup-smoke.cjs --data-failure
node_modules/.bin/electron.cmd test/startup-smoke.cjs --reduced
node_modules/.bin/electron.cmd test/ui-smoke.cjs
node_modules/.bin/electron.cmd test/sync-ui-smoke.cjs
node_modules/.bin/electron.cmd test/auth-ui-smoke.cjs
```

Os testes Electron usam perfis e bancos temporários. O teste de inicialização executa o `desktop/main.cjs` real, verifica a tela antes da abertura do banco, o logo, a barra indeterminada, a preferência de movimento e o conteúdo pronto. Salva capturas no caminho temporário informado na saída.

`--failure` injeta um payload inválido no banco temporário. `--data-failure` injeta uma passagem com dados inválidos para provocar falha na renderização inicial. Ambos verificam a parada da animação, o bloqueio da interface, a preservação dos dados e backups, e a recuperação pelo botão Tentar novamente após reparar a fixture. Nenhum teste modifica o perfil MOP do usuário.

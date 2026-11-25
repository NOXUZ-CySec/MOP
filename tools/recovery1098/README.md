# MOP 109.8 — backup integral e recuperação isolada

## O que é preservado

O arquivo privado .mopbackup contém uma cópia consistente do banco SQLite principal do perfil, incluindo **todas as tabelas, índices e dados**. Isso preserva estado local, identificadores, vínculos, pendências, operações em voo, cursores, conflitos e histórico de resoluções existentes no SQLite. Tabelas adicionais também são copiadas.

Este recurso é separado da exportação JSON sanitizada e das cópias JSON automáticas anteriores às gravações. Os recursos anteriores continuam com seus contratos próprios. Um JSON sanitizado não deve ser tratado como recuperação integral do perfil.

O escopo **não inclui** o banco central, arquivos externos ao SQLite, a instalação do aplicativo, todo o perfil do Windows nem credenciais guardadas em outros arquivos. Um anexo só está contido se seu conteúdo estiver efetivamente dentro do banco. Depois da recuperação, o MOP pode exigir nova autenticação e configuração das integrações. Não há conexão com o banco central durante criação, verificação ou restauração.

## Escolher a proteção

| Proteção | Uso | Requisito para recuperar |
| --- | --- | --- |
| Usuário do Windows — padrão | Cópia privada para recuperação no ambiente atual | Mesmo usuário e perfil Windows, com as chaves DPAPI disponíveis |
| Portátil com senha | Cópia para outro computador ou para reinstalação do Windows | Arquivo completo e a mesma senha informada na criação |

A proteção Windows usa o safeStorage do Electron. Copiar esse backup para outro PC, mesmo usando o mesmo nome de usuário ou e-mail, **não garante acesso às chaves DPAPI**. Para recuperação após perda do computador ou reinstalação, crie antecipadamente uma cópia portátil e guarde a senha separadamente do arquivo.

A senha portátil é fornecida somente na interface durante a operação. Deve ter ao menos 12 caracteres e no máximo 1024 bytes UTF-8; prefira uma frase longa e exclusiva. A interface deve confirmar a senha na criação. Espaços e acentos são significativos: não há remoção de espaços nem normalização silenciosa.

A senha não é persistida no backup, no manifesto, em logs ou nas configurações. O arquivo contém apenas os elementos criptográficos necessários para derivar a chave e verificar a senha. **Não existe recuperação da senha esquecida.** Não envie a senha por chat nem a grave junto ao backup.

A proteção do arquivo não isola os dados de processos maliciosos executando com a mesma conta Windows. Depois da recuperação, mop.sqlite é um banco local utilizável e deve continuar em uma pasta privada do usuário.

## Criar e conferir uma cópia

1. Entre no MOP com a conta administrativa autorizada e confirme o perfil que deseja proteger.
2. Escolha proteção Windows ou portátil. No modo portátil, informe e confirme a senha na interface.
3. Aguarde a conclusão. A operação cria a cópia SQLite, valida o banco, encripta o conteúdo e verifica novamente o arquivo final antes de retornar sucesso.
4. Confira data, versão, tamanho e resultado de integridade. A listagem inicial mostra metadados do cabeçalho e **não significa que o conteúdo já foi verificado**.
5. Para uma cópia externa, copie o arquivo .mopbackup inteiro para uma mídia ou pasta privada. Preserve o nome completo. O arquivo pode conter dados pessoais integrais e não deve ser publicado em repositórios.

Local padrão definido pela integração: backups-integral dentro do perfil do aplicativo. O módulo recebe esse caminho do processo principal; não recebe caminhos arbitrários do renderer.

## Recuperar no mesmo Windows

1. Mantenha o perfil ativo preservado. Não substitua mop.sqlite em uso e não remova arquivos WAL/SHM da base ativa.
2. Selecione uma cópia e execute a verificação. Para proteção Windows, use o perfil Windows original; para proteção portátil, informe a senha.
3. Execute a recuperação para uma **nova pasta que ainda não existe**, dentro da área de recuperação isolada.
4. O módulo verifica autenticação criptográfica, hashes, esquema, integridade SQLite e validação do estado MOP antes de disponibilizar o resultado.
5. Confira o recibo recovery-manifest.json e o banco mop.sqlite recuperado. O resultado inclui contagem de tabelas, pendências e conflitos.
6. A preparação não ativa automaticamente o banco recuperado, não muda o perfil em uso e não dispara sincronização. A ativação posterior exige o MOP fechado, identificação do perfil de destino e conferência administrativa dos dados. Essa etapa deve preservar uma cópia do perfil anterior.

Uma pasta de destino existente é recusada mesmo que esteja vazia. Essa regra impede substituições por engano. Perda de autorização durante a operação cancela a publicação e remove os arquivos que a operação criou, preservando origem e backup.

## Recuperar em outro computador ou após reinstalação

1. Use uma cópia criada no modo portátil. O modo Windows depende das chaves do perfil original.
2. Instale uma versão compatível do MOP e prepare seu perfil privado.
3. Copie o .mopbackup preservando seu nome para a pasta de backups indicada pelo aplicativo.
4. Informe a senha na interface, verifique o arquivo e recupere para uma pasta nova e isolada.
5. Confira os dados antes de ativar qualquer perfil. As operações pendentes mantêm seus identificadores e não devem ser recriadas manualmente.
6. Faça novo login quando necessário. Arquivos externos e dados existentes somente no banco central precisam de seus próprios procedimentos de recuperação.

Não execute simultaneamente duas cópias ativas do mesmo perfil recuperado sem uma decisão administrativa explícita. O teste confirma preservação dos identificadores e idempotência local das operações; não realiza reconciliação nem publicação no banco central.

## API do processo principal

~~~js
const {
  createSafeStorageProtector,
  createPassphraseProtector,
  createSnapshot,
  listSnapshots,
  verifySnapshot,
  restoreToNewDirectory,
} = require('./desktop/backup1098.cjs');

// app.whenReady() deve ter concluído antes do uso do safeStorage.
// A escolha padrão da interface é windows-user.
const keyProtector = protection === 'passphrase'
  ? createPassphraseProtector(passwordFromCurrentDialog)
  : createSafeStorageProtector(safeStorage);

try {
  const created = await createSnapshot({
    db: store.db,
    backupDirectory,             // caminho absoluto, fora do banco
    appVersion,
    keyProtector,
    assertAuthorized,            // função síncrona; lança se sessão mudou
  });

  const checked = await verifySnapshot({
    backupDirectory,
    id: created.id,
    keyProtector,
    assertAuthorized,
  });

  const recovered = await restoreToNewDirectory({
    backupDirectory,
    id: created.id,
    destinationDirectory,        // não existe; seu diretório pai já existe
    keyProtector,
    assertAuthorized,
  });
} finally {
  keyProtector.dispose?.();      // zera o buffer de senha mantido pelo módulo
}
~~~

Cada ação deve criar seu protetor portátil a partir da senha do diálogo atual e descartá-lo em finally. O descarte do buffer reduz sua permanência na memória; JavaScript não permite garantir a limpeza de todas as cópias temporárias da string original.

listSnapshots({ backupDirectory }) não precisa da senha. Retorna no máximo 200 entradas recentes com id, path, bytes, modifiedAt, createdAt, appVersion, protection e verified: false. Cabeçalhos inválidos, links e arquivos acima do limite não são oferecidos.

Criação e verificação retornam resumo sem registros nem credenciais: id, path, createdAt, appVersion, bytes, sha256, databaseBytes, tableCount, pendingOperations, conflicts, integrity: 'ok', verified: true, protection e scope.

A recuperação acrescenta destinationDirectory, databasePath e automaticActivation: false. A função assertAuthorized é opcional e síncrona; deve conferir a sessão administrativa atual e o escopo integral, incluindo mudanças ocorridas durante awaits. O módulo a chama no início e nos pontos de publicação; o controller também deve conferir autorização antes de apresentar resultados e abrir pastas.

O protetor injetável para testes implementa:

~~~js
{
  kind: 'windows-user', // ou passphrase
  available: async () => true,
  protectKey: async keyBuffer => wrappedKeyBuffer,
  unprotectKey: async wrappedKeyBuffer => keyBuffer,
}
~~~

Não há fallback para texto aberto. BACKUP_PASSWORD indica senha inválida ou chave portátil não autenticada; BACKUP_USER indica falha ao abrir a chave Windows; BACKUP_PROTECTION indica proteção indisponível ou incompatível; BACKUP_AUTHORIZATION indica sessão alterada; BACKUP_INVALID indica arquivo alterado/incompleto; BACKUP_DATABASE indica banco incompatível ou sem integridade; BACKUP_DESTINATION indica pasta já existente.

## Formato e garantias técnicas

- Snapshot feito com node:sqlite.backup, que utiliza a API de backup online SQLite.
- Somente a cópia temporária é normalizada para journal_mode=DELETE, produzindo um banco independente de WAL/SHM. O modo e o WAL da origem não são alterados.
- PRAGMA integrity_check, validação do estado pelo Store real, hash SHA-256 do SQLite e do esquema, além do inventário de tabelas com contagens.
- AES-256-GCM com chave aleatória de 32 bytes, nonce aleatório de 12 bytes e tag de 16 bytes. O cabeçalho completo é AAD e o manifesto fica encriptado com o banco.
- Proteção Windows: embrulho da chave por Electron safeStorage, preferindo a API assíncrona e usando a síncrona compatível quando necessário.
- Proteção portátil: node:crypto.scrypt assíncrono, salt aleatório de 16 bytes, N=131072, r=8, p=1, chave derivada de 32 bytes e teto de memória de 256 MiB. O embrulho usa AES-256-GCM independente com novo nonce. Os parâmetros são fixos do formato, sem custo KDF controlado pelo arquivo.
- A publicação usa hardlink atômico exclusivo no mesmo volume, seguido da remoção do nome temporário. Não substitui um backup existente. Requer filesystem compatível, como NTFS.
- Banco limitado a 512 MiB, cabeçalho a 16 KiB e manifesto a 64 KiB. Os arquivos são processados em streams; reserve espaço temporário de até aproximadamente quatro vezes o tamanho do banco, incluindo o arquivo final.
- IDs têm formato restrito. Caminhos relativos, traversal, links simbólicos, junctions e backups com múltiplos hardlinks são recusados.
- Nenhum SQLite vindo do arquivo é aberto antes de a tag GCM ser validada.
- Temporários privados são removidos ao terminar e nas falhas tratadas. Interrupção forçada do processo ou do Windows pode deixar temporários na pasta privada; a remoção comum não é uma promessa de apagamento seguro de disco.
- Um timer restrito ao await sqlite.backup, sempre encerrado em finally, mantém a conclusão responsiva no Node 26.7. A correção upstream de callback scope foi incluída no Node 26.9 (nodejs/node#65666). Isso não troca nem instala runtimes no computador.

## Validação

Execute node --test test/backup1098.test.cjs na raiz do projeto. A suíte usa exclusivamente diretórios temporários sintéticos, Store e SyncStore reais. Ela não lê o perfil real nem usa rede.

O relatório fica em test-results/release1098/backup-report.json. Abrange preservação integral, pendências em voo, idempotência, senha portátil, rejeição de senha errada/adulteração, limites, travessia, links, destinos existentes, concorrência e rollback por sessão revogada. O teste Electron com safeStorage real é uma validação separada da integração.

## Referências

- [Node.js — SQLite backup](https://nodejs.org/api/sqlite.html)
- [SQLite — Online Backup API](https://www.sqlite.org/backup.html)
- [Electron — safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Node.js — scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback)
- [OWASP — parâmetros scrypt](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt)
- [Node.js 26.9 — correção da conclusão de backup](https://nodejs.org/en/blog/release/v26.9.0)

# Central Supabase do MOP

O MOP usa Supabase Auth para identificar a conta e Postgres para armazenar os dados compartilhados, a associação ao workspace, os perfis e os escopos de acesso. O SQLite local sustenta os dados e a fila de sincronização de cada estação.

Este guia acompanha a Preview 109.8. A preparação desta preview não aplica SQL automaticamente a uma central existente. Construir o aplicativo e configurar uma central nova são operações separadas.

## Configuração do cliente

`desktop/supabase-config.cjs` contém a configuração publicável da homologação. Para preparar uma instalação independente, configure na sua cópia a URL e a chave publicável do seu próprio projeto antes de gerar o executável.

Uma chave publicável identifica o aplicativo; ela não substitui o login nem concede autorização de usuário. As regras da central precisam combinar permissões de objetos e Row Level Security, respeitando o workspace, o perfil e o escopo por condomínio.

Nunca coloque no aplicativo, nos exemplos ou no repositório:

- senha PostgreSQL;
- chave `sb_secret_` ou legado `service_role`;
- token de sessão, senha de operador ou credencial administrativa.

Referências oficiais: [chaves de API](https://supabase.com/docs/guides/getting-started/api-keys) e [proteção da Data API](https://supabase.com/docs/guides/api/securing-your-api).

## Arquivos SQL disponíveis

| Arquivo ou grupo | Finalidade |
| --- | --- |
| `supabase/mop.sql` | Base histórica de workspace, membros, registros, operações e funções de sincronização. Inclui alterações que também aparecem em arquivos separados. |
| `supabase/permissions.sql` | Perfis e escopo por condomínio. |
| `supabase/operator-privacy.sql` | Nome de exibição e tratamento de autoria. |
| `supabase/migrations` | Histórico incremental, incluindo permissões, remoção administrativa, privacidade e identificação por username. |
| `supabase/preview93_*.sql` e `supabase/preview94_*.sql` | Recursos de equipe, escala e solicitações de troca. |
| `supabase/preview95_4_absence_medical.sql` | Classificações adicionais de dias da escala. |
| `supabase/preview100_team_checklist.sql` | Conclusão compartilhada de checklist. |
| `supabase/preview101_reminder_revisions.sql` | Revisões de lembretes e conclusões. |
| `supabase/examples/*.example.sql` | Templates públicos de autorização, sem identidades reais. |

A pasta contém SQL de etapas diferentes do projeto. Não execute todos os arquivos em sequência indiscriminadamente: existem trechos sobrepostos e políticas que precisam de tabelas e funções previamente criadas. O arquivo base, isoladamente, não equivale a todas as funcionalidades das previews posteriores.

Para uma central nova, revise a cadeia de dependências em um ambiente de homologação vazio e registre quais scripts foram aplicados. Para uma central existente, compare o estado instalado e aplique somente as alterações necessárias após validar o plano. Os scripts personalizados de uma instalação não são parte do procedimento público.

## Primeiro administrador

1. Selecione no painel Supabase o projeto que realmente será usado por essa instalação.
2. Prepare e confira o esquema necessário à versão do aplicativo.
3. Crie e confirme no Supabase Auth uma conta individual para o administrador.
4. Faça uma cópia local de `supabase/examples/autorizar-admin-inicial.example.sql`.
5. Substitua `__ADMIN_EMAIL__` pela conta autorizada e confira o UUID do workspace.
6. Revise e execute a cópia somente no SQL Editor do projeto escolhido.

O template não cria uma conta nem define senha. Ele verifica a existência da conta confirmada e do workspace antes de conceder o perfil `admin` com acesso a todos os condomínios. Recusa alterar um vínculo já existente com outro perfil ou escopo. O placeholder provoca erro antes de qualquer concessão se não for preenchido.

Guarde a cópia preenchida fora do repositório. Depois da autorização inicial, prefira o fluxo administrativo do aplicativo para gerir acessos.

## Outros operadores

O template `supabase/examples/autorizar-operador.example.sql` exige uma conta confirmada e a indicação explícita dos condomínios permitidos. Ele concede o perfil `operator` e recusa modificar um vínculo existente divergente.

Substitua `__OPERATOR_EMAIL__` e `__CONDOMINIO__` somente em uma cópia local revisada. Use os identificadores de condomínio da instalação. Não reutilize o template de administrador para cadastrar operadores.

Criar uma conta no Supabase Auth não é suficiente para acessar os dados do MOP: a associação ao workspace e as permissões também precisam existir.

## Conectar uma estação

Utilize o perfil de homologação e uma conta autorizada. O primeiro login exige conectividade com a central. Em uma base local já utilizada, preserve uma cópia de segurança e revise o fluxo de primeira sincronização antes de enviar dados.

O protocolo do registro é a referência compartilhada. Identificadores numéricos locais podem variar entre computadores; não faça uma fusão manual de arquivos SQLite para tentar igualá-los.

O suporte offline, a fila persistente e a resolução de conflitos são controlados pelo aplicativo. A revogação remota depende de comunicação com a central para ser conhecida pela estação desconectada.

## Validação do ambiente

Em uma central e dois perfis de teste separados dos dados operacionais, confirme:

1. Login de uma conta autorizada e bloqueio de uma conta sem vínculo.
2. Leitura e gravação respeitando perfil e condomínio.
3. Sincronização do mesmo protocolo entre as duas estações.
4. Envio de alterações pendentes após reconexão, sem duplicação.
5. Apresentação e resolução de um conflito produzido com dados sintéticos.
6. Bloqueio de funções administrativas para perfis sem permissão.

A chave publicável não deve conseguir ler dados operacionais sem o contexto autorizado. Verifique as permissões dos objetos, as políticas RLS e o acesso a funções ao preparar qualquer ambiente novo.

Os testes locais de `npm.cmd run test:foundation` não comprovam, sozinhos, o estado de uma central hospedada. Nenhum comando de build deve aplicar migrações ou cadastrar usuários automaticamente.

## Recuperação e documentação privada

Backups e relatórios reais podem conter informações operacionais. Mantenha-os fora do código público. Recupere uma base em uma pasta separada, confira o resultado e avalie a reconexão antes de utilizá-la.

O snapshot público não deve incluir scripts de autorização preenchidos, e-mails de usuários, resultados de consultas, arquivos de sessão ou relatórios de diagnóstico da central. Os exemplos deste guia usam placeholders; a configuração efetiva de cada instalação deve ser registrada em documentação privada apropriada.

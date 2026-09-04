# Event Check-in

Aplicativo mobile em React Native para operações de entrada em eventos, com
leitura de QR Code, alternativa por código manual e processamento resiliente em
cenários de conectividade instável.

## Destaques

- Leitura de QR Code com a câmera nativa.
- Check-in manual como alternativa operacional.
- Persistência do comando em SQLite antes de qualquer chamada de rede.
- Identidade idempotente estável para todas as tentativas do mesmo check-in.
- Reconciliação de respostas incertas antes de reenviar uma operação.
- Prevenção local de duplicidade por evento e participante.
- Sincronização automática ao recuperar conexão ou retornar ao aplicativo.
- Backoff exponencial com jitter para controlar novas tentativas.
- Credenciais armazenadas com Expo SecureStore.
- Modo demonstração para executar o fluxo sem backend.
- Contrato de API e cenário de carga com k6.

## Fluxo de confiabilidade

1. O QR Code ou código manual é validado no dispositivo.
2. O aplicativo cria uma `Idempotency-Key` e persiste o comando no SQLite.
3. Se houver conexão, a fila tenta enviar o check-in imediatamente.
4. Uma resposta confirmada armazena o comprovante da operação.
5. Uma resposta perdida mantém o comando como `awaiting_confirmation`.
6. Na próxima sincronização, o aplicativo consulta a operação pela mesma chave.
7. O comando somente é reenviado quando o servidor informa que não conhece a
   operação.

Esse fluxo evita que uma perda de sinal na entrada do evento apague o registro ou
gere uma segunda operação com identidade diferente.

## Arquitetura

| Área | Implementação |
| --- | --- |
| Plataforma | Expo 57, React Native 0.86 e React 19 |
| Navegação | Expo Router com rotas tipadas |
| Server state | TanStack Query |
| Estado operacional | Zustand |
| Persistência | Expo SQLite com WAL e índices |
| Segurança local | Expo SecureStore |
| Conectividade | NetInfo + lifecycle do aplicativo |
| API | Axios |
| Scanner | Expo Camera |
| Feedback nativo | Expo Haptics |
| Qualidade | TypeScript, ESLint, Vitest, Maestro e GitHub Actions |

### Estados do comando

| Estado | Significado |
| --- | --- |
| `pending` | Persistido e aguardando envio ou nova tentativa |
| `awaiting_confirmation` | Enviado, mas a confirmação ainda precisa ser reconciliada |
| `confirmed` | Servidor confirmou e devolveu um comprovante |
| `failed` | Servidor rejeitou a operação de forma definitiva |

## Executando localmente

Requisitos:

- Node.js 22+
- Xcode ou Android Studio
- Um development build para os módulos nativos

```bash
git clone https://github.com/willdeschepper/event-checkin.git
cd event-checkin
npm install
cp .env.example .env
npm start
```

O modo demonstração vem habilitado no `.env.example`. Ele disponibiliza eventos e
confirmações locais para testar navegação, câmera, persistência e feedback.

Para integrar uma API:

```env
EXPO_PUBLIC_DEMO_MODE=false
EXPO_PUBLIC_API_URL=https://api.example.com
```

O contrato esperado está em [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

### Development build e EAS

O repositório não grava um identificador fictício de projeto. Vincule o projeto
Expo da sua conta e então gere o development build:

```bash
npx eas-cli@latest init
npx eas-cli@latest build --profile development --platform android
# ou: --platform ios
```

## Qualidade

```bash
npm run lint
npm run type-check
npm test
npm run check
```

Os testes cobrem:

- retenção da fila enquanto o aparelho está offline;
- preservação da chave idempotente após resposta incerta;
- reconciliação sem reenvio quando o servidor já confirmou;
- reenvio com a mesma chave quando a operação não foi encontrada.

Com um development build instalado, o fluxo principal também pode ser validado
com Maestro:

```bash
maestro test .maestro/check-in.yaml
```

O workflow de CI executa lint, verificação de tipos e testes em cada pull request.

## Cenário de carga

O script k6 usa taxa constante de chegada para reproduzir o pico concentrado da
entrada de um evento:

```bash
k6 run \
  -e BASE_URL=https://api.example.com \
  -e EVENT_ID=event-health-2026 \
  -e RATE=40 \
  -e DURATION=30s \
  scripts/load/check-in.js
```

Os thresholds iniciais são menos de 1% de falhas e p95 abaixo de 500 ms. A taxa e
a duração podem ser aumentadas progressivamente para localizar o ponto de
saturação da API e do banco.

## Estrutura principal

```text
app/                         telas e navegação Expo Router
src/api/                     gateway HTTP e eventos
src/features/check-in/       fila, SQLite e motor de sincronização
src/providers/               lifecycle de rede e React Query
docs/API_CONTRACT.md         contrato de idempotência e reconciliação
scripts/load/check-in.js     cenário de carga k6
```

## Licença

MIT — consulte [`LICENSE`](LICENSE).

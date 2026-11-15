# MyHomeLab — app Android (React Native + Expo)

A app do MyHomeLab no telemóvel: o assistente (Jarvis) como página principal e o treino
guiado, com cronómetro, pausas, séries por tempo e uma notificação quando a pausa acaba,
mesmo com o ecrã bloqueado. Fala com a mesma API do site (`<servidor>/api`) e usa a mesma
sessão (cookie `access_token`).

TypeScript, Expo SDK 58, React Navigation (native-stack) e i18next (pt-PT, en, es em
`src/i18n/locales`). Não é um workspace npm: tem o seu `package-lock.json` e instala-se
aqui dentro, para o servidor (que corre `npm ci` na raiz) nunca o descarregar.

## Desenvolvimento

```bash
cd apps/mobile
npm install
npx expo run:android      # compila e instala uma build de desenvolvimento (emulador ou telemóvel por USB)
npx expo start            # depois disso, só o Metro (recarrega ao gravar)
npm run typecheck
```

No ecrã de login, o servidor de desenvolvimento é `http://10.0.2.2:<porta>` no emulador
(o `localhost` do PC). A API tem de estar atrás de `/api`, como em produção.

## APK de release

```bash
node scripts/build-apk.mjs 1.26.0                    # arm64-v8a + armeabi-v7a
ABIS=x86_64 node scripts/build-apk.mjs 1.26.0        # para o emulador
```

Precisa do Android SDK (`ANDROID_HOME`, ou o de origem em `%LOCALAPPDATA%\Android\Sdk`) com o
CMake 3.31.6 (`sdkmanager "cmake;3.31.6"`): o ninja do CMake 3.22 recusa no Windows os
caminhos longos que o C++ do React Native gera (o plugin `plugins/withAndroidBuild.js`
escolhe esta versão).

O script gera a pasta `android/` (`npx expo prebuild --clean`, fora do git), corre o Gradle e
deixa o APK em `build/apk/MyHomeLab-<versão>.apk`. A versão sai do argumento (ou de
`APP_VERSION`, ou da última tag `vX.Y.Z`); o `versionCode` é `major*10000 + minor*100 + patch`.
Na release do site, `scripts/android-release.mjs` (na raiz) faz isto e publica o APK no Forgejo.

Os ícones e o apito do fim da pausa geram-se com `npm run assets`.

## Assinatura — guarda uma cópia

O APK é assinado com `keystore/myhomelab-release.jks`, configurado em `keystore.properties`
(`storeFile` relativo a esta pasta). Os dois estão fora do git. É a mesma chave da primeira
versão da app (Kotlin), por isso esta instala por cima dela. **Se perderes a chave, as versões
novas deixam de instalar por cima** — guarda os dois ficheiros noutro sítio.

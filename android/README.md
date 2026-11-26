# App Android do Curso Vértice

Abre a plataforma (https://teste-claude-lilac.vercel.app) em tela cheia pelo Chrome (Trusted Web Activity).
Tudo o que muda no site aparece no app sozinho. Só é preciso gerar um APK novo se mudar o endereço do site,
o nome ou o ícone (aumente `versionCode` em `app/build.gradle`).

## Gerar o APK

Precisa do Android SDK (platform 35, build-tools 35) e da chave de assinatura `vertice.keystore`
(guardada pelo dono; **não fica no repositório**). Sempre a mesma chave: com outra, o Android não atualiza
o app instalado e a verificação do site (`public/.well-known/assetlinks.json`) deixa de valer.

```bash
export ANDROID_HOME=~/android-sdk
export VERTICE_KEYSTORE=/caminho/vertice.keystore
export VERTICE_KEYSTORE_PASSWORD='senha da chave'
echo "sdk.dir=$ANDROID_HOME" > local.properties
gradle assembleRelease
# APK: app/build/outputs/apk/release/app-release.apk
```

Mudou o endereço do site: troque `host` em `app/build.gradle` e o `site` em `app/src/main/res/values/strings.xml`,
e publique o `assetlinks.json` no novo endereço.

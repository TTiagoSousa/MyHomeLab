const { withAppBuildGradle } = require('expo/config-plugins');

// O APK de release é assinado com a mesma chave da app Kotlin, para instalar por cima
// dela: apps/mobile/keystore.properties (storeFile relativo a apps/mobile), fora do git.
// Sem esse ficheiro, a release fica com a assinatura de debug, como o Expo gera.
const SIGNING = `
def myHomeLabKeystore = rootProject.file("../keystore.properties")
def myHomeLabSigning = new Properties()
if (myHomeLabKeystore.exists()) {
    myHomeLabKeystore.withInputStream { myHomeLabSigning.load(it) }
}
`;

const RELEASE_CONFIG = `
        release {
            if (myHomeLabKeystore.exists()) {
                storeFile rootProject.file("../" + myHomeLabSigning.getProperty("storeFile"))
                storePassword myHomeLabSigning.getProperty("storePassword")
                keyAlias myHomeLabSigning.getProperty("keyAlias")
                keyPassword myHomeLabSigning.getProperty("keyPassword")
            }
        }`;

const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes('myHomeLabKeystore')) return mod;

    gradle = gradle.replace(/^android\s*\{/m, `${SIGNING}\nandroid {`);
    gradle = gradle.replace(/signingConfigs\s*\{/, (match) => `${match}${RELEASE_CONFIG}`);
    gradle = gradle.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
      '$1signingConfig myHomeLabKeystore.exists() ? signingConfigs.release : signingConfigs.debug',
    );
    mod.modResults.contents = gradle;
    return mod;
  });

module.exports = withReleaseSigning;

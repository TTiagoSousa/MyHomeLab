const { withAndroidManifest, withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

// Servidores na LAN por http (ex.: http://192.168.1.60; o login avisa quando é http:// fora da rede de casa) e só as arquiteturas pedidas (para o
// APK não levar as bibliotecas de x86 que nenhum telemóvel usa).
//
// CMake 3.31: o ninja do 3.22 (o de origem) recusa caminhos com mais de 260 caracteres no
// Windows mesmo com os caminhos longos ligados, e o C++ que o React Native gera embute o
// caminho absoluto de node_modules. O ninja 1.12 do 3.31 respeita os caminhos longos.
// Instala-se com: sdkmanager "cmake;3.31.6".
const CMAKE_VERSION = '3.31.6';

const withAndroidBuild = (config, { abis }) => {
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) application.$['android:usesCleartextTraffic'] = 'true';
    return mod;
  });

  config = withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes(`version "${CMAKE_VERSION}"`)) {
      mod.modResults.contents = mod.modResults.contents.replace(
        /^android\s*\{/m,
        (match) => `${match}\n    externalNativeBuild {\n        cmake {\n            version "${CMAKE_VERSION}"\n        }\n    }`,
      );
    }
    return mod;
  });

  return withGradleProperties(config, (mod) => {
    const properties = mod.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'reactNativeArchitectures'),
    );
    properties.push({ type: 'property', key: 'reactNativeArchitectures', value: abis.join(',') });
    mod.modResults = properties;
    return mod;
  });
};

module.exports = withAndroidBuild;

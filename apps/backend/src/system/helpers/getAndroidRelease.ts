import { git } from './git';
import { getInstalledVersion } from './getInstalledVersion';

export interface AndroidRelease {
  /** A versão do site instalada (vX.Y.Z), que é também a da app; null fora de uma release. */
  version: string | null;
  /** O APK dessa versão nas GitHub Releases; null quando não se sabe a versão ou o repositório. */
  downloadUrl: string | null;
}

/**
 * A app Android acompanha a versão do site: cada release publica na GitHub Release o
 * MyHomeLab-X.Y.Z.apk. A app compara a sua versão com esta e, se estiver atrás,
 * oferece o link. O endereço do repositório sai do remote do git, para não haver
 * mais uma variável de ambiente.
 */
export async function getAndroidRelease(): Promise<AndroidRelease> {
  const installed = await getInstalledVersion();
  const version = installed.version ?? installed.baseVersion;
  const remote = await git(['remote', 'get-url', 'origin']).catch(() => '');
  const repoUrl = /^https?:\/\//.test(remote)
    ? remote.replace(/\.git$/, '').replace(/\/\/[^@/]+@/, '//')
    : null;

  return {
    version,
    downloadUrl:
      version && repoUrl
        ? `${repoUrl}/releases/download/${version}/MyHomeLab-${version.replace(/^v/, '')}.apk`
        : null,
  };
}

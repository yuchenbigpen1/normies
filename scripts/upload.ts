import { createHash } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { Agent } from 'https';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Upload } from '@aws-sdk/lib-storage';

type UploadOptions = {
  electron: boolean;
  latest: boolean;
  script: boolean;
};

type BinaryInfo = {
  url: string;
  sha256: string;
  size: number;
  filename: string;
};

type VersionManifest = {
  version: string;
  build_time: string;
  build_timestamp: number;
  binaries: Record<string, BinaryInfo>;
};

function parseArgs(argv: string[]): UploadOptions {
  return {
    electron: argv.includes('--electron'),
    latest: argv.includes('--latest'),
    script: argv.includes('--script'),
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function normalizeEndpoint(raw: string): string {
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `https://${raw}`;
}

async function readJson<T>(path: string): Promise<T> {
  const content = await fs.readFile(path, 'utf8');
  return JSON.parse(content) as T;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function sha256Hex(path: string): Promise<string> {
  const buffer = await fs.readFile(path);
  return createHash('sha256').update(buffer).digest('hex');
}

function toPosixPath(parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

function inferPlatformKey(filename: string): string | null {
  const exe = filename.match(/^Normies-(x64|arm64)\.exe$/);
  if (exe) return `win32-${exe[1]}`;

  const appImage = filename.match(/^Normies-(x64|arm64)\.AppImage$/);
  if (appImage) return `linux-${appImage[1]}`;

  const macZip = filename.match(/^Normies-(x64|arm64)\.zip$/);
  if (macZip) return `darwin-${macZip[1]}`;

  const macDmg = filename.match(/^Normies-(x64|arm64)\.dmg$/);
  if (macDmg) return `darwin-${macDmg[1]}`;

  return null;
}

// Files above this size use multipart upload (10MB)
const MULTIPART_THRESHOLD = 10 * 1024 * 1024;

async function putObject(
  client: S3Client,
  bucket: string,
  key: string,
  body: Uint8Array | string,
  contentType?: string
): Promise<void> {
  const size = typeof body === 'string' ? Buffer.byteLength(body) : body.length;

  if (size > MULTIPART_THRESHOLD) {
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      },
      // 25MB parts, sequential uploads to avoid TLS connection issues
      partSize: 25 * 1024 * 1024,
      queueSize: 1,
    });
    upload.on('httpUploadProgress', (progress) => {
      if (progress.loaded && progress.total) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        process.stdout.write(`\r  ${key}: ${pct}%`);
      }
    });
    await upload.done();
    process.stdout.write(`\r  ${key}: done\n`);
  } else {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }
}

async function uploadElectronArtifacts(
  client: S3Client,
  bucket: string,
  version: string,
  options: UploadOptions
): Promise<void> {
  const repoRoot = process.cwd();
  const releaseDir = join(repoRoot, 'apps', 'electron', 'release');
  const entries = await fs.readdir(releaseDir, { withFileTypes: true });
  const files = entries.filter(e => e.isFile()).map(e => e.name);

  if (files.length === 0) {
    throw new Error(`No release artifacts found in ${releaseDir}`);
  }

  const versionsBaseUrl = process.env.NORMIES_VERSIONS_URL?.trim() || 'https://updates.normies.work/electron';

  // Fetch existing manifest so we merge new binaries into it (e.g. Mac + Windows built separately)
  let existingBinaries: Record<string, BinaryInfo> = {};
  try {
    const manifestUrl = `${versionsBaseUrl}/${version}/manifest.json`;
    const res = await fetch(manifestUrl);
    if (res.ok) {
      const existing = (await res.json()) as VersionManifest;
      existingBinaries = existing.binaries || {};
      console.log(`[upload] Merging with existing manifest (${Object.keys(existingBinaries).length} binaries already present).`);
    }
  } catch {
    // No existing manifest — starting fresh
  }

  const manifest: VersionManifest = {
    version,
    build_time: new Date().toISOString(),
    build_timestamp: Date.now(),
    binaries: { ...existingBinaries },
  };

  const uploadedKeys: string[] = [];

  for (const filename of files) {
    const localPath = join(releaseDir, filename);
    const content = await fs.readFile(localPath);
    const versionKey = toPosixPath(['electron', version, filename]);
    await putObject(client, bucket, versionKey, content);
    uploadedKeys.push(versionKey);

    const platformKey = inferPlatformKey(filename);
    if (platformKey) {
      const stat = await fs.stat(localPath);
      manifest.binaries[platformKey] = {
        url: `${versionsBaseUrl}/${version}/${filename}`,
        sha256: await sha256Hex(localPath),
        size: stat.size,
        filename,
      };
    }
  }

  const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  const manifestKey = toPosixPath(['electron', version, 'manifest.json']);
  await putObject(client, bucket, manifestKey, manifestBuffer, 'application/json');
  uploadedKeys.push(manifestKey);

  if (options.latest) {
    for (const filename of files) {
      const localPath = join(releaseDir, filename);
      const content = await fs.readFile(localPath);
      const latestKey = toPosixPath(['electron', 'latest', filename]);
      await putObject(client, bucket, latestKey, content);
      uploadedKeys.push(latestKey);
    }

    const latestVersionBody = Buffer.from(JSON.stringify({ version }, null, 2) + '\n', 'utf8');
    await putObject(client, bucket, toPosixPath(['electron', 'latest']), latestVersionBody, 'application/json');
    await putObject(client, bucket, toPosixPath(['electron', 'latest.json']), latestVersionBody, 'application/json');
    uploadedKeys.push('electron/latest');
    uploadedKeys.push('electron/latest.json');
  }

  console.log(`Uploaded ${uploadedKeys.length} electron object(s).`);
}

async function uploadInstallerScripts(client: S3Client, bucket: string): Promise<void> {
  const repoRoot = process.cwd();
  const shPath = join(repoRoot, 'scripts', 'install-app.sh');
  const ps1Path = join(repoRoot, 'scripts', 'install-app.ps1');

  const shContent = await fs.readFile(shPath);
  const ps1Content = await fs.readFile(ps1Path);

  await putObject(client, bucket, 'install-app.sh', shContent, 'text/x-shellscript');
  await putObject(client, bucket, 'install-app.ps1', ps1Content, 'text/plain');
  console.log('Uploaded installer scripts (install-app.sh, install-app.ps1).');
}

function getGitHubToken(): string | null {
  // Check env vars first
  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (envToken) return envToken;

  // Fall back to gh CLI auth
  try {
    return execSync('gh auth token', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

async function triggerWindowsBuild(): Promise<void> {
  // Don't trigger from CI — the Windows build IS the CI job
  if (process.env.CI) {
    return;
  }

  const token = getGitHubToken();
  if (!token) {
    console.warn('[upload] No GitHub token found (set GITHUB_TOKEN or run "gh auth login") — skipping Windows build trigger.');
    return;
  }

  const repo = process.env.GITHUB_REPO || 'nicepkg/normies';
  const url = `https://api.github.com/repos/${repo}/dispatches`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ event_type: 'build-windows' }),
  });

  if (response.ok || response.status === 204) {
    console.log('[upload] Triggered Windows build on GitHub Actions.');
  } else {
    const body = await response.text();
    console.warn(`[upload] Failed to trigger Windows build (${response.status}): ${body}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.electron && !options.script) {
    throw new Error('Nothing to upload. Pass --electron and/or --script.');
  }
  if (options.latest && !options.electron) {
    throw new Error('--latest requires --electron.');
  }

  const endpoint = normalizeEndpoint(requiredEnv('S3_VERSIONS_BUCKET_ENDPOINT'));
  const bucket = requiredEnv('S3_VERSIONS_BUCKET_NAME');
  const accessKeyId = requiredEnv('S3_VERSIONS_BUCKET_ACCESS_KEY_ID');
  const secretAccessKey = requiredEnv('S3_VERSIONS_BUCKET_SECRET_ACCESS_KEY');

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    requestHandler: new NodeHttpHandler({
      httpsAgent: new Agent({ keepAlive: false }),
      connectionTimeout: 30_000,
      socketTimeout: 300_000,
    }),
  });

  if (options.electron) {
    const manifestPath = join(process.cwd(), '.build', 'upload', 'manifest.json');
    let version: string | undefined;

    if (await fileExists(manifestPath)) {
      const releaseManifest = await readJson<{ version: string }>(manifestPath);
      version = releaseManifest.version;
      if (!version) {
        throw new Error(`Invalid version manifest at ${manifestPath}`);
      }
    } else {
      const pkgPath = join(process.cwd(), 'apps', 'electron', 'package.json');
      const pkg = await readJson<{ version?: string }>(pkgPath);
      version = pkg.version;
      if (!version) {
        throw new Error(`Missing version in ${pkgPath}`);
      }
      console.warn(`[upload] ${manifestPath} not found. Falling back to version ${version} from apps/electron/package.json.`);
    }

    await uploadElectronArtifacts(client, bucket, version, options);

    // After Mac artifacts are uploaded, trigger the Windows CI build
    await triggerWindowsBuild();
  }

  if (options.script) {
    await uploadInstallerScripts(client, bucket);
  }
}

main().catch((error) => {
  console.error(`[upload] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

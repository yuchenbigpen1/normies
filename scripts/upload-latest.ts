/**
 * Minimal script to copy today's DMGs into electron/latest/ and update manifest.
 * Run this when the main upload.ts fails mid-way through the zip files.
 * Usage: bun run scripts/upload-latest.ts
 */
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Agent } from 'https';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Upload } from '@aws-sdk/lib-storage';

const MULTIPART_THRESHOLD = 10 * 1024 * 1024;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Missing env: ${name}`);
  return value.trim();
}

function normalizeEndpoint(raw: string): string {
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

async function sha256Hex(path: string): Promise<string> {
  const buffer = await fs.readFile(path);
  return createHash('sha256').update(buffer).digest('hex');
}

async function uploadWithRetry(
  client: S3Client,
  bucket: string,
  key: string,
  localPath: string,
  contentType?: string,
  attempt = 1
): Promise<void> {
  try {
    const content = await fs.readFile(localPath);
    const size = content.length;

    if (size > MULTIPART_THRESHOLD) {
      const upload = new Upload({
        client,
        params: { Bucket: bucket, Key: key, Body: content, ContentType: contentType },
        partSize: 10 * 1024 * 1024, // Smaller 10MB chunks for stability
        queueSize: 1,
      });
      upload.on('httpUploadProgress', (p) => {
        if (p.loaded && p.total) {
          const pct = Math.round((p.loaded / p.total) * 100);
          process.stdout.write(`\r  ${key}: ${pct}%`);
        }
      });
      await upload.done();
      process.stdout.write(`\r  ${key}: done\n`);
    } else {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: content, ContentType: contentType }));
      console.log(`  ${key}: done`);
    }
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      console.log(`\n  ${key}: failed (attempt ${attempt}), retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
      return uploadWithRetry(client, bucket, key, localPath, contentType, attempt + 1);
    }
    throw err;
  }
}

async function main() {
  const endpoint = normalizeEndpoint(requiredEnv('S3_VERSIONS_BUCKET_ENDPOINT'));
  const bucket = requiredEnv('S3_VERSIONS_BUCKET_NAME');
  const accessKeyId = requiredEnv('S3_VERSIONS_BUCKET_ACCESS_KEY_ID');
  const secretAccessKey = requiredEnv('S3_VERSIONS_BUCKET_SECRET_ACCESS_KEY');
  const versionsBaseUrl = process.env.NORMIES_VERSIONS_URL?.trim() || 'https://updates.normies.work/electron';

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

  const repoRoot = process.cwd();
  const releaseDir = join(repoRoot, 'apps', 'electron', 'release');

  // Read version from manifest
  const manifestPath = join(repoRoot, '.build', 'upload', 'manifest.json');
  const pkg = await fs.readFile(manifestPath, 'utf8');
  const { version } = JSON.parse(pkg) as { version: string };
  console.log(`Uploading version ${version} to latest/...`);

  // Files to upload to latest/ (DMGs + blockmaps + zips if they exist)
  const allFiles = await fs.readdir(releaseDir);
  const uploadFiles = allFiles.filter(f => f.match(/^Normies-(arm64|x64)\.(dmg|zip|dmg\.blockmap|zip\.blockmap)$/) || f === 'latest-mac.yml');

  console.log(`Files to upload: ${uploadFiles.join(', ')}\n`);

  // Build manifest binaries
  const binaries: Record<string, { url: string; sha256: string; size: number; filename: string }> = {};

  for (const filename of uploadFiles) {
    const localPath = join(releaseDir, filename);

    // Upload to versioned path (in case it wasn't uploaded yet)
    const versionedKey = `electron/${version}/${filename}`;
    await uploadWithRetry(client, bucket, versionedKey, localPath);

    // Upload to latest/
    const latestKey = `electron/latest/${filename}`;
    await uploadWithRetry(client, bucket, latestKey, localPath);

    // Track DMG/zip binaries for manifest
    const dmgMatch = filename.match(/^Normies-(x64|arm64)\.dmg$/);
    if (dmgMatch) {
      const arch = dmgMatch[1];
      const stat = await fs.stat(localPath);
      binaries[`darwin-${arch}`] = {
        url: `${versionsBaseUrl}/${version}/${filename}`,
        sha256: await sha256Hex(localPath),
        size: stat.size,
        filename,
      };
    }
  }

  // Update manifest
  const manifest = {
    version,
    build_time: new Date().toISOString(),
    build_timestamp: Date.now(),
    binaries,
  };
  const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  // Upload versioned manifest
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: `electron/${version}/manifest.json`,
    Body: manifestBuf,
    ContentType: 'application/json',
  }));
  console.log(`  electron/${version}/manifest.json: done`);

  // Upload latest pointer files
  const latestVersionBuf = Buffer.from(JSON.stringify({ version }, null, 2) + '\n', 'utf8');
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: 'electron/latest', Body: latestVersionBuf, ContentType: 'application/json' }));
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: 'electron/latest.json', Body: latestVersionBuf, ContentType: 'application/json' }));
  console.log('  electron/latest + electron/latest.json: done');

  console.log('\nAll done!');
}

main().catch(err => {
  console.error(`\nFatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

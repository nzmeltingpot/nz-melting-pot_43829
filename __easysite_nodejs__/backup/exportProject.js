/**
 * Backend: backup/exportProject.js
 * Reads all project source files and returns them as an array of { path, content }
 * so the frontend can package them into a downloadable ZIP.
 *
 * Excluded: .env*, node_modules, dist, build, .git, binary files
 */

const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.cache', '__pycache__', '.vite']);
const EXCLUDE_FILENAMES = new Set(['.env', '.env.local', '.env.production', '.env.development', '.DS_Store']);
const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.avif',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp4', '.mp3', '.wav', '.ogg', '.webm',
  '.pdf', '.zip', '.tar', '.gz', '.7z',
  '.exe', '.dll', '.so', '.dylib',
]);
const MAX_FILE_SIZE = 500_000; // 500 KB per file

function getExt(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

async function collectDir(dirPath, relBase, files) {
  try {
    for await (const entry of Deno.readDir(dirPath)) {
      const fullPath = `${dirPath}/${entry.name}`;
      const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;

      if (entry.isDirectory) {
        if (EXCLUDE_DIRS.has(entry.name)) continue;
        await collectDir(fullPath, relPath, files);
      } else if (entry.isFile) {
        if (EXCLUDE_FILENAMES.has(entry.name)) continue;
        if (entry.name.startsWith('.env')) continue;
        if (BINARY_EXTS.has(getExt(entry.name))) continue;

        try {
          const stat = await Deno.stat(fullPath);
          if (stat.size > MAX_FILE_SIZE) continue; // skip huge files

          const content = await Deno.readTextFile(fullPath);
          files.push({ path: relPath, content });
        } catch (_) {
          // skip unreadable / binary files
        }
      }
    }
  } catch (_) {
    // skip unreadable directories
  }
}

export async function exportProject() {
  // Resolve project root from this file's location
  // This file: __easysite_nodejs__/backup/exportProject.js
  // Project root is 3 levels up
  const fileUrl = new URL(import.meta.url);
  const filePath = fileUrl.pathname;
  const projectRoot = filePath.split('/').slice(0, -3).join('/');

  const files = [];

  // --- Source directories ---
  for (const dir of ['src', 'public']) {
    await collectDir(`${projectRoot}/${dir}`, dir, files);
  }

  // --- Custom backend code ---
  await collectDir(`${projectRoot}/__easysite_nodejs__`, '__easysite_nodejs__', files);

  // --- Root config files ---
  for (const name of [
    'index.html',
    'package.json',
    'package-lock.json',
    'vite.config.js',
    'vercel.json',
    '.gitignore',
    'tailwind.config.js',
    'postcss.config.js',
    'tsconfig.json',
    'tsconfig.app.json',
    'tsconfig.node.json',
  ]) {
    try {
      const content = await Deno.readTextFile(`${projectRoot}/${name}`);
      files.push({ path: name, content });
    } catch (_) {
      // file doesn't exist — skip
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    projectName: 'nzmeltingpot',
    totalFiles: files.length,
    files,
  };
}

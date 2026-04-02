/**
 * deploy.js — Export + auto push ke GitHub dalam 1 perintah
 * Jalankan perintah: node deploy.js
 * ─────────────────────────────────────────────────
 * Script ini otomatis:
 *   1. Export data ke folder docs/
 *   2. git add docs/
 *   3. git commit
 *   4. git push → website update di GitHub Pages!
 */

const { execSync } = require('child_process');

function run(cmd, label) {
  console.log('\n⏳', label || cmd, '...');
  try {
    execSync(cmd, { stdio: 'inherit', cwd: __dirname });
    return true;
  } catch (e) {
    // git commit returns exit code 1 jika tidak ada perubahan — itu bukan error
    if (cmd.startsWith('git commit') && e.status === 1) return 'no-change';
    console.error('\n❌ Gagal saat:', label || cmd);
    console.error('   Detail:', e.message);
    return false;
  }
}

console.log('════════════════════════════════════════');
console.log('  🚀 AUTO DEPLOY ke GitHub Pages');
console.log('════════════════════════════════════════');

// Step 1: Generate file statis
require('./export.js');

// Step 2: Git operations
const timestamp = new Date().toLocaleString('id-ID', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

if (!run('git add docs/', 'Menandai perubahan')) process.exit(1);

const commitResult = run(`git commit -m "Deploy ${timestamp}"`, 'Menyimpan perubahan (commit)');

if (commitResult === 'no-change') {
  console.log('\nℹ️  Tidak ada perubahan baru sejak deploy terakhir.');
  console.log('   Website sudah up-to-date, tidak perlu push.\n');
  process.exit(0);
}

if (!commitResult) process.exit(1);

if (!run('git push', 'Upload ke GitHub')) {
  console.log('\n💡 Tips jika gagal push:');
  console.log('   - Pastikan kamu sudah login GitHub di terminal');
  console.log('   - Jalankan: git remote -v (untuk cek remote sudah benar)');
  process.exit(1);
}

console.log('\n════════════════════════════════════════');
console.log('  ✅ BERHASIL DEPLOY!');
console.log('════════════════════════════════════════');
console.log('  Website kamu sedang diupdate...');
console.log('  ⏰ Tunggu 1-2 menit, lalu buka:');
console.log('  👉 https://<username>.github.io/<repo-name>');
console.log('════════════════════════════════════════\n');

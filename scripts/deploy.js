const path = require('path');
const os = require('os');
const fs = require('fs');
const ci = require('miniprogram-ci');

async function main() {
  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_APPSECRET;
  const privateKey = process.env.WECHAT_PRIVATE_KEY;
  const adminApiUrl = process.env.ADMIN_API_URL;
  const adminApiToken = process.env.ADMIN_API_TOKEN;

  const required = [
    ['WECHAT_APPID', appid],
    ['WECHAT_APPSECRET', secret],
    ['WECHAT_PRIVATE_KEY', privateKey],
    ['ADMIN_API_URL', adminApiUrl],
    ['ADMIN_API_TOKEN', adminApiToken],
  ];
  for (const [name, value] of required) {
    if (!value) {
      throw new Error(`Missing required secret/env: ${name}`);
    }
  }

  const keyPath = path.join(os.tmpdir(), 'private.key');
  fs.writeFileSync(keyPath, privateKey, { encoding: 'utf8', mode: 0o600 });

  const project = new ci.Project({
    appid,
    type: 'miniProgram',
    projectPath: process.cwd(),
    privateKeyPath: keyPath,
    ignores: ['node_modules/**/*'],
  });

  const result = await ci.upload({
    project,
    version: '1.0.0',
    desc: 'CI auto deploy',
    setting: {
      es6: true,
      minify: true,
      autoPrefixWXSS: true,
    },
    onProgressUpdate: (info) => console.log('progress:', info),
  });

  console.log('upload success, result =', JSON.stringify(result));

  // 部署后调用 adminApi 检查后端连通性（可选，不阻塞）
  try {
    const check = await fetch(`${adminApiUrl}/health`, {
      headers: { Authorization: `Bearer ${adminApiToken}` },
    });
    console.log('adminApi check:', check.status, await check.text());
  } catch (err) {
    console.warn('adminApi health check failed (non-blocking):', err.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

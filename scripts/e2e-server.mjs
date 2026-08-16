import fs from 'node:fs'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import http from 'node:http'
import https from 'node:https'

const root = process.cwd()
const profile = path.resolve(process.env.TEST_PROFILE_DIR ?? path.join(root, '.tmp', 'e2e-profile'))
const content = path.join(profile, 'content')
const data = path.join(profile, 'data')
fs.mkdirSync(profile, { recursive: true })
if (!fs.existsSync(content)) fs.cpSync(path.join(root, 'src/content'), content, { recursive: true })
fs.mkdirSync(data, { recursive: true })

const publicPort = Number(process.env.PORT ?? 4323)
const appPort = publicPort + 1
const certDir = path.join(profile, 'tls')
const keyFile = path.join(certDir, 'key.pem')
const certFile = path.join(certDir, 'cert.pem')
if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
  fs.mkdirSync(certDir, { recursive: true })
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyFile, '-out', certFile, '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' })
}

const child = spawn(process.execPath, ['dist/server/entry.mjs'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    DATA_PATH: content,
    DATA_DIR: data,
    // Deliberately override dotenv/host credentials: this profile must never
    // inherit production origin or admin secrets.
    PORT: String(appPort),
    SITE_URL: `https://localhost:${publicPort}`,
    ADMIN_SECRET: 'e2e-only-setup-key',
  },
})
const proxy = https.createServer({ key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) }, (req, res) => {
  const upstream = http.request({ hostname: '127.0.0.1', port: appPort, path: req.url, method: req.method, headers: req.headers }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
    upstreamRes.pipe(res)
  })
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end() })
  req.pipe(upstream)
})
proxy.listen(publicPort, '0.0.0.0')

const stop = (signal) => { proxy.close(); child.kill(signal) }
process.on('SIGTERM', () => stop('SIGTERM'))
process.on('SIGINT', () => stop('SIGINT'))
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))

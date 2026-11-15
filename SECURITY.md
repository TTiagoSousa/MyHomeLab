# Security Policy

MyHomeLab holds the keys to your home lab (SSH keys, Proxmox tokens, app credentials, OAuth
tokens), so security reports are taken seriously.

## Supported versions

Only the **latest release** receives security fixes. Update from **Admin → Version** in the app.

## Reporting a vulnerability

**Please do not open a public issue.** Report it privately through
[GitHub Security Advisories](https://github.com/TTiagoSousa/MyHomeLab/security/advisories/new)
(the **Security → Report a vulnerability** button on the repository).

Include, if you can:

- the version (Admin → Version) and how it is deployed;
- what an attacker could do and the steps to reproduce it;
- any proof of concept, logs or screenshots (with secrets removed).

You should get a first answer within **7 days**. Once a fix is released, the advisory is
published with credit to you, unless you prefer to stay anonymous.

## Scope

In scope: the backend API, the web app, the Android app, the Proxmox installer and updater in
`deploy/proxmox`, and how secrets are stored.

Out of scope: vulnerabilities in the third-party apps MyHomeLab connects to (report those to
their projects), and setups that expose MyHomeLab to the internet with the default
`admin / admin` account.

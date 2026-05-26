# Security Policy

## Scope

This repository is the desktop client for Stealth Lightbeacon. Security-relevant
areas in this repo include:

- persisted backend configuration
- local companion process startup and shutdown
- remote transport policy
- Rust-side auth-token lookup
- contract drift between desktop and backend

## Security Boundaries

- React does not persist secrets.
- Remote bearer tokens are read only in Rust from
  `STEALTH_LIGHTBEACON_REMOTE_AUTH_TOKEN`.
- Remote mode requires `https://`.
- Local companion startup is loopback-bound and runtime-discovered.

## Reporting

If you discover a vulnerability in this repo or its desktop-to-backend
integration surface, report it privately to the maintainers before opening a
public issue. Include:

- affected commit or tag
- impacted operating system
- reproduction steps
- whether the issue affects local mode, remote mode, or both

## Hardening Checklist

- Keep `npm run check:contract-sync` green.
- Keep `npm run validate:release` green.
- Do not move secret handling into the frontend adapter.
- Do not relax remote HTTPS enforcement without an explicit policy change.

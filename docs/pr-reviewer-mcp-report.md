# PR Reviewer Integration Report

Generated: 2026-02-11

## Scope

This report documents the active DevSuite PR-review integration path.

## Current Architecture

- GitHub access is centralized in `apps/gh-service`.
- Web users connect GitHub from UI via device flow endpoints:
  - `POST /github/connect/start`
  - `GET /github/connect/status`
  - `POST /github/disconnect`
- PR data for MCP tools is provided by service APIs:
  - `POST /github/pr/discover`
  - `POST /github/pr/bundle-data`

## MCP Tool Behavior

MCP tools in `apps/mcp` no longer execute GitHub commands directly.

- `pr_list`
  - Calls `gh-service` `/github/pr/discover`
  - Requires `authToken`, `userId`, and `repo`
- `pr_bundle`
  - Calls `gh-service` `/github/pr/bundle-data`
  - Requires `authToken`, `userId`, and `prUrl`
  - Still writes local bundle artifacts (`meta.json`, `diff.patch`, `files.txt`, optional `checks.json`)

## Auth and Isolation

- MCP access is protected by `MCP_TOKEN`.
- gh-service requests include `x-devsuite-user-id` and optional bearer token (`DEVSUITE_GH_SERVICE_TOKEN`).
- GitHub authorization is user-scoped in gh-service and persisted encrypted at rest.

## Operational Notes

- gh-service must be reachable from MCP (`DEVSUITE_GH_SERVICE_URL`, default `http://localhost:8790`).
- In production, configure service token protection and matching caller token.
- Notification polling and inbox ingestion remain handled by gh-service + Convex backend routes.

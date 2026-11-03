# Couples — independent live Appwrite resource checkpoint (4 November 2026)

**Purpose:** Hand off verified cloud resources to ZCode. This is a readback of the **dedicated** `couples` Appwrite project, not an approval to deploy the current privileged Function or release a customer APK.

## Verified live project
- Project ID: `6ae6e1be00021a01c9ec`, name `couples`, ACTIVE, region Singapore `sgp`.
- Endpoint: `https://sgp.cloud.appwrite.io/v1`.
- Free organization; no paid project resources were requested.
- TablesDB database: `couples_main` READY.
- 15 tables, **73 columns**, 23 indexes. **Correction:** the ZCode session reported **75 columns**, but a full 15-table live `get_table` readback and the committed `appwrite/schema.contract.json` both show **73**. All column and index names match the contract; no missing fields/indexes; columns/indexes reported available. Every table has `$permissions: []` (no table-wide client permissions).
- `question_bank`: 90 rows, and every live row's `data.category` and `data.text` matched the canonical `appwrite/questions.seed.json` for the matching deterministic `$id`. No fictional users were created.
- Query format tested through the live TablesDB operator: SDK-style `{method:'equal',attribute:'category',values:['Everyday']}` + limit returned 10 questions; `{method:'orderAsc',attribute:'$id'}` + cursorAfter `q50` returned 40 rows `q51` onward; REST-doc `column` format was rejected. Keep the actually accepted `attribute` query serialization.
- Android platform: **created by ChatGPT via connected Appwrite API**, ID `couples_android`, package `com.projecttwo.app`; re-read through `project_list_platforms`. ZCode's earlier 409/list-empty anomaly is **resolved**. No duplicate registration needed.
- Storage bucket: **created by ChatGPT via connected Appwrite API**, ID `couples_memory_photos`, name `Couples Private Memory Photos`. Empty `$permissions: []`; `fileSecurity: true`, enabled, encryption and antivirus enabled, max size 10 MiB, extension allowlist jpg/jpeg/png/webp/heic/heif, transformations disabled. Verified by reading back the bucket. No personal photos uploaded.
- Appwrite project as checked: 0 users, 0 Functions, 0 project API keys. **No live server-side Function or real-user integration is proven.**

## Important deployment improvement — no permanent project API key is necessarily required

Appwrite's official Function documentation states that each Function execution includes an **ephemeral scoped API key** in the `x-appwrite-key` request header. Its permitted scopes are configured on the Function's Settings → Scopes. This can replace a long-lived manually created project key for the trusted TablesDB/Users operations.

The existing `functions/couples-api/src/lib.js` instead reads a module-level `APPWRITE_API_KEY` and rejects startup when absent; `content.js` has a separate `jsonHeaders()` that also reads this static key. Before deployment, **refactor to a request-scoped authorization context** that uses Appwrite's injected `req.headers['x-appwrite-key']`, with actual scopes chosen minimally and validated on execution. Do not put it in client, Git or logs; don't keep any per-request secret in shared global state. Preserve the existing independent `x-appwrite-user-jwt` → `/account` authentication and verified-email checks. If a static key is ultimately needed, first justify why Appwrite's documented ephemeral key cannot meet the requirement; do not ask the owner to create one by default.

Official docs: https://appwrite.io/docs/products/functions/develop and https://appwrite.io/docs/products/functions/environment-variables

## Remaining deployment and acceptance gates

1. **Review & repair Function credential wiring** to use least-privilege scoped per-execution keys, with tests of missing/spoofed JWT, missing ephemeral key, no shared state leakage, user verification, and exact server scopes. Never deploy an admin Function with unrestricted execution permissions.
2. Validate **real TablesDB response field placement** against the official REST/SDK return shape (the connected console operator returns row metadata with a nested `data` object, which may be a wrapper; don't infer raw REST shape from that without checking direct REST).
3. Code integration still pending: `AppwriteRepository`, all existing `BackendAdapter` methods, real email registration/verification/recovery, secure remote memory photos, and production-mode no-demo fallback.
4. Privileged `couples-api` Function not created/deployed yet. Host a reviewed test Function with scoped permissions only after source verification. Run disposable A/B/C live adversarial tests, including cross-couple reads, sealed answers and account deletion; separate hosted results from mock counts.
5. The existing EAS APK is demo-only. Build and test a *new* Appwrite-enabled APK only after hosted acceptance. Preserve frozen demo PR #1; keep Appwrite PR #2 draft and unmerged.
6. Check Windows C: disk before local testing; ZCode last reported ~1.2 GiB free. No destructive AVD/Docker cleanup, local Gradle/emulator or paid resources.

**Verification boundary:** The live resource and seed readbacks above were executed from the connected Appwrite account. They are **not** a production security certification. Cloud Functions, real user identities, and mobile E2E remain untested.

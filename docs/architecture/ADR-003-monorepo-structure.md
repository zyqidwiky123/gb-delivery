# ADR-003: Monorepo Structure

**Status:** Accepted

**Context:**
ARO DRIVE memiliki 3 aplikasi frontend (User App, Admin Dashboard, Driver App) dan 1 backend (Cloud Functions), semuanya dalam satu organisasi. Pertanyaan: satu repo atau multi-repo?

**Opsi yang dipertimbangkan:**

1. **Multi-repo** — Setiap app punya repo sendiri, shared package via npm registry private
2. **Monorepo** — Semua kode dalam satu repo dengan npm workspaces

**Decision:**
Gunakan **Monorepo dengan npm Workspaces**:

```
aro-drive/
├── aro-drive-vite/          # User App (React 19 + Vite)
├── aro-admin-vite/          # Admin Dashboard (React 19 + Vite)
├── aro-driver-kotlin/       # Driver App (Android Kotlin)
├── functions/               # Cloud Functions (Node.js)
├── packages/shared/         # @aro/shared — TypeScript library
└── docs/                    # Dokumentasi
```

Shared package (`@aro/shared`) mencakup:

- Firebase config & initialization
- Pricing formula (`calculateFee`, `haversine`)
- Shared React components (`LocationPickerModal`)
- Utility functions (`safeNum`, `deepClean`)

**Consequences:**

Positive:

- Atomic commits — perubahan pricing formula di shared package + semua consumer dalam 1 commit
- Code sharing tanpa publish ke npm registry — cukup `npm install` dari root
- Satu CI/CD pipeline untuk semua apps (test semua, deploy selektif)
- Refactor lebih mudah — lihat impact perubahan secara langsung

Negative:

- Build time lebih lama (CI perlu test semua apps)
- Dependency coupling — satu `package.json` error bisa block semua apps
- Repo size besar (terutama dengan Android SDK + node_modules)
- Setup lebih kompleks (npm workspaces, TS config per sub-project)

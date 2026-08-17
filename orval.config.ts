import { defineConfig } from "orval"

export default defineConfig({
  mawadda: {
    // The generated client must match THIS backend, not the pharmacy's.
    // Read from a checked-in schema file so `pnpm api` needs no running
    // server and CI is reproducible. Refresh the file with:
    //   cd ../mawadda-backend && python manage.py spectacular \
    //     --file ../mawadda-frontend/api/schema.yaml
    // Override with API_SCHEMA_URL to generate straight from a live backend.
    input: process.env.API_SCHEMA_URL || "./api/schema.yaml",
    output: {
      mode: "tags-split", // one folder per tag: auth, products, customers, debts
      target: "api/generated",
      schemas: "api/generated/model",
      client: "react-query",
      httpClient: "fetch",
      clean: true,
      override: {
        mutator: { path: "api/http.ts", name: "customFetch" },
        query: { useInfinite: true, useInfiniteQueryParam: "page" },
      },
    },
  },
})

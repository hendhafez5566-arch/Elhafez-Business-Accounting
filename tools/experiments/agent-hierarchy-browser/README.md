# Agent hierarchy browser acceptance

From repository root, with pinned Playwright installed under `tools/experiments/offline-proof`:

```sh
OFFLINE_PROOF_CHROMIUM=/path/to/chromium node tools/experiments/agent-hierarchy-browser/browser.spec.mjs
```

Five cases (six including parent) use the production AgentHierarchy component with an HTTP fixture and explicit session. They cover display/counts, linking and reload, cycle rejection, permission rejection and detaching. The fixture is not the production API or PostgreSQL. Real AppModule acceptance and explicit native repository acceptance run separately in the existing disposable PostgreSQL CI runner. No financial posting or offline authorization is claimed.

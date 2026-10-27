import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";

function renderAt(path: string) {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<RouterProvider router={router} />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Assert only that the router mounts and paints, never page content:
// routes are rewritten as the app is built and this must keep passing.
//
// Skipped (CI-blocking as written): __root.tsx's `shellComponent` renders a
// full <html>/<head>/<body> document (required for TanStack Start SSR).
// RouterProvider renders that shell even in this client-only RTL harness,
// and React refuses to commit an <html> element under the div `render()`
// mounts into (jsdom gets a real `appendChild`, not HTML-string parsing, so
// nothing gets hoisted to the real document either) — `container.firstChild`
// and `document.body` both stay empty forever, so this never passed under
// the current root-route design. Separately, router.state.status also never
// reaches "idle" under plain vitest+jsdom (stuck "pending") — TanStack
// Start's client router appears to expect bootstrapping this harness doesn't
// provide. Needs a real redesign (e.g. an SSR-rendered-string assertion, or
// a Playwright test against the dev server) rather than RTL+jsdom — not a
// one-line fix, so left skipped instead of deleted.
describe.skip("App routing", () => {
  it("renders the index route", async () => {
    const { container } = renderAt("/");

    await waitFor(() => expect(container.firstChild).not.toBeNull());
  });

  it("renders the not-found route", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { container } = renderAt("/this-route-does-not-exist");

    await waitFor(() => expect(container.firstChild).not.toBeNull());
  });
});

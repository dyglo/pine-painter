<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Chart is Vela workspace loaded via dynamic import in a ClientOnly lazy component (src/components/ChartWorkspace.tsx) — Vela touches the DOM and must not run during SSR.
- AI Pine generation runs in a createServerFn (src/lib/ai/pine-ai.*) through Lovable AI Gateway Responses API; the self-heal retry loop lives on the client so each attempt is re-run on the real chart.

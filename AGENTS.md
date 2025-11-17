# Contribution Guidelines

Welcome to **DispoTool**, a custom real estate buyer CRM. This project uses the following stack:

- **Next.js App Router** for the application framework
- **Tailwind CSS** for styling
- **Supabase** as the database and authentication layer
- **shadcn/ui** for React components

## Coding Style

- Use **TypeScript** with functional React components.
- Keep indentation at **2 spaces** and use **double quotes** for strings.
- Prefer utility-first styling with Tailwind CSS classes.
- Avoid large refactors unless explicitly requested; preserve existing logic and layout.
- Run `pnpm run lint` and address any ESLint issues before committing.

## Testing Requirements

- Install dependencies via `pnpm install` if needed.
- Always run both `pnpm run lint` and `pnpm test` before committing changes.
- Ensure all tests pass locally. New features should include corresponding tests in the `tests` directory when possible.

## Pull Request Conventions

- Use concise titles such as `feat:`, `fix:`, or `chore:` followed by a short description.
- In the PR description, include:
  - A **Summary** section outlining key changes with inline file citations if relevant.
  - A **Testing** section showing the results of `pnpm run lint` and `pnpm test`.
  - Optionally mention any deployment considerations or follow-up work.

Following these guidelines helps keep the codebase consistent and maintainable.

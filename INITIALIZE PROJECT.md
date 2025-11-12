# Step 1: As a technical expert, analyze this codebase and provide a clear project overview:

- Core Components: Describe the major components or modules, their responsibilities, and any key classes or functions they contain. Note any relevant design patterns or architectural approaches.

- Component Interactions: Explain how the components interact, including data and control flow, communication methods, and any APIs or interfaces used. Highlight use of dependency injection or service patterns if applicable.

- Deployment Architecture: Summarize the deployment setup, including build steps, external dependencies, required environments (e.g., dev, staging, prod), and infrastructure or containerization details.

- Runtime Behavior: Describe how the application initializes, handles requests and responses, runs business workflows, and manages errors or background tasks.

- Stay focused on providing a technical overview that helps a developer quickly understand how the system works. Avoid personal opinions or implementation suggestions unless specifically asked.

# Step 2: Lalu hasilnya buat jadi file 'technical_overview.md'

# Step 3: Initialize AGENTS.md (https://agents.md/) as a README for agents: a dedicated, predictable place to provide the context and instructions to help AI coding agents work on your project. use this best practice:

- Keep it short:
Aim for ≤ 150 lines. Long files slow the agent and bury signal.

- Use concrete commands:
Wrap commands in back-ticks so agents can copy-paste without guessing.

- Update alongside code:
Treat AGENTS.md like code—PR reviewers should nudge updates when build steps change.

- One source of truth:
Avoid duplicate docs; link to READMEs or design docs instead of pasting them.

- Make requests precise:
The more precise your guidance for the task at hand, the more likely the agent is to accomplish that task to your liking.

- Verify before merging:
Require objective proof: tests, lint, type check, and a diff confined to agreed paths.

- Tambahkan Rules wajib ini ke AGENTS.md:

**Critical Rules:**
- ✅ **ALWAYS consult all 3 files before work**
- ✅ **MUST update PROGRESS.md before commits**
- ✅ **Maintain consistency with patterns**
- ✅ **Document significant changes**

# Step 4: Create PROGRESS.md untuk track setiap progress yang dilakukan AI sebelum Commit GitHub

- Project timeline & history
- Completed features & bug fixes
- **MUST update before every commit**
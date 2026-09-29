# Agent Role & Behavioral Constraints for Baitul Hikmah

## 1. Role Division
- **Gemini / Antigravity**: **Architect, Planner & Reviewer**
  - **Scope:** High-level system architecture, planning, database and API design, debugging strategy, reviewing implementations, and creating structured technical briefs for Claude.
  - **Strict Constraint:** Never directly write, edit, or refactor application code (frontend, backend, database models, etc.) unless the user explicitly gives a direct command to edit code.
  - **No Assumption:** When asked to install, run, or diagnose, do not modify application files.

- **Claude / Claude Code**: **Technical Implementer & Coder**
  - **Scope:** All hands-on coding, writing source files, refactoring, fixing bugs, and implementing technical specifications provided by the Architect.

## 2. Delegation Workflow
1. **Architect & Plan:** Gemini analyzes requirements, designs architecture, and plans tasks.
2. **Handoff to Claude:** Gemini provides structured, copy-paste ready implementation briefs/prompts for the user to run directly in their Claude Code terminal session.
3. **Strict No-Direct-Coding:** Gemini must not edit application source code directly.
4. **Review & Verify:** After Claude executes the coding task, Gemini can inspect git status, logs, or system output to review and plan the subsequent phase.

## 3. Frontend Design System (Strict)
All frontend UI must use official shadcn/ui components (Obra shadcn/ui kit) styled only through theme tokens. The theme may only be changed with the System Owner's explicit permission. Full rules: [`docs/architecture-specs.md` §8.1](file:///home/ahmadsalehuddin/code/personal/baitul-hikmah/docs/architecture-specs.md).

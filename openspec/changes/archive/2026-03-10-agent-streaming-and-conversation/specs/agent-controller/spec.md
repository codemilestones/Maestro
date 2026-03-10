## MODIFIED Requirements

### Requirement: AgentController exposes worktree path for TUI resume
The AgentController SHALL provide a method to retrieve the worktree path for a given Agent, enabling the TUI to call `resume()` with the required `worktreePath` parameter.

#### Scenario: TUI retrieves worktree path for resume
- **WHEN** TUI needs to resume an Agent from attached view
- **THEN** AgentController SHALL provide `getWorktreePath(agentId)` that returns the worktree path by looking up the Agent's worktreeId

### Requirement: AgentController supports status-aware input routing
The AgentController SHALL handle input from the TUI by routing to the appropriate method based on Agent status.

#### Scenario: Input sent to waiting Agent
- **WHEN** TUI calls `handleConversationInput(agentId, text)` and Agent status is `waiting_input`
- **THEN** the controller SHALL delegate to `sendInput(agentId, text)`

#### Scenario: Input sent to completed Agent with session
- **WHEN** TUI calls `handleConversationInput(agentId, text)` and Agent status is `finished` or `failed` with a valid sessionId
- **THEN** the controller SHALL delegate to `resume(agentId, text, worktreePath)`

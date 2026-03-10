## ADDED Requirements

### Requirement: Conversation input box in attached view
The attached view SHALL display a text input box at the bottom of the screen, allowing users to type and submit messages to the Agent.

#### Scenario: User views attached mode for an Agent accepting input
- **WHEN** user enters attached view and the Agent status is `waiting_input` or a terminal state (`finished`/`failed`) with a valid sessionId
- **THEN** the input box SHALL be enabled and display a placeholder indicating the expected action

#### Scenario: User views attached mode for a running Agent
- **WHEN** user enters attached view and the Agent status is `running`
- **THEN** the input box SHALL be visible but disabled, with a dimmed placeholder "Agent is running..."

#### Scenario: User submits input to a waiting Agent
- **WHEN** Agent status is `waiting_input` AND user types text and presses Enter
- **THEN** the system SHALL call `AgentController.sendInput(agentId, text)` to deliver the input to the running Agent process

#### Scenario: User submits input to a completed Agent
- **WHEN** Agent status is `finished` or `failed` AND Agent has a valid sessionId AND user types text and presses Enter
- **THEN** the system SHALL call `AgentController.resume(agentId, text, worktreePath)` with the Agent's existing sessionId to continue the conversation in the same context

### Requirement: SessionId reuse for conversation continuity
When continuing a conversation with a completed Agent from the attached view, the system SHALL automatically use the Agent's stored sessionId to maintain conversation context.

#### Scenario: Resume preserves session context
- **WHEN** user sends a message to a `finished` Agent that has sessionId "abc-123"
- **THEN** the resume call SHALL pass sessionId "abc-123" to Claude Code via the `--resume` flag

#### Scenario: Agent without sessionId cannot be resumed
- **WHEN** user attempts to send a message to a `finished` Agent that has no sessionId
- **THEN** the input box SHALL be disabled and display "No session available for resume"

### Requirement: Keyboard focus management in attached view
The attached view SHALL manage keyboard focus to prevent conflicts between the input box and global keyboard shortcuts.

#### Scenario: Input box is focused in attached view
- **WHEN** viewMode is `attached` and input box is enabled
- **THEN** global keyboard shortcuts (j/k/n/x/a/r) SHALL be disabled to prevent character input from triggering navigation

#### Scenario: Esc key exits attached view
- **WHEN** user presses Esc in attached view regardless of input focus state
- **THEN** the view SHALL return to list mode and re-enable global keyboard shortcuts

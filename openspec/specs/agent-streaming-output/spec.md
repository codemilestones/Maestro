## Requirements

### Requirement: Attached view displays real-time streaming output
The TUI attached view SHALL render Agent output lines in real-time as they arrive from the OutputParser event stream, with automatic scrolling to the latest content.

#### Scenario: Agent is running and producing output
- **WHEN** user enters attached view for a running Agent
- **THEN** the view SHALL display existing output lines and append new lines as they arrive via the `output` event

#### Scenario: Output exceeds visible area
- **WHEN** the output lines exceed the terminal height
- **THEN** the view SHALL automatically scroll to show the most recent lines

### Requirement: Agent status indicator in attached view header
The attached view header SHALL display the current Agent status with appropriate visual styling to indicate the Agent's running state.

#### Scenario: Agent is running
- **WHEN** the attached Agent has status `running`
- **THEN** the header SHALL display a spinning animation indicator alongside the text "Running..."

#### Scenario: Agent is waiting for input
- **WHEN** the attached Agent has status `waiting_input`
- **THEN** the header SHALL display a highlighted prompt "Waiting for input..." in yellow

#### Scenario: Agent has finished successfully
- **WHEN** the attached Agent has status `finished`
- **THEN** the header SHALL display "Completed" in green

#### Scenario: Agent has failed
- **WHEN** the attached Agent has status `failed`
- **THEN** the header SHALL display "Failed" in red

#!/usr/bin/env node

/**
 * Pre-Tool Safety Gate Hook
 * Blocks dangerous, destructive, or unauthorized shell commands.
 */

let inputData = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(inputData || '{}');
    const toolCall = payload.toolCall || {};
    const toolName = toolCall.name || '';
    const args = toolCall.args || {};

    if (toolName === 'run_command') {
      const commandLine = (args.CommandLine || '').trim();

      // Destructive or secret-exposing patterns that must never be run autonomously
      const destructivePatterns = [
        /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f\s+[\/~]/i,       // rm -rf / or rm -rf ~
        /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f\s+\*/i,         // rm -rf *
        /\bgit\s+reset\s+--hard\b/i,                  // git reset --hard
        /\bgit\s+clean\s+-[a-zA-Z]*f/i,               // git clean -f
        /\bgit\s+checkout\s+--\s+\./i,                // git checkout -- .
        /\bgit\s+restore\s+(\.|\/)\b/i,               // git restore .
        /\bgit\s+push\s+.*--force\b/i,                // git push --force
        /\bgit\s+push\s+.*-f\b/i,                     // git push -f
        /\bdrop\s+database\b/i,                       // drop database SQL
        /\bprisma\s+migrate\s+reset\s+--force\b/i,    // destructive prisma DB wipe
        /\b(cat|head|tail|more|less)\s+.*\.env(\.local|\.production|\.development)?\b/i, // dumping secrets
        /\bmkfs(\.\w+)?\b/i,                          // filesystem formatting
        /\bdd\s+if=/i,                                // raw device writing
        /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,  // fork bomb
      ];

      for (const pattern of destructivePatterns) {
        if (pattern.test(commandLine)) {
          console.log(
            JSON.stringify({
              decision: 'deny',
              reason: `Command blocked by Antigravity Safety Gate: Pattern '${pattern}' contains destructive or irreversible operations.`,
            })
          );
          process.exit(0);
        }
      }
    }

    // Default: allow safe operations
    console.log(JSON.stringify({ decision: 'allow' }));
  } catch (err) {
    // Fail-safe: allow on parser error to avoid blocking agent loop
    console.log(JSON.stringify({ decision: 'allow' }));
  }
  process.exit(0);
});
